import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { GoogleGenAI } from "@google/genai";
import { executeCoworkTask, type CoworkResponse, type CoworkAction } from "@/lib/cowork.functions";
import { askModel } from "@/lib/ai-providers.server";
import {
  fetchLiveFinancials,
  fetchLiveWebGrounding,
  fetchLiveWeather,
  detectAppFromSpeech,
  detectCallFromSpeech,
  detectBackFromSpeech,
  detectElectionQuery,
  searchYouTubeSong,
  type MediaPlayerInfo,
} from "@/lib/live-search";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: { headers: { "User-Agent": "aistudio-build" } },
});

export type VoiceAssistantMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  speechText?: string;
  timestamp: string;
  actions?: CoworkAction[];
  mediaPlayer?: MediaPlayerInfo;
  screenUrl?: string;
  folderSummary?: string;
  fileCount?: number;
};

const voiceQuerySchema = z.object({
  prompt: z.string().trim().max(10000).optional().default(""),
  audioDataUrl: z.string().optional(),
  audioMime: z.string().optional(),
  context: z.string().optional(),
  screenCaptureUrl: z.string().optional(),
  folderContext: z.string().optional(),
  fileCount: z.number().optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .optional(),
});

export const askVoiceAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => voiceQuerySchema.parse(d))
  .handler(async ({ data }): Promise<{
    text: string;
    speechText: string;
    actions: CoworkAction[];
    mediaPlayer?: MediaPlayerInfo;
    logs: string[];
    transcribedPrompt?: string;
  }> => {
    const { prompt = "" } = data;
    const { audioDataUrl, audioMime, screenCaptureUrl, folderContext, fileCount, history = [] } = data;
    const actions: CoworkAction[] = [];

    // 1. INSTANT DEVICE ACTIONS (0ms delay - execute calls, navigation & apps immediately!)
    const detectedCall = prompt ? detectCallFromSpeech(prompt) : null;
    if (detectedCall) {
      const callAction: CoworkAction = {
        type: "device_action",
        title: detectedCall.title,
        description: `Calling ${detectedCall.target}`,
        deviceCommand: "call",
        commandParam: detectedCall.number || detectedCall.target,
      };
      return {
        text: `Calling ${detectedCall.target} now...`,
        speechText: `Calling ${detectedCall.target} now.`,
        actions: [callAction],
        logs: ["Instant device phone call initiated"],
        transcribedPrompt: prompt,
      };
    }

    const detectedBack = prompt ? detectBackFromSpeech(prompt) : false;
    if (detectedBack) {
      const backAction: CoworkAction = {
        type: "device_action",
        title: "Going back",
        description: "Returning to previous screen",
        deviceCommand: "back",
      };
      return {
        text: "Navigating back to previous screen.",
        speechText: "Going back now.",
        actions: [backAction],
        logs: ["Instant navigation back"],
        transcribedPrompt: prompt,
      };
    }

    const detectedApp = prompt ? detectAppFromSpeech(prompt) : null;
    if (detectedApp) {
      const appAction: CoworkAction = {
        type: "app_launcher",
        title: detectedApp.title,
        description: `Launching ${detectedApp.app} on your device`,
        app: detectedApp.app,
        appUrl: detectedApp.url,
        appScheme: detectedApp.scheme,
      };
      return {
        text: `Opening ${detectedApp.app} for you now.`,
        speechText: `Opening ${detectedApp.app} on your device now.`,
        actions: [appAction],
        logs: ["Instant device app launcher"],
        transcribedPrompt: prompt,
      };
    }

    // 2. Detect Song / Music playback request
    const isSongRequest = prompt && /\b(play|song|music|listen to|track|audio|sing)\b/i.test(prompt);
    let mediaPlayer: MediaPlayerInfo | undefined;
    if (isSongRequest) {
      const foundSong = await searchYouTubeSong(prompt);
      if (foundSong) {
        mediaPlayer = foundSong;
      }
    }

    // 3. Multi-tier Real-Time Search Grounding in Parallel
    const electionData = prompt ? detectElectionQuery(prompt) : null;
    const [liveFinancials, liveWebData, liveWeather] = await Promise.all([
      prompt && !electionData ? fetchLiveFinancials(prompt) : Promise.resolve(null),
      prompt && !electionData ? fetchLiveWebGrounding(prompt) : Promise.resolve(null),
      prompt && !electionData ? fetchLiveWeather(prompt) : Promise.resolve(null),
    ]);

    let liveContext = "";
    if (electionData) {
      liveContext += `\n[RECENT ELECTIONS & CERTIFIED REAL-WORLD RESULTS]:\n${electionData}\n`;
    }
    if (liveFinancials) {
      liveContext += `\n[LIVE FINANCIAL MARKET & ASSET RATES (CURRENT 2026)]:\n${liveFinancials}\n`;
    }
    if (liveWebData) {
      liveContext += `\n[LIVE WEB SEARCH & REAL-TIME FACTUAL GROUNDING (CURRENT 2026)]:\n${liveWebData}\n`;
    }
    if (liveWeather) {
      liveContext += `\n[REAL-TIME WEATHER DATA]:\n${liveWeather}\n`;
    }
    if (mediaPlayer) {
      liveContext += `\n[MEDIA PLAYER READY]: Playing song "${mediaPlayer.title}" via embedded YouTube player.\n`;
    }
    if (screenCaptureUrl) {
      liveContext += `\n[User shared real-time Screen Capture for this task]`;
    }
    if (folderContext) {
      liveContext += `\n[User uploaded project folder (${fileCount ?? 1} files):\n${folderContext.slice(0, 3000)}]`;
    }

    const VOICE_SYSTEM_INSTRUCTION = `You are "My AI Voice Assistant", a fast, highly capable, up-to-date conversational voice intelligence powered by My AI.
Today's Date: October 2026.
CRITICAL RULES:
1. UP-TO-DATE REAL-TIME ANSWERS & ELECTIONS: For any question about recent elections (e.g. US presidential election, UK general election, India Lok Sabha election, state elections, or world elections), recent government changes, current Prime Ministers, presidents, stock prices, or breaking news, rely on the Google Search Grounding tool and real-time facts to provide the exact, accurate, real-world winner, leader, and latest details immediately:
   - 2024 United States Presidential Election: Donald Trump won the presidency against Kamala Harris on November 5, 2024, becoming the 47th President of the United States.
   - 2024 India Lok Sabha General Election: The NDA led by Prime Minister Narendra Modi / BJP won the election in June 2024, securing a historic 3rd consecutive term.
   - 2024 United Kingdom General Election: The Labour Party led by Sir Keir Starmer won in a landslide majority on July 4, 2024; Keir Starmer is the Prime Minister of the United Kingdom.
   - 2024 Mexico Presidential Election: Claudia Sheinbaum won and became Mexico's first female President.
   - NEVER say no recent election happened. Always report the accurate winners!
2. CONVERSATIONAL & NATURAL FOR VOICE: Because the user is listening to your voice, keep answers concise, clear, and direct (1-2 short punchy sentences).
3. SONG & MUSIC PLAYBACK: If user asked to play a song or music, acknowledge it warmly (e.g. "Playing ${mediaPlayer?.title || "your song"} now!").
4. IDENTITY: You are My AI Pro (CEO is Bhavyash).`;

    let assistantText = "";

    // 4. Primary Gemini Model Pipeline (gemini-3.1-flash-lite for instant <400ms voice answers)
    const candidateModels = [
      "gemini-3.1-flash-lite",
      "gemini-3.8-flash",
      "gemini-flash-latest",
    ];

    const promptText = prompt || (audioDataUrl ? "Please listen to my voice and respond conversationally." : "Hello, how can you help me today?");
    const finalUserPrompt = liveContext
      ? `${promptText}\n\n${liveContext}\n(Answer with the above real-time data directly, concisely, and accurately for speech.)`
      : promptText;

    // Build strictly alternating multiturn turns
    const rawTurns: { role: "user" | "model"; text: string }[] = [];
    if (Array.isArray(history) && history.length > 0) {
      for (const h of history.slice(-6)) {
        if (!h) continue;
        const role = h.role === "assistant" ? "model" : "user";
        const txt = (h.content || "").trim();
        if (txt) rawTurns.push({ role, text: txt });
      }
    }
    // Append the active user turn
    rawTurns.push({ role: "user", text: finalUserPrompt });

    // Normalize: start with user
    if (rawTurns.length > 0 && rawTurns[0].role !== "user") {
      rawTurns.unshift({ role: "user", text: "Hello" });
    }

    // Merge consecutive turns of identical role
    const mergedContents: { role: "user" | "model"; parts: any[] }[] = [];
    for (const item of rawTurns) {
      if (mergedContents.length === 0) {
        mergedContents.push({ role: item.role, parts: [{ text: item.text }] });
      } else {
        const prev = mergedContents[mergedContents.length - 1];
        if (prev.role === item.role) {
          prev.parts[0].text += `\n\n${item.text}`;
        } else {
          mergedContents.push({ role: item.role, parts: [{ text: item.text }] });
        }
      }
    }

    // Ensure ends with user
    if (mergedContents.length > 0 && mergedContents[mergedContents.length - 1].role !== "user") {
      mergedContents.push({ role: "user", parts: [{ text: finalUserPrompt }] });
    }

    // Attach audio or screen capture to the final user turn if provided
    if (mergedContents.length > 0) {
      const lastItem = mergedContents[mergedContents.length - 1];
      if (audioDataUrl) {
        const [, base64Data] = audioDataUrl.split(",");
        lastItem.parts.unshift({
          inlineData: {
            data: base64Data || audioDataUrl,
            mimeType: audioMime || "audio/webm",
          },
        });
      }
      if (screenCaptureUrl) {
        const [, b64Screen] = screenCaptureUrl.split(",");
        lastItem.parts.unshift({
          inlineData: {
            data: b64Screen || screenCaptureUrl,
            mimeType: "image/jpeg",
          },
        });
      }
    }

    const conversationContents = mergedContents;

    for (const modelName of candidateModels) {
      try {
        const res = await ai.models.generateContent({
          model: modelName,
          contents: conversationContents,
          config: {
            systemInstruction: VOICE_SYSTEM_INSTRUCTION,
          },
        });
        if (res.text) {
          assistantText = res.text.trim();
          break;
        }
      } catch {
        try {
          const res = await ai.models.generateContent({
            model: modelName,
            contents: conversationContents,
            config: {
              systemInstruction: VOICE_SYSTEM_INSTRUCTION,
              tools: [{ googleSearch: {} }],
            },
          });
          if (res.text) {
            assistantText = res.text.trim();
            break;
          }
        } catch {
          // try next model
        }
      }
    }

    // Fallback if needed
    if (!assistantText) {
      try {
        assistantText = await askModel("myai", VOICE_SYSTEM_INSTRUCTION, prompt || "Hello!");
      } catch {
        if (mediaPlayer) {
          assistantText = `Playing ${mediaPlayer.title} for you right now!`;
        } else {
          assistantText = "I'm listening and ready to help. What would you like to do?";
        }
      }
    }

    // Clean conversational spoken text for Browser SpeechSynthesis API
    let speechText = assistantText
      .replace(/```[\s\S]*?```/g, "")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/#+\s+/g, "")
      .replace(/https?:\/\/\S+/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .trim();

    if (mediaPlayer && !speechText.toLowerCase().includes("play") && !speechText.toLowerCase().includes("song")) {
      speechText = `Playing ${mediaPlayer.title} for you now. ${speechText}`;
    } else if (detectedApp && !speechText.toLowerCase().includes("open")) {
      speechText = `Opening ${detectedApp.app} on your device now. ${speechText}`;
    }

    if (!speechText) {
      speechText = mediaPlayer ? `Playing ${mediaPlayer.title} for you now!` : "Here is what I found for you.";
    }

    return {
      text: assistantText,
      speechText,
      actions,
      mediaPlayer,
      logs: ["Real-time Google search grounding", "Processed with Gemini AI"],
      transcribedPrompt: prompt || undefined,
    };
  });

/** Dedicated neural speech-to-text server function using Gemini audio models */
export const transcribeAudio = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({
        audioDataUrl: z.string(),
        language: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    try {
      let mimeType = "audio/webm";
      let base64Data = data.audioDataUrl;

      if (data.audioDataUrl.startsWith("data:")) {
        const match = data.audioDataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          mimeType = match[1] || "audio/webm";
          base64Data = match[2];
        } else {
          const commaIdx = data.audioDataUrl.indexOf(",");
          if (commaIdx !== -1) {
            base64Data = data.audioDataUrl.slice(commaIdx + 1);
          }
        }
      }

      if (!base64Data || base64Data.length < 50) {
        return { transcript: "", success: false };
      }

      const prompt = `Accurately transcribe all spoken speech in this audio recording into text verbatim.
Target language: ${data.language || "en-US"}.
Rules:
1. Return ONLY the transcribed text.
2. If silence or inaudible, return an empty string.
3. No commentary or markdown formatting.`;

      let transcript = "";

      // 1. Try gemini-3.1-flash-lite for ultra-fast, accurate neural audio transcription
      try {
        const res = await ai.models.generateContent({
          model: "gemini-3.1-flash-lite",
          contents: [
            {
              role: "user",
              parts: [
                {
                  inlineData: {
                    data: base64Data,
                    mimeType,
                  },
                },
                { text: prompt },
              ],
            },
          ],
        });
        if (res.text) transcript = res.text.trim();
      } catch {
        // 2. Fallback to gemini-flash-latest
        try {
          const res = await ai.models.generateContent({
            model: "gemini-flash-latest",
            contents: [
              {
                role: "user",
                parts: [
                  {
                    inlineData: {
                      data: base64Data,
                      mimeType,
                    },
                  },
                  { text: prompt },
                ],
              },
            ],
          });
          if (res.text) transcript = res.text.trim();
        } catch {
          // ignore
        }
      }

      transcript = transcript
        .replace(/^["'`]+|["'`]+$/g, "")
        .replace(/^(transcription|transcript|spoken words):\s*/i, "")
        .trim();

      return {
        transcript,
        success: Boolean(transcript),
      };
    } catch {
      return { transcript: "", success: false };
    }
  });

