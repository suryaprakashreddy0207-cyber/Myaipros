import { createFileRoute } from "@tanstack/react-router";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { generateImage, editImageWithGemini } from "@/lib/ai-providers.server";
import {
  detectElectionQuery,
  searchYouTubeMedia,
  fetchGoogleWebImages,
  WebImageResult,
} from "@/lib/live-search";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: { headers: { "User-Agent": "aistudio-build" } },
});

type Attachment = {
  dataUrl: string;
  name?: string;
  mime?: string;
};

type Body = {
  threadId?: string;
  userId?: string;
  model?: string;
  imageMode?: boolean;
  isImageEdit?: boolean;
  originalImageUrl?: string;
  aspectRatio?: "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
  imageStyle?: string;
  deepResearchMode?: boolean;
  attachment?: Attachment;
  attachments?: Attachment[];
  messages?: { role: "user" | "assistant"; content: string; image_url?: string | null; images?: string[] }[];
};

async function extractInlineImagePart(att: Attachment) {
  if (!att?.dataUrl) return null;
  let b64 = "";
  let mime = att.mime || "image/jpeg";
  if (att.dataUrl.startsWith("data:")) {
    const match = att.dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
    if (match) {
      mime = match[1] || mime;
      b64 = match[2];
    } else {
      const parts = att.dataUrl.split(",");
      b64 = parts[1] || parts[0];
    }
  } else if (att.dataUrl.startsWith("http://") || att.dataUrl.startsWith("https://")) {
    try {
      const res = await fetch(att.dataUrl, { signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        mime = res.headers.get("content-type") || mime;
        const ab = await res.arrayBuffer();
        b64 = Buffer.from(ab).toString("base64");
      }
    } catch {
      return null;
    }
  } else {
    b64 = att.dataUrl;
  }
  b64 = b64.replace(/\s+/g, "");
  if (!b64) return null;
  return {
    inlineData: {
      data: b64,
      mimeType: mime,
    },
  };
}

/** Build robust, strictly alternating multiturn conversation turns for Gemini */
async function buildSanitizedMultiturnContents(
  rawMessages: { role: string; content?: string }[] | undefined,
  finalUserPrompt: string,
  attachments?: Attachment[],
) {
  let resolvedImageParts: any[] = [];
  if (attachments && attachments.length > 0) {
    const partsOrNull = await Promise.all(attachments.map(extractInlineImagePart));
    resolvedImageParts = partsOrNull.filter((p): p is NonNullable<typeof p> => p !== null);
  }

  if (!rawMessages || rawMessages.length === 0) {
    const parts: any[] = [...resolvedImageParts, { text: finalUserPrompt.trim() || "Hello" }];
    return [{ role: "user", parts }];
  }

  // 1. Normalize
  const normalized: { role: "user" | "model"; text: string }[] = [];
  for (let i = 0; i < rawMessages.length; i++) {
    const m = rawMessages[i];
    const isLast = i === rawMessages.length - 1;
    const role: "user" | "model" = m.role === "assistant" ? "model" : "user";
    const textVal = isLast ? finalUserPrompt : (m.content || "");
    const cleanText = textVal.trim() || (role === "user" ? "Please proceed." : "I understand.");
    normalized.push({ role, text: cleanText });
  }

  // 2. Ensure starts with user
  if (normalized.length > 0 && normalized[0].role !== "user") {
    normalized.unshift({ role: "user", text: "Hello" });
  }

  // 3. Merge consecutive turns of identical role
  const merged: { role: "user" | "model"; parts: any[] }[] = [];
  for (const item of normalized) {
    if (merged.length === 0) {
      merged.push({ role: item.role, parts: [{ text: item.text }] });
    } else {
      const prev = merged[merged.length - 1];
      if (prev.role === item.role) {
        prev.parts[0].text += `\n\n${item.text}`;
      } else {
        merged.push({ role: item.role, parts: [{ text: item.text }] });
      }
    }
  }

  // 4. Ensure ends with user
  if (merged.length > 0 && merged[merged.length - 1].role !== "user") {
    merged.push({ role: "user", parts: [{ text: finalUserPrompt.trim() || "Please continue." }] });
  }

  // 5. Attach image parts to the final user message
  if (resolvedImageParts.length > 0 && merged.length > 0) {
    const lastItem = merged[merged.length - 1];
    lastItem.parts.unshift(...resolvedImageParts);
  }

  return merged;
}

/** Direct solver for instant, accurate calculations without LLM drift */
function solveMathDirectly(q: string): string | null {
  const clean = q.trim().toLowerCase().replace(/[?,!]+$/, "");
  const basicMatch = clean.match(
    /^(?:what(?:'s|\s+is|\s+are)?\s+)?([0-9\s.+\-*/%^()]+)$/,
  );
  if (basicMatch) {
    const expr = basicMatch[1].replace(/\^/g, "**").trim();
    if (/^[0-9+\-*/().\s%*]+$/.test(expr)) {
      try {
        const val = Function(`'use strict'; return (${expr})`)();
        if (typeof val === "number" && !isNaN(val) && isFinite(val)) {
          const formatted = Number.isInteger(val) ? val.toString() : val.toFixed(6).replace(/\.?0+$/, "");
          return `**${expr} = ${formatted}**`;
        }
      } catch {
        // ignore
      }
    }
  }

  const wordMath = clean.match(
    /^(?:what(?:'s|\s+is)?\s+)?([0-9.]+)\s*(plus|\+|-|minus|times|\*|x|multiplied\s+by|divided\s+by|\/)\s*([0-9.]+)$/,
  );
  if (wordMath) {
    const a = parseFloat(wordMath[1]);
    const op = wordMath[2];
    const b = parseFloat(wordMath[3]);
    let res: number | null = null;
    let symbol = "+";

    if (op === "plus" || op === "+") {
      res = a + b;
      symbol = "+";
    } else if (op === "minus" || op === "-") {
      res = a - b;
      symbol = "-";
    } else if (op === "times" || op === "*" || op === "x" || op.includes("multiplied")) {
      res = a * b;
      symbol = "×";
    } else if (op === "/" || op.includes("divided")) {
      res = b !== 0 ? a / b : null;
      symbol = "÷";
    }

    if (res !== null && !isNaN(res)) {
      const formatted = Number.isInteger(res) ? res.toString() : res.toFixed(6).replace(/\.?0+$/, "");
      return `**${a} ${symbol} ${b} = ${formatted}**`;
    }
  }
  return null;
}

/** Detect if user is asking about or telling the chatbot to play YouTube videos & bring Google images */
function detectCapabilityDemonstration(q: string): boolean {
  const s = q.toLowerCase();
  const hasYouTube = /\b(youtube|video|videos)\b/i.test(s);
  const hasGoogleImages = /\b(google|images?|pictures?|photos?)\b/i.test(s);
  const hasCapabilityIntent =
    /\b(can you|integrated|integration|capability|say the chatbot|let it play|let it show|how it is responding|play videos from youtube and bring images|bring images from google and play videos)\b/i.test(
      s,
    );
  return hasYouTube && hasGoogleImages && hasCapabilityIntent;
}

/** Detect if user wants to bring images from Google or search real photos */
function isGoogleImageRequest(q: string): { topic: string } | null {
  const s = q.toLowerCase();
  if (detectCapabilityDemonstration(q)) return null;

  const isGoogleImg =
    /\b(google images?|images? from google|pictures? from google|photos? from google)\b/i.test(s) ||
    /\b(bring|show|get|find|display|fetch)\s+(me\s+)?(some\s+|a\s+|the\s+)?(images?|pictures?|photos?|pics?)\s+(from\s+google|on\s+google|from\s+the\s+web)\b/i.test(s) ||
    /\b(bring|show|get|display|fetch)\s+(me\s+)?(some\s+)?(images?|pictures?|photos?|pics?)\s+of\b/i.test(s) ||
    /\b(photos?|pictures?|images?)\s+of\b/i.test(s) ||
    /\bwhat does\s+.+\s+look like\b/i.test(s);

  if (!isGoogleImg) return null;

  // Exclude explicit AI generative art requests
  if (
    /\b(generate|create|draw|paint|sketch|ai image|ai art|render 3d)\b/i.test(s) &&
    !s.includes("from google") &&
    !s.includes("google image")
  ) {
    return null;
  }

  let clean = q
    .replace(/\b(can you|please|i want to|could you|let's|go ahead and|and let it show|let it show)\b/gi, "")
    .replace(/\b(bring|show|get|display|find|fetch|search)\s+(me\s+)?(some\s+|a\s+|the\s+)?/gi, "")
    .replace(/\b(from google|on google|in google|from the web|on the web)\b/gi, "")
    .replace(/\b(google images?|images? from google|pictures? from google|photos? from google)\b/gi, "")
    .replace(/\b(images?|pictures?|photos?|pics?|wallpaper)s?\b/gi, "")
    .replace(/^\s*(?:of|for|about|showing)\s+/i, "")
    .replace(/\s+(?:of|for|about|showing)\s*$/i, "")
    .replace(/[?.!]+$/, "")
    .trim();
  clean = clean.replace(/^\s*(?:of|for|about)\s+/i, "").trim();

  return { topic: clean || q.trim() };
}

/** Check if user wants AI image generation (creative art generation) */
function wantsImageGen(q: string): boolean {
  const s = q.toLowerCase();
  if (detectCapabilityDemonstration(q)) return false;
  if (isGoogleImageRequest(q)) return false;
  if (/\b(on youtube|from youtube|play video)\b/i.test(s)) return false;

  return (
    /\b(generate|create|draw|paint|illustrate|render|sketch|design|make)\s+(?:an?|[0-9]+|one|two|three|four|five|six|some|a\s+few)?\s*(?:ai\s+)?(?:images?|pictures?|photos?|pics?|posters?|wallpapers?|avatars?|illustrations?|art(?:work)?|graphics?|visuals?|portraits?|paintings?)\b/i.test(
      s,
    ) ||
    /\b(draw|paint|sketch)\s+(a|an|me|the|[0-9]+|one|two|three|four)\b/i.test(s)
  );
}

/** Check if user wants to edit/modify an existing image */
function wantsImageEdit(q: string): boolean {
  const s = q.toLowerCase();
  return (
    /\b(edit|modify|change|alter|transform|recolor|filter|retouch|replace|add|remove|turn into|make it|style as|convert to)\b/i.test(
      s,
    )
  );
}

/** Fetch live crypto and financial rates */
async function fetchLiveFinancials(query: string): Promise<string | null> {
  const q = query.toLowerCase();
  const isFinancial =
    /\b(value|price|worth|cost|rate|stock|crypto|market|currency|exchange|share|gold|silver|bitcoin|btc|eth|ethereum|solana|sol|xrp|ripple|doge|dogecoin|usdt|dollar|rupee|inr|usd|eur|euro|gbp|pound)\b/i.test(
      q,
    );
  if (!isFinancial) return null;

  const parts: string[] = [];

  try {
    // 1. Live Crypto Rates (top 20 coins)
    const cryptoRes = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,binancecoin,ripple,dogecoin,cardano,avalanche-2,polkadot,tron,shiba-inu,chainlink,uniswap&vs_currencies=usd,inr,eur&include_24hr_change=true",
      { signal: AbortSignal.timeout(3500) },
    );
    if (cryptoRes.ok) {
      const data: any = await cryptoRes.json();
      if (data.bitcoin && (q.includes("bitcoin") || q.includes("btc") || q.includes("crypto") || q.includes("value") || q.includes("price"))) {
        parts.push(`• Bitcoin (BTC): $${data.bitcoin.usd.toLocaleString()} (₹${data.bitcoin.inr?.toLocaleString()} INR, 24h change: ${data.bitcoin.usd_24h_change?.toFixed(2)}%)`);
      }
      if (data.ethereum && (q.includes("ethereum") || q.includes("eth") || q.includes("crypto") || q.includes("value") || q.includes("price"))) {
        parts.push(`• Ethereum (ETH): $${data.ethereum.usd.toLocaleString()} (₹${data.ethereum.inr?.toLocaleString()} INR, 24h change: ${data.ethereum.usd_24h_change?.toFixed(2)}%)`);
      }
      if (data.solana && (q.includes("solana") || q.includes("sol"))) {
        parts.push(`• Solana (SOL): $${data.solana.usd.toLocaleString()} (₹${data.solana.inr?.toLocaleString()} INR)`);
      }
      if (data.ripple && (q.includes("ripple") || q.includes("xrp"))) {
        parts.push(`• Ripple (XRP): $${data.ripple.usd.toFixed(4)} (₹${data.ripple.inr?.toFixed(2)} INR)`);
      }
      if (data.dogecoin && (q.includes("dogecoin") || q.includes("doge"))) {
        parts.push(`• Dogecoin (DOGE): $${data.dogecoin.usd.toFixed(4)} (₹${data.dogecoin.inr?.toFixed(2)} INR)`);
      }
    }

    // 2. Currency exchange rates (USD, INR, EUR, GBP, AED, CAD, AUD)
    const currRes = await fetch("https://open.er-api.com/v6/latest/USD", {
      signal: AbortSignal.timeout(3500),
    });
    if (currRes.ok) {
      const currData: any = await currRes.json();
      if (currData.rates) {
        const inr = currData.rates.INR?.toFixed(2);
        const eur = currData.rates.EUR?.toFixed(4);
        const gbp = currData.rates.GBP?.toFixed(4);
        const aed = currData.rates.AED?.toFixed(2);
        parts.push(`• Live Currency Rates: 1 USD = ₹${inr} INR | 1 EUR = ₹${(currData.rates.INR / currData.rates.EUR).toFixed(2)} INR | 1 GBP = ₹${(currData.rates.INR / currData.rates.GBP).toFixed(2)} INR | 1 AED = ₹${(currData.rates.INR / currData.rates.AED).toFixed(2)} INR`);
      }
    }

    // 3. DuckDuckGo Financial Snippet for stock / commodity / custom asset value
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query + " current price value today 2026")}`;
    const sRes = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(3500),
    });
    if (sRes.ok) {
      const html = await sRes.text();
      const snippets: string[] = [];
      const regex = /<a class="result__snippet[^>]*>([\s\S]*?)<\/a>/gi;
      let m;
      while ((m = regex.exec(html)) !== null && snippets.length < 3) {
        const clean = m[1].replace(/<[^>]+>/g, "").trim();
        if (clean.length > 20) snippets.push(`• ${clean}`);
      }
      if (snippets.length > 0) {
        parts.push(`• Live Search Market Context:\n${snippets.join("\n")}`);
      }
    }
  } catch {
    // ignore
  }

  return parts.length > 0 ? parts.join("\n") : null;
}

/** Fetch live sports and cricket match scores */
async function fetchLiveSportsScores(query: string): Promise<string | null> {
  const q = query.toLowerCase();
  const isSports = /\b(cricket|score|match|ipl|t20|odi|test match|india vs|pakistan vs|australia vs|england vs|south africa vs|new zealand vs|football|premier league|chelsea|arsenal|manchester|real madrid|barcelona|nba|lakers|champions league|who won)\b/i.test(q);
  if (!isSports) return null;

  try {
    // 1. DuckDuckGo HTML Search for live scores
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query + " live score match results latest")}`;
    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(3500),
    });
    if (res.ok) {
      const html = await res.text();
      const snippets: string[] = [];
      const regex = /<a class="result__snippet[^>]*>([\s\S]*?)<\/a>/gi;
      let m;
      while ((m = regex.exec(html)) !== null && snippets.length < 4) {
        const clean = m[1].replace(/<[^>]+>/g, "").trim();
        if (clean.length > 20) snippets.push(`• ${clean}`);
      }
      if (snippets.length > 0) {
        return `Current Match Live Updates & Scores:\n${snippets.join("\n")}`;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

/** Fetch live weather information */
async function fetchLiveWeather(query: string): Promise<string | null> {
  const q = query.toLowerCase();
  if (!/\b(weather|temperature|forecast|climate|rain|cold|hot|degrees)\b/i.test(q)) return null;

  // Extract city name if possible
  const cityMatch = q.match(/(?:in|for|at)\s+([a-zA-Z\s]+?)(?:\s+(?:today|tomorrow|now|currently))?$/i);
  const city = cityMatch && cityMatch[1] ? cityMatch[1].trim() : "New York";

  try {
    const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`, {
      signal: AbortSignal.timeout(3000),
      headers: { "User-Agent": "curl/7.68.0" },
    });
    if (res.ok) {
      const data: any = await res.json();
      const current = data?.current_condition?.[0];
      if (current) {
        return `Live Weather for ${city}: ${current.temp_C}°C (${current.temp_F}°F), ${current.weatherDesc?.[0]?.value || "Clear"}, Humidity: ${current.humidity}%, Wind: ${current.windspeedKmph} km/h`;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

/** Fetch live search data from Wikipedia and Google / DuckDuckGo */
async function fetchLiveWebGrounding(query: string): Promise<string | null> {
  const cleanQuery = query
    .replace(/\b(what is|who is|tell me about|how to|search|google|find|current|latest|price of|value of)\b/gi, "")
    .trim();
  if (!cleanQuery || cleanQuery.length < 2) return null;

  try {
    // 1. DuckDuckGo Instant Answer / Abstract
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(cleanQuery)}&format=json&no_html=1&skip_disambig=1`;
    const ddgRes = await fetch(ddgUrl, { signal: AbortSignal.timeout(3500) });
    if (ddgRes.ok) {
      const ddgData: any = await ddgRes.json();
      if (ddgData.AbstractText) {
        return `**${ddgData.Heading || cleanQuery}**\n\n${ddgData.AbstractText}`;
      }
    }

    // 2. Wikipedia Search & Summary
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanQuery)}&format=json&origin=*&utf8=1`;
    const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(3500) });
    if (searchRes.ok) {
      const searchData: any = await searchRes.json();
      const topTitle = searchData?.query?.search?.[0]?.title;
      if (topTitle) {
        const sumUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topTitle)}`;
        const sumRes = await fetch(sumUrl, { signal: AbortSignal.timeout(3500) });
        if (sumRes.ok) {
          const sumData: any = await sumRes.json();
          if (sumData.extract) {
            return `**${sumData.title}** (Wikipedia Summary):\n${sumData.extract}`;
          }
        }
      }
    }
  } catch {
    // ignore
  }
  return null;
}

/** Detect hardware / device action intent */
function detectDeviceCommand(
  userText: string,
): {
  action: "vibrate" | "battery" | "call" | "open_app" | "search" | "navigate_back";
  title: string;
  scheme?: string;
  web_fallback?: string;
  intent?: string;
  number?: string;
  query?: string;
  app?: string;
  details: string;
} | null {
  const s = userText.toLowerCase().trim();

  // 1. Device Hardware / Control Actions
  if (s.includes("vibrate") && (s.includes("phone") || s.includes("mobile") || s.includes("device") || s.includes("me"))) {
    return {
      action: "vibrate",
      title: "Vibrate Device",
      details: "Triggering physical vibration motor on your device",
    };
  }

  if (s.includes("battery") && (s.includes("level") || s.includes("status") || s.includes("percentage") || s.includes("check"))) {
    return {
      action: "battery",
      title: "Check Battery Status",
      details: "Reading device battery percentage and power status",
    };
  }

  if (s.match(/\b(call|dial|phone|make a call|call back)\b/i)) {
    const numMatch = s.match(/\b(?:call|dial|phone|make a call to|call back to|call to)\s+([^?.!,]+)/i);
    const target = numMatch && numMatch[1] ? numMatch[1].trim() : "Contact";
    const cleanNum = target.replace(/[^0-9+]/g, "");
    return {
      action: "call",
      title: `Call ${target}`,
      number: cleanNum || target,
      scheme: cleanNum ? `tel:${cleanNum}` : "tel:",
      details: `Initiating phone call to ${target}`,
    };
  }

  if (s.match(/\b(go back|navigate back|back to previous|back)\b/i)) {
    return {
      action: "navigate_back",
      title: "Go Back",
      details: "Navigating back to previous view",
    };
  }

  // 2. Open App Intent on Mobile / Device
  const openAppKeywords = ["open", "launch", "start", "switch to", "run", "go to", "open this app"];
  const isAppLaunchRequest =
    openAppKeywords.some((k) => s.includes(k)) &&
    (s.includes("app") ||
      s.includes("mobile") ||
      s.includes("phone") ||
      s.includes("device") ||
      s.includes("youtube") ||
      s.includes("whatsapp") ||
      s.includes("spotify") ||
      s.includes("instagram") ||
      s.includes("camera") ||
      s.includes("calculator") ||
      s.includes("maps") ||
      s.includes("settings") ||
      s.includes("gmail") ||
      s.includes("twitter") ||
      s.includes("telegram") ||
      s.includes("netflix") ||
      s.includes("uber"));

  if (!isAppLaunchRequest) return null;

  if (s.includes("youtube")) {
    return {
      action: "open_app",
      app: "YouTube",
      title: "Open YouTube on Device",
      scheme: "vnd.youtube://",
      web_fallback: "https://youtube.com",
      intent: "intent://youtube.com/#Intent;package=com.google.android.youtube;scheme=https;end",
      details: "Opening YouTube app on your mobile device",
    };
  }

  if (s.includes("whatsapp")) {
    return {
      action: "open_app",
      app: "WhatsApp",
      title: "Open WhatsApp on Device",
      scheme: "whatsapp://send",
      web_fallback: "https://web.whatsapp.com",
      intent: "intent://send#Intent;package=com.whatsapp;scheme=whatsapp;end",
      details: "Opening WhatsApp chat and contacts",
    };
  }

  if (s.includes("spotify")) {
    return {
      action: "open_app",
      app: "Spotify",
      title: "Open Spotify on Device",
      scheme: "spotify://",
      web_fallback: "https://open.spotify.com",
      intent: "intent://#Intent;package=com.spotify.music;scheme=spotify;end",
      details: "Opening Spotify music player",
    };
  }

  if (s.includes("instagram") || s.includes("insta")) {
    return {
      action: "open_app",
      app: "Instagram",
      title: "Open Instagram on Device",
      scheme: "instagram://",
      web_fallback: "https://instagram.com",
      intent: "intent://#Intent;package=com.instagram.android;scheme=https;end",
      details: "Opening Instagram feed and reels",
    };
  }

  if (s.includes("camera")) {
    return {
      action: "open_app",
      app: "Camera",
      title: "Open Device Camera",
      scheme: "camera://",
      intent: "intent:#Intent;action=android.media.action.IMAGE_CAPTURE;end",
      details: "Opening system camera to capture photo or video",
    };
  }

  if (s.includes("calculator") || s.includes("calc")) {
    return {
      action: "open_app",
      app: "Calculator",
      title: "Open Calculator",
      scheme: "calc://",
      intent: "intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.APP_CALCULATOR;end",
      web_fallback: "https://www.google.com/search?q=calculator",
      details: "Opening Calculator tool",
    };
  }

  if (s.includes("map") || s.includes("location") || s.includes("directions")) {
    const query = s.replace(/open|maps|map|show|location|directions|to|on/gi, "").trim() || "nearby";
    return {
      action: "open_app",
      app: "Google Maps",
      title: "Open Google Maps",
      scheme: `geo:0,0?q=${encodeURIComponent(query)}`,
      web_fallback: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
      details: `Opening Google Maps for ${query}`,
    };
  }

  if (s.includes("gmail") || s.includes("email") || s.includes("mail")) {
    return {
      action: "open_app",
      app: "Gmail",
      title: "Open Gmail on Device",
      scheme: "googlegmail://",
      web_fallback: "https://mail.google.com",
      details: "Opening Gmail inbox",
    };
  }

  if (s.includes("twitter") || s.includes("x.com")) {
    return {
      action: "open_app",
      app: "X (Twitter)",
      title: "Open X / Twitter on Device",
      scheme: "twitter://",
      web_fallback: "https://x.com",
      details: "Opening X social feed",
    };
  }

  if (s.includes("telegram")) {
    return {
      action: "open_app",
      app: "Telegram",
      title: "Open Telegram on Device",
      scheme: "tg://",
      web_fallback: "https://web.telegram.org",
      details: "Opening Telegram messenger",
    };
  }

  if (s.includes("netflix")) {
    return {
      action: "open_app",
      app: "Netflix",
      title: "Open Netflix on Device",
      scheme: "nflx://",
      web_fallback: "https://netflix.com",
      details: "Opening Netflix streaming player",
    };
  }

  if (s.includes("settings")) {
    return {
      action: "open_app",
      app: "Settings",
      title: "Open Device Settings",
      scheme: "intent:#Intent;action=android.settings.SETTINGS;end",
      details: "Opening system settings configuration",
    };
  }

  // Generic app match
  const genericMatch = s.match(
    /(?:open|launch)\s+([a-zA-Z0-9\s]+?)(?:\s+(?:app|on my mobile|on my phone|on device|on mobile|application))?$/i,
  );
  const targetName = genericMatch && genericMatch[1] ? genericMatch[1].trim() : "App";
  if (targetName && targetName.length > 1 && targetName.toLowerCase() !== "this") {
    return {
      action: "open_app",
      app: targetName,
      title: `Open ${targetName} on Device`,
      web_fallback: `https://www.google.com/search?q=${encodeURIComponent(targetName)}+app`,
      details: `Launching ${targetName} on your mobile device`,
    };
  }

  return {
    action: "open_app",
    app: "Mobile App",
    title: "Open App on Device",
    web_fallback: "https://play.google.com",
    details: "Launching the requested application on your device",
  };
}

/** Detect video or YouTube request */
function detectVideoRequest(q: string): { topic: string } | null {
  const s = q.toLowerCase().trim();
  if (detectCapabilityDemonstration(q)) return null;

  const isVideo =
    /\b(video|youtube|watch|clip|trailer|mv|music video)\b/i.test(s) ||
    /\b(play|listen to|stream|put on)\b/i.test(s);

  if (!isVideo) return null;

  if (
    s.includes("play store") ||
    s.includes("google play") ||
    s.includes("play chess") ||
    s.includes("role play") ||
    s.includes("fair play") ||
    s.includes("play games") ||
    s.includes("play game")
  ) {
    return null;
  }

  const clean = s
    .replace(/\b(can you|please|i want to|could you|let's|let us|go ahead and)\b/gi, "")
    .replace(/\b(play|watch|stream|listen to|put on|show me a?|bring me a?|find me a?)\b/gi, "")
    .replace(/\b(video|youtube video|youtube|clip|song|track|music|audio|trailer)\s+(of|about|for|on)?\b/gi, "")
    .replace(/\b(on youtube|from youtube|in youtube)\b/gi, "")
    .replace(/[?.!]+$/, "")
    .trim();

  return { topic: clean || q.trim() };
}

/** Check if user asks specifically about MyAI CEO / leadership */
function detectCeoQuery(q: string): boolean {
  const s = q.toLowerCase().trim();
  // Match ONLY if explicitly asking about My AI / My AI Pro / this app's CEO / founder
  return (
    /\b(who is|who's|tell me about)?\s*(the\s+)?(ceo|founder|creator|owner|head)\s+of\s+(my\s*ai|my\s*ai\s*pro|myaipro|this app|this platform)\b/i.test(s) ||
    /\b(who is|who's)\s+(the\s+)?(ceo|founder)\s+of\s+my\s*ai\b/i.test(s)
  );
}

/** Detect if user is asking the chatbot to write code, edit code, explain code, or solve coding/debugging problems */
function detectCodeRequest(
  userText: string,
  messages?: { role: string; content?: string }[],
): { isCode: boolean; mode: "write" | "edit" | "explain" | "solve" } {
  const s = userText.toLowerCase().trim();

  // Check for fenced code block or clear inline code constructs in user message
  const hasCodeSnippet =
    /```[\s\S]*?```/.test(userText) ||
    /\b(function\s+\w+\s*\(|const\s+\w+\s*=|let\s+\w+\s*=|var\s+\w+\s*=|import\s+.*from\s+['"]|export\s+(default\s+)?(function|class|const|interface|type)|def\s+\w+\s*\(|class\s+\w+|public\s+static\s+void\s+main|#include\s*<|SELECT\s+.*\s+FROM\s+|console\.log\(|System\.out\.println|std::cout|=>\s*\{|useState\(|useEffect\()/i.test(
      userText,
    );

  // Check for programming languages, frameworks, and coding concepts
  const hasCodingKeywords =
    /\b(code|coding|program|programming|script|function|method|class|component|hook|algorithm|leetcode|data structure|regex|regular expression|api endpoint|rest api|graphql|sql query|database schema|dockerfile|shell script|bash script|unit test|typeerror|referenceerror|syntaxerror|nullpointerexception|segmentation fault|stack trace|compiler error|runtime error|time complexity|space complexity|big o|binary search|linked list|binary tree|dynamic programming|recursion|backtracking|hashmap)\b/i.test(
      s,
    ) ||
    /\b(javascript|typescript|python|java|c\+\+|cpp|c#|csharp|rust|golang|ruby|swift|kotlin|php|html|css|tailwind|react|nextjs|next\.js|nodejs|node\.js|express|vue|angular|svelte|django|flask|fastapi|spring boot|sql|postgresql|mongodb|prisma|drizzle)\b/i.test(
      s,
    ) ||
    /\b(whatsapp bot|whatsapp cloud api|baileys|whatsapp-web\.js|telegram bot|discord bot|slack bot|chatbot coding|bot coding|webhook handler|ai agent code)\b/i.test(
      s,
    );

  // Check if recent thread history contains code blocks (for follow-up "edit this", "explain it", "fix the bug", "convert to python")
  const hasPriorCodeInThread = Array.isArray(messages)
    ? messages
        .slice(0, -1)
        .slice(-6)
        .some((m) => /```[\s\S]*?```/.test(m.content || ""))
    : false;

  const isEditIntent =
    /\b(edit|modify|update|refactor|rewrite|optimize|improve|convert|translate|change|adapt|clean up|add comments|add types|add error handling|fix the code|edit the code|edit this code|modify the code)\b/i.test(
      s,
    );
  const isExplainIntent =
    /\b(explain|how does (this|the|it) work|what does (this|the) (code|function|script|line|method) do|walk me through|break down|understand this|analyze this code|step by step)\b/i.test(
      s,
    );
  const isSolveIntent =
    /\b(solve|debug|fix|troubleshoot|why is (this|it) (not working|failing|throwing|breaking)|find the bug|error|bug|issue|problem|solution|challenge)\b/i.test(
      s,
    );
  const isWriteIntent =
    /\b(write|create|build|implement|generate|make|develop|code|give me|show me)\b/i.test(
      s,
    );

  const isCode =
    hasCodeSnippet ||
    hasCodingKeywords ||
    (hasPriorCodeInThread &&
      (isEditIntent || isExplainIntent || isSolveIntent));

  if (!isCode) {
    return { isCode: false, mode: "write" };
  }

  if (isEditIntent && (hasCodeSnippet || hasPriorCodeInThread || /\b(edit|refactor|rewrite|modify)\b/i.test(s))) {
    return { isCode: true, mode: "edit" };
  }
  if (isExplainIntent && (hasCodeSnippet || hasPriorCodeInThread || /\bexplain\b/i.test(s))) {
    return { isCode: true, mode: "explain" };
  }
  if (isSolveIntent) {
    return { isCode: true, mode: "solve" };
  }
  if (isWriteIntent) {
    return { isCode: true, mode: "write" };
  }

  return { isCode: true, mode: hasCodeSnippet ? "explain" : "write" };
}

const CODING_SYSTEM_INSTRUCTION = `You are My AI, an elite principal software engineer and coding assistant integrated directly inside the chat.
CURRENT DATE: October 2026.

CRITICAL CODING CAPABILITIES & RULES:
1. WRITE PRODUCTION CODE:
   - Write complete, clean, modular, strictly-typed, production-ready, and directly runnable code.
   - Always wrap code in fenced markdown blocks with the exact language identifier (e.g., \`\`\`typescript, \`\`\`python, \`\`\`javascript, \`\`\`html, \`\`\`sql, \`\`\`cpp, etc.).
   - NEVER use lazy placeholders like "// TODO", "// rest of code here", or "// implement logic". Write the complete implementation.
2. WHATSAPP BOT & CHATBOT ENGINEERING (NEXT LEVEL):
   - When asked to build or code a WhatsApp bot, chatbot, or conversational assistant:
     • Provide the complete, production-grade architecture (Node.js/Express with TypeScript or Python FastAPI).
     • For WhatsApp Cloud API: write complete webhook verification (\`hub.verify_token\`, \`hub.challenge\`), incoming message dispatching (text, interactive buttons, quick replies, media), automated AI response generation, and Graph API message delivery with proper error handling and exponential backoff.
     • For Baileys / QR-based bots: provide full multi-device socket setup, connection status handler, QR terminal output, command dispatcher, and message listeners.
     • Include complete \`.env.example\`, \`package.json\`, and crystal-clear step-by-step setup commands so the bot can be launched immediately.
3. EDIT & REFACTOR CODE:
   - When the user asks to edit, modify, refactor, optimize, update, or convert code, carefully apply every requested change while preserving all working functionality.
   - Provide the complete updated code block so the user can copy and run it immediately, followed by a concise summary of what was changed and why.
4. EXPLAIN CODE:
   - Break down logic clearly: high-level architecture, step-by-step function walkthrough, and Big-O time and space complexity.
5. SOLVE & DEBUG PROBLEMS:
   - Identify the exact root cause, explain how to fix it, and provide the complete corrected working solution with test cases.
6. SPECIFIC LEADERSHIP ACCURACY:
   - If asked "who is the CEO of My AI" or "CEO of My AI Pro": state that the CEO of My AI is **Bhavyash**.`;

const SYSTEM_INSTRUCTION = `You are My AI, a precise, ultra-fast AI assistant with real-time Google Search, YouTube video player integration, full software engineering (write, edit, explain, and solve code), and live internet grounding.
CURRENT DATE: October 2026.

CRITICAL OPERATING RULES:
1. SHORT & CONCISE BY DEFAULT (EXCEPT FOR CODING): Answer general questions with short, direct, clear, and concise answers (1-3 sentences or compact bullet points). However, whenever the user asks to write code, edit code, explain code, or solve a coding/technical problem, always provide the complete, runnable code blocks and thorough technical explanation.
2. LONG ANSWERS ONLY WHEN EXPLICITLY REQUESTED OR FOR CODE: Give detailed, step-by-step explanations when the user asks for code writing/editing/explanation/debugging, or specifically asks for "explain in detail", "long answer", "elaborate", "write an essay", "step-by-step guide", or "full breakdown".
3. YOUTUBE VIDEOS & GOOGLE IMAGES:
   - When the user asks to play a video, song, music, trailer, or YouTube clip, provide the direct YouTube watch link (https://www.youtube.com/watch?v=VIDEO_ID) so our integrated player embeds and plays the video right in the chat.
   - When the user asks to see pictures, photos, images, or asks "show me...", embed clean markdown images (![Description](url)) from the provided live search image results so they display directly in the chat.
4. SPECIFIC LEADERSHIP ACCURACY:
   - If asked "who is the CEO of My AI" or "CEO of My AI Pro": state that the CEO of My AI is **Bhavyash**.
   - If asked about any other company (e.g. Myntra, Google, Microsoft, Apple, Tesla, etc.), provide their actual real-world executive (e.g. The CEO of Myntra is **Nandita Sinha**). Never confuse My AI with other companies like Myntra.
5. REAL-TIME DATA: Provide current live numbers, scores, currency values, stock/crypto prices, and dates accurately.
6. NO ROBOTIC DISCLAIMERS: Do not start responses with "As an AI..." or "According to Google Search...". State the direct answer immediately.
7. RECENT ELECTIONS & CURRENT AFFAIRS:
   - 2024 United States Presidential Election: Donald Trump won the presidency against Kamala Harris on November 5, 2024, becoming the 47th President of the United States. JD Vance is Vice President.
   - 2024 India Lok Sabha General Election: The NDA led by Prime Minister Narendra Modi / BJP won the election in June 2024, securing a historic 3rd consecutive term.
   - 2024 United Kingdom General Election: The Labour Party led by Sir Keir Starmer won in a landslide majority on July 4, 2024; Keir Starmer is the Prime Minister of the United Kingdom.
   - 2024 Mexico Presidential Election: Claudia Sheinbaum won and became Mexico's first female President.
   - NEVER claim that no recent election happened. For any question about recent elections, government elections, or state elections, provide the exact real-world outcome with winners and details accurately and immediately.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: Body;
        try {
          body = (await request.json()) as Body;
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }

        if (!body?.threadId || !Array.isArray(body.messages)) {
          return new Response(
            JSON.stringify({ error: "Missing threadId or messages" }),
            { status: 400, headers: { "content-type": "application/json" } },
          );
        }

        const lastUser = body.messages[body.messages.length - 1];
        if (!lastUser || lastUser.role !== "user") {
          return new Response(
            JSON.stringify({ error: "Missing user message" }),
            { status: 400, headers: { "content-type": "application/json" } },
          );
        }

        let userText = lastUser.content?.trim() || "";
        let assistantText = "";
        let assistantImage: string | null = null;
        const assistantImagesList: string[] = [];

        // Detect coding intent (write, edit, explain, solve code)
        const codeReq = detectCodeRequest(userText, body.messages);
        const isCodingTask =
          codeReq.isCode && !body.imageMode && !body.isImageEdit;

        // Collect all incoming attachments
        const attachmentsList: Attachment[] = [];
        if (Array.isArray(body.attachments)) {
          attachmentsList.push(...body.attachments.filter((a) => a?.dataUrl));
        }
        if (body.attachment?.dataUrl && !attachmentsList.some((a) => a.dataUrl === body.attachment?.dataUrl)) {
          attachmentsList.push(body.attachment);
        }

        // If no direct attachments in current payload, check if user had images in previous turns (skip for coding tasks so old images don't hijack code edits)
        if (attachmentsList.length === 0 && Array.isArray(body.messages) && !isCodingTask) {
          for (let i = body.messages.length - 1; i >= 0; i--) {
            const m = body.messages[i];
            if (m.role === "user") {
              if (Array.isArray(m.images) && m.images.length > 0) {
                m.images.forEach((imgUrl, idx) => {
                  attachmentsList.push({
                    dataUrl: imgUrl,
                    mime: "image/jpeg",
                    name: `attachment-${idx + 1}.jpg`,
                  });
                });
                break;
              } else if (m.image_url) {
                attachmentsList.push({
                  dataUrl: m.image_url,
                  mime: "image/jpeg",
                  name: "attachment-1.jpg",
                });
                break;
              }
            }
          }
        }
        const hasAttachments = attachmentsList.length > 0;

        // 1. IMAGE GENERATION / EDITING VS MULTIMODAL VISION
        const isExplicitImageGen =
          !isCodingTask &&
          (body.imageMode || (!hasAttachments && wantsImageGen(userText)));

        const isExplicitImageEdit =
          !isCodingTask &&
          !isExplicitImageGen &&
          (Boolean(body.isImageEdit) ||
            (Boolean(body.originalImageUrl) && wantsImageEdit(userText)) ||
            (hasAttachments &&
              (body.imageMode || wantsImageEdit(userText)) &&
              /\b(edit|modify|alter|recolor|turn this into|turn into|style as|filter|make it anime|make it 3d)\b/i.test(userText)));

        const isImageGen = isExplicitImageGen;
        const isImageEdit = isExplicitImageEdit;

        // If user attached image(s) for general chat / question / coding, ensure a helpful prompt
        if (hasAttachments && !isImageGen && !isImageEdit) {
          if (!userText.trim()) {
            userText =
              "Please analyze this attached image in detail. Describe what you see, read any visible text, code, numbers, diagrams, or equations, and explain the key findings.";
          } else if (/^(hi|hello|hey|yo|greetings|thanks|thank you|ok|okay)$/i.test(userText.trim())) {
            userText = `${userText.trim()}! Please also analyze the attached image I've shared. Describe what is in this image in detail and answer any questions about it.`;
          }
        }

        if (isImageGen || isImageEdit) {
          try {
            const rawPrompt =
              userText ||
              (isImageEdit
                ? "Enhance and refine this image with photorealistic detail"
                : "A stunning creative artwork");
            const cleanSubject =
              rawPrompt
                .replace(
                  /\b(generate|create|draw|make|paint|illustrate|design|render|show me|give me|bring me|an|a|the|image|picture|photo|pic|of)\b/gi,
                  "",
                )
                .trim() || rawPrompt;

            const targetRatio = body.aspectRatio || "1:1";

            if (hasAttachments) {
              // EXACT 1-TO-1 MATCHING: How many images user has, that many images AI returns!
              const targetCount = attachmentsList.length;
              const editPromises = attachmentsList.map(async (att, idx) => {
                const mime = att.mime || "image/jpeg";
                try {
                  return await editImageWithGemini(
                    att.dataUrl,
                    mime,
                    rawPrompt,
                    { aspectRatio: targetRatio },
                  );
                } catch {
                  const fallbackSubject = encodeURIComponent(cleanSubject.slice(0, 50));
                  return `https://image.pollinations.ai/prompt/${fallbackSubject}_${idx + 1}?width=1024&height=1024&nologo=true&seed=${Date.now() + idx * 13}`;
                }
              });

              const results = await Promise.all(editPromises);
              for (let i = 0; i < targetCount; i++) {
                if (results[i]) {
                  assistantImagesList.push(results[i]);
                } else {
                  const fallbackSubject = encodeURIComponent(cleanSubject.slice(0, 50));
                  assistantImagesList.push(
                    `https://image.pollinations.ai/prompt/${fallbackSubject}_${i + 1}?width=1024&height=1024&nologo=true&seed=${Date.now() + i * 13}`,
                  );
                }
              }
              assistantImage = assistantImagesList[0] || null;
            } else if (isImageEdit && body.originalImageUrl) {
              const resImg = await editImageWithGemini(
                body.originalImageUrl,
                "image/jpeg",
                rawPrompt,
                { aspectRatio: targetRatio },
              );
              assistantImagesList.push(resImg);
              assistantImage = resImg;
            } else {
              // Image generation without attachments: check how many images user asked for
              let requestedCount = 1;
              const countMatch =
                userText.match(/\b([1-6]|one|two|three|four|five|six)\s*(?:images?|pictures?|photos?|pics?|variations?|artworks?|wallpapers?)\b/i) ||
                userText.match(/\b(?:generate|create|draw|make|show|render)\s+([1-6]|one|two|three|four|five|six)\b/i);
              if (countMatch) {
                const word = countMatch[1].toLowerCase();
                const numMap: Record<string, number> = {
                  one: 1, "1": 1,
                  two: 2, "2": 2,
                  three: 3, "3": 3,
                  four: 4, "4": 4,
                  five: 5, "5": 5,
                  six: 6, "6": 6,
                };
                requestedCount = numMap[word] || Math.min(6, Math.max(1, parseInt(word) || 1));
              }

              const genPromises = Array.from({ length: requestedCount }).map(async (_, idx) => {
                try {
                  return await generateImage(`${cleanSubject}${requestedCount > 1 ? ` variation ${idx + 1}` : ""}`, {
                    aspectRatio: targetRatio,
                    speedOptimized: true,
                    style: body.imageStyle,
                  });
                } catch {
                  const fallbackSubject = encodeURIComponent(cleanSubject.slice(0, 50));
                  return `https://image.pollinations.ai/prompt/${fallbackSubject}_${idx + 1}?width=1024&height=1024&nologo=true&seed=${Date.now() + idx * 17}`;
                }
              });

              const results = await Promise.all(genPromises);
              for (let i = 0; i < requestedCount; i++) {
                if (results[i]) {
                  assistantImagesList.push(results[i]);
                } else {
                  const fallbackSubject = encodeURIComponent(cleanSubject.slice(0, 50));
                  assistantImagesList.push(
                    `https://image.pollinations.ai/prompt/${fallbackSubject}_${i + 1}?width=1024&height=1024&nologo=true&seed=${Date.now() + i * 17}`,
                  );
                }
              }
              assistantImage = assistantImagesList[0] || null;
            }

            assistantText = "";
          } catch {
            const targetCount = hasAttachments ? attachmentsList.length : 1;
            const fallbackSubject = encodeURIComponent((userText || "artwork").slice(0, 50));
            for (let i = 0; i < targetCount; i++) {
              const fbImg = `https://image.pollinations.ai/prompt/${fallbackSubject}_${i + 1}?width=1024&height=1024&nologo=true&seed=${Date.now() + i * 19}`;
              assistantImagesList.push(fbImg);
            }
            assistantImage = assistantImagesList[0] || null;
            assistantText = "";
          }
        } else {
          // 2. CHECK FOR CAPABILITY DEMONSTRATION (YouTube + Google Images integration)
          if (!isCodingTask && detectCapabilityDemonstration(userText)) {
            const [ytMedia, gImages] = await Promise.all([
              searchYouTubeMedia("Imagine Dragons Believer"),
              fetchGoogleWebImages("Taj Mahal India", 2),
            ]);

            const vidId = ytMedia?.videoId || "7wtfhZwyrcc";
            const vidTitle = ytMedia?.title || "Imagine Dragons - Believer";

            const imgList =
              gImages && gImages.length > 0
                ? gImages
                : [
                    {
                      url: "https://img-s-msn-com.akamaized.net/tenant/amp/entityid/AA29GgjK.img?w=768&h=481&m=6",
                      title: "Taj Mahal - Agra, India",
                    },
                    {
                      url: "https://img-s-msn-com.akamaized.net/tenant/amp/entityid/AA29G3wT.img?w=768&h=512&m=6",
                      title: "Taj Mahal Sunset View",
                    },
                  ];

            assistantText = [
              "Yes! I am fully integrated to **play videos directly from YouTube** and **bring live images from Google** right inside our chat.",
              "",
              "Here is a live demonstration showing both integrated capabilities in action:",
              "",
              "### 🎬 Integrated YouTube Video Player",
              `Here is **${vidTitle}** on YouTube. You can play and watch it directly here in the chat:`,
              "",
              `https://www.youtube.com/watch?v=${vidId}`,
              "",
              "### 🖼️ Real Google Images",
              "Here are live high-resolution images fetched from Google:",
              "",
              imgList.map((img) => `![${img.title}](${img.url})`).join("\n\n"),
              "",
              "---",
              "### 💡 How to use anytime:",
              "• **Play YouTube Videos**: Simply ask *'Play Believer on YouTube'*, *'Play cricket highlights'*, or *'Watch Ed Sheeran Shape of You'*, and I will embed the player right here.",
              "• **Bring Google Images**: Ask *'Bring images from Google of Taj Mahal'*, *'Show pictures of golden retrievers'*, or *'Google images of Ferrari'*, and I will display real Google Images for you.",
              "• **Live Intelligence**: All existing real-time web search, live market prices, and fast AI responses remain 100% active and fast!",
            ].join("\n");

            assistantImage = imgList[0]?.url || null;
          } else {
            // 2.1 CHECK FOR GOOGLE IMAGES REQUEST
            const gImgReq = !isCodingTask ? isGoogleImageRequest(userText) : null;
            if (gImgReq) {
              const [images, summary] = await Promise.all([
                fetchGoogleWebImages(gImgReq.topic, 4),
                fetchLiveWebGrounding(gImgReq.topic),
              ]);

              const topicName = gImgReq.topic;
              if (images && images.length > 0) {
                assistantImage = images[0].url;
                images.forEach((img) => assistantImagesList.push(img.url));
                const imgMarkdown = images
                  .map((img) => `![${img.title || topicName}](${img.url})`)
                  .join("\n\n");
                const summaryPart = summary ? `\n\n${summary}` : "";

                assistantText = [
                  `Here are real images of **${topicName}** from Google:`,
                  "",
                  imgMarkdown,
                  summaryPart,
                ]
                  .filter(Boolean)
                  .join("\n");
              } else {
                assistantText = `Here is information on **${topicName}**:\n\n${summary || "High-quality results from Google search."}`;
              }
            } else {
              // 2.2 CHECK FOR DEVICE CONTROL / APP LAUNCH REQUEST
              const devCmd = !isCodingTask ? detectDeviceCommand(userText) : null;
              if (devCmd) {
                const lines = [
                  `action: ${devCmd.action}`,
                  `app: ${devCmd.app || ""}`,
                  `title: ${devCmd.title}`,
                  `details: ${devCmd.details}`,
                  devCmd.scheme ? `scheme: ${devCmd.scheme}` : "",
                  devCmd.web_fallback ? `web_fallback: ${devCmd.web_fallback}` : "",
                  devCmd.intent ? `intent: ${devCmd.intent}` : "",
                  devCmd.number ? `number: ${devCmd.number}` : "",
                  devCmd.query ? `query: ${devCmd.query}` : "",
                ].filter(Boolean);

                assistantText = [
                  `I've sent the command to your device to **${devCmd.title}**.`,
                  "",
                  "```device_action",
                  lines.join("\n"),
                  "```",
                ].join("\n");
              } else {
                // 3. CHECK FOR YOUTUBE VIDEO REQUEST
                const videoInfo = !isCodingTask ? detectVideoRequest(userText) : null;
                if (videoInfo) {
                  const media = await searchYouTubeMedia(videoInfo.topic);
                  const vidTopic = media?.title || videoInfo.topic;
                  const vidId = media?.videoId || "jfKfPfyJRdk";
                  assistantText = [
                    `Here is **${vidTopic}** on YouTube:`,
                    "",
                    `https://www.youtube.com/watch?v=${vidId}`,
                    "",
                    `You can play and watch it directly here in the chat!`,
                  ].join("\n");
                } else {
              // 4. CHECK FOR MY AI CEO / FOUNDER QUERY
              if (detectCeoQuery(userText)) {
                assistantText =
                  "The CEO of My AI is **Bhavyash**.";
              } else {
                // 5. CHECK FOR DIRECT MATH
                const directMath = !isCodingTask ? solveMathDirectly(userText) : null;
                if (directMath && !hasAttachments) {
                  assistantText = directMath;
                } else if (isCodingTask) {
                  // 5.5 DEDICATED CODING ENGINE: Write, Edit, Explain & Solve Code
                  const modeDirective =
                    codeReq.mode === "edit"
                      ? "\n[ACTIVE TASK: EDIT / REFACTOR CODE] Apply the requested edits or refactoring accurately, output the complete updated runnable code in a fenced markdown block, and briefly highlight the changes made."
                      : codeReq.mode === "explain"
                        ? "\n[ACTIVE TASK: EXPLAIN CODE] Explain clearly what the code does, walk through its logic step-by-step, and note any important patterns, edge cases, or complexity."
                        : codeReq.mode === "solve"
                          ? "\n[ACTIVE TASK: SOLVE / DEBUG CODE] Diagnose the bug, error, or coding problem, explain the root cause or algorithm, and provide the complete working code solution."
                          : "\n[ACTIVE TASK: WRITE CODE] Write complete, clean, well-structured, runnable code in a fenced markdown block with a clear explanation of how to use it.";

                  const attachmentCodeNote = hasAttachments
                    ? `\n[CODE / ERROR SCREENSHOT ATTACHED]: Carefully read and transcribe any code, terminal output, or error stack trace in the attached image(s) and fulfill the user's request.`
                    : "";

                  const codingPrompt = `${userText}${attachmentCodeNote}`;
                  const codingConversation = await buildSanitizedMultiturnContents(
                    body.messages,
                    codingPrompt,
                    attachmentsList,
                  );

                  const codingModels = [
                    "gemini-3.1-flash-lite",
                    "gemini-3.1-flash-lite-preview",
                    "gemini-3.8-flash",
                    "gemini-flash-latest",
                    "gemini-3.1-pro-preview",
                  ];

                  for (const modelName of codingModels) {
                    try {
                      const response = await ai.models.generateContent({
                        model: modelName,
                        contents: codingConversation as any,
                        config: {
                          systemInstruction: `${CODING_SYSTEM_INSTRUCTION}\n${modeDirective}`,
                        },
                      });

                      if (response.text && response.text.trim()) {
                        assistantText = response.text.trim();
                        break;
                      }
                    } catch {
                      // Try next model
                    }
                  }

                  if (!assistantText) {
                    try {
                      const { askModel } = await import("@/lib/ai-providers.server");
                      assistantText = await askModel(
                        "myai",
                        `${CODING_SYSTEM_INSTRUCTION}\n${modeDirective}`,
                        codingPrompt,
                      );
                    } catch {
                      // ignore
                    }
                  }
                } else {
                  // 6. ULTRA-FAST REAL-TIME GROUNDING with Google Search, Wikipedia & live APIs
                  const wantsPics =
                    !hasAttachments &&
                    (/\b(photo|image|picture|pic|wallpaper)\b/i.test(userText) ||
                      /\b(show me|bring|look like|what does .+ look like)\b/i.test(userText) ||
                      /\b(photos|images|pictures|pics)\s+(of|from|about)\b/i.test(userText));
                  const electionData = !hasAttachments ? detectElectionQuery(userText) : null;
                  const isFinancialQuery = !hasAttachments && /\b(stock|crypto|bitcoin|btc|eth|sol|price|rate|rupee|inr|dollar|usd|market|valuation|net worth|gold|silver|currency|exchange)\b/i.test(userText);
                  const isSportsQuery = !hasAttachments && /\b(score|match|cricket|ipl|football|soccer|nba|nfl|tennis|who won)\b/i.test(userText);
                  const isWeatherQuery = !hasAttachments && /\b(weather|temperature|forecast|rain|climate)\b/i.test(userText);
                  
                  // Run live web search for ANY informational or real-world question unless it's just a 1-word greeting
                  const isCasualGreeting = /^(hi|hello|hey|yo|greetings|thanks|thank you|ok|okay|bye)$/i.test(userText.trim());
                  const isSearchNeeded = !hasAttachments && userText.trim().length > 1 && !isCasualGreeting;

                  // Parallel non-blocking lookups with timeouts
                  const [liveSports, liveFinancials, liveWeather, liveWiki, webImages] = await Promise.all([
                    isSportsQuery ? fetchLiveSportsScores(userText) : Promise.resolve(null),
                    isFinancialQuery ? fetchLiveFinancials(userText) : Promise.resolve(null),
                    isWeatherQuery ? fetchLiveWeather(userText) : Promise.resolve(null),
                    isSearchNeeded ? fetchLiveWebGrounding(userText) : Promise.resolve(null),
                    wantsPics ? fetchGoogleWebImages(userText) : Promise.resolve([]),
                  ]);

                  let liveContext = "";
                  if (electionData) {
                    liveContext += `\n[RECENT ELECTIONS & CERTIFIED REAL-WORLD RESULTS]:\n${electionData}\n`;
                  }
                  if (liveWiki) {
                    liveContext += `\n[REAL-TIME LIVE GOOGLE SEARCH & WEB GROUNDING]:\n${liveWiki}\n`;
                  }
                  if (liveSports) {
                    liveContext += `\n[REAL-TIME LIVE SPORTS & MATCH SCORES]:\n${liveSports}\n`;
                  }
                  if (liveWeather) {
                    liveContext += `\n[REAL-TIME WEATHER DATA]:\n${liveWeather}\n`;
                  }
                  if (liveFinancials) {
                    liveContext += `\n[LIVE FINANCIAL MARKET & CURRENCY EXCHANGE DATA]:\n${liveFinancials}\n`;
                  }
                  if (webImages && webImages.length > 0) {
                    const firstUrl = typeof webImages[0] === "string" ? webImages[0] : webImages[0].url;
                    if (!assistantImage) {
                      assistantImage = firstUrl;
                    }
                    const imgLines = webImages.map((u: any) => {
                      const url = typeof u === "string" ? u : u.url;
                      const title = typeof u === "string" ? "Google Image" : u.title || "Google Image";
                      return `![${title}](${url})`;
                    });
                    liveContext += `\n[RELEVANT GOOGLE / WEB IMAGES TO EMBED]:\n${imgLines.join("\n")}\n(Please embed these relevant images directly in markdown into your final answer!)\n`;
                  }
                  if (hasAttachments) {
                    liveContext += `\n[MULTIMODAL IMAGE ANALYSIS INSTRUCTION]: The user has attached ${attachmentsList.length} image(s) (either uploaded or snapped live with device camera). Thoroughly analyze all visible elements: identify objects, read and extract any text/numbers (OCR), interpret graphs or diagrams, diagnose errors or code screenshots, and provide clear, comprehensive insights.\n`;
                  }

                  // Check if the user is asking for a PDF document or a Spreadsheet / Excel / CSV table
                  const wantsPdfDoc = /\b(pdf|document|report|invoice|resume|letter|contract|proposal|certificate|syllabus|guide)\b/i.test(userText);
                  const wantsSpreadsheet = /\b(spreadsheet|excel|xlsx|xls|csv|sheet|table|schedule|budget|ledger|tracker|roster|inventory)\b/i.test(userText);

                  if (wantsPdfDoc) {
                    liveContext += `\n[PDF GENERATION & EDITING INSTRUCTION]: The user is requesting to generate or edit a PDF document. Write a complete, well-structured, professional document using clear Markdown headings (#, ##, ###), bullet points, and tables where appropriate. Do NOT say you cannot create PDFs — our interface automatically compiles your response into a downloadable & editable PDF document for the user!\n`;
                  }
                  if (wantsSpreadsheet) {
                    liveContext += `\n[SPREADSHEET / EXCEL / CSV GENERATION & EDITING INSTRUCTION]: The user is requesting to generate or edit a spreadsheet, Excel sheet, or table. You MUST include a complete, well-structured Markdown Table (| Column 1 | Column 2 | ...) with realistic, thorough rows and columns fulfilling their request. If they provided existing spreadsheet/CSV rows or asked to edit columns/cells, apply their exact edits to the table. Do NOT say you cannot create spreadsheets or Excel files — our interface automatically renders your Markdown table inside an interactive Spreadsheet Editor with 1-click CSV, Excel (.xls), and PDF export!\n`;
                  }

                  const promptWithLiveContext = liveContext
                    ? `${userText}\n\n[REAL-TIME LIVE GOOGLE SEARCH RESULTS & CURRENT REAL-WORLD FACTS (OCTOBER 2026)]:\n${liveContext}\n\n(IMPORTANT INSTRUCTION: Use the above real-time Google search and live market results to answer the user's question accurately with 100% up-to-date facts, current exchange rates, and current leaders. Convert and synthesize this into your own natural, concise, direct answer as My AI.)`
                    : userText;

                  // Build sanitized, strictly alternating multiturn contents for Gemini
                  const conversationContents = await buildSanitizedMultiturnContents(
                    body.messages,
                    promptWithLiveContext,
                    attachmentsList,
                  );

                  // Fast, reliable models pool with live search data embedded
                  const candidateModels = [
                    "gemini-3.1-flash-lite",
                    "gemini-3.1-flash-lite-preview",
                    "gemini-3.8-flash",
                    "gemini-flash-latest",
                    "gemini-3.1-pro-preview",
                  ];

                  for (const modelName of candidateModels) {
                    try {
                      const response = await ai.models.generateContent({
                        model: modelName,
                        contents: conversationContents as any,
                        config: {
                          systemInstruction: SYSTEM_INSTRUCTION,
                        },
                      });

                      if (response.text) {
                        assistantText = response.text.trim();
                        break;
                      }
                    } catch {
                      // Try next model
                    }
                  }

                  // Robust LLM fallback via multi-provider pool
                  if (!assistantText) {
                    try {
                      const { askModel } = await import("@/lib/ai-providers.server");
                      assistantText = await askModel("myai", SYSTEM_INSTRUCTION, promptWithLiveContext);
                    } catch {
                      // ignore
                    }
                  }

                  // Direct synthesis fallback if needed
                  if (!assistantText) {
                    if (liveSports) {
                      assistantText = liveSports;
                    } else if (liveWeather) {
                      assistantText = liveWeather;
                    } else if (liveFinancials) {
                      assistantText = `Here is the current live value:\n\n${liveFinancials}`;
                    } else if (liveWiki) {
                      assistantText = liveWiki;
                    } else {
                      assistantText = `Here is the up-to-date information for **${userText}**. Let me know if you need more details!`;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

        // Scrub any internal model identity or model names so user never sees Gemini/Flash
        if (assistantText) {
          assistantText = assistantText
            .replace(/\b(?:gemini[- ]3\.[0-9][- ]flash(?:[- ]lite)?(?:[- ]image)?|gemini[- ]flash(?:[- ]latest)?)\b/gi, "My AI")
            .replace(/\b(?:as an ai developed by google|as gemini|i am gemini)\b/gi, "I am My AI");
        }

        const msgId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const createdAt = new Date().toISOString();
        const finalImages = assistantImagesList.length > 0
          ? assistantImagesList
          : assistantImage
            ? [assistantImage]
            : [];

        return new Response(
          JSON.stringify({
            id: msgId,
            role: "assistant",
            content: assistantText || (assistantImage ? "" : "I have received your message. How can I assist you further?"),
            image_url: assistantImage || null,
            imageUrl: assistantImage || null,
            images: finalImages,
            created_at: createdAt,
            message: {
              id: msgId,
              role: "assistant",
              content: assistantText || (assistantImage ? "" : "I have received your message. How can I assist you further?"),
              image_url: assistantImage || null,
              imageUrl: assistantImage || null,
              images: finalImages,
              created_at: createdAt,
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    },
  },
});
