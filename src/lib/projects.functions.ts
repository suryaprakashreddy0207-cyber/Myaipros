import { createServerFn } from "@tanstack/react-start";
import { askModel } from "@/lib/ai-providers.server";
import { GoogleGenAI } from "@google/genai";
import { fetchLiveWebGrounding, fetchLiveFinancials } from "@/lib/live-search";
import { z } from "zod";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: { headers: { "User-Agent": "aistudio-build" } },
});

const askProjectSchema = z.object({
  projectId: z.string(),
  projectTitle: z.string(),
  projectInstructions: z.string().optional(),
  sourcesContext: z.string().optional(),
  userMessage: z.string(),
  conversationHistory: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    }),
  ).optional(),
});

export const sendProjectChatMessage = createServerFn({ method: "POST" })
  .validator((d: unknown) => askProjectSchema.parse(d))
  .handler(async ({ data }) => {
    const {
      projectTitle,
      projectInstructions,
      sourcesContext,
      userMessage,
      conversationHistory = [],
    } = data;

    let systemPrompt = `You are My AI, personal intelligence assistant for project "${projectTitle}".
Today's Date: October 2026.
You provide clear, accurate, insightful analysis, code writing, and direct answers grounded in live real-world data and connected sources.`;

    if (projectInstructions && projectInstructions.trim()) {
      systemPrompt += `\n\nProject Guidelines & Custom Instructions:\n${projectInstructions.trim()}`;
    }

    if (sourcesContext && sourcesContext.trim()) {
      systemPrompt += `\n\nConnected Project Sources (Google Drive, Google Sheets, Gmail, Files):\n${sourcesContext.trim()}`;
      systemPrompt += `\nAlways use and reference these connected sources when relevant to answer the user's questions accurately.`;
    }

    // Check if query needs live search grounding
    const isFinancial = /\b(rupee|inr|dollar|usd|rate|price|value|stock|crypto|bitcoin|currency|exchange)\b/i.test(userMessage);
    const [liveSearch, liveFinancials] = await Promise.all([
      fetchLiveWebGrounding(userMessage).catch(() => null),
      isFinancial ? fetchLiveFinancials(userMessage).catch(() => null) : Promise.resolve(null),
    ]);

    let liveGrounding = "";
    if (liveSearch) liveGrounding += `\n[REAL-TIME LIVE SEARCH GROUNDING]:\n${liveSearch}`;
    if (liveFinancials) liveGrounding += `\n[REAL-TIME FINANCIAL & CURRENCY DATA]:\n${liveFinancials}`;

    const effectiveUserPrompt = liveGrounding
      ? `${userMessage}\n\n${liveGrounding}\n(Please use the above real-time data to answer accurately and freshly as My AI.)`
      : userMessage;

    // Format chat history into strictly alternating multiturn contents
    const turns: { role: "user" | "model"; parts: any[] }[] = [];
    if (conversationHistory.length > 0) {
      for (const m of conversationHistory.slice(-8)) {
        if (!m?.content) continue;
        turns.push({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        });
      }
    }
    turns.push({
      role: "user",
      parts: [{ text: effectiveUserPrompt }],
    });

    // Ensure strictly alternating
    const sanitizedTurns: { role: "user" | "model"; parts: any[] }[] = [];
    for (const t of turns) {
      if (sanitizedTurns.length === 0) {
        if (t.role !== "user") sanitizedTurns.push({ role: "user", parts: [{ text: "Hello" }] });
        sanitizedTurns.push(t);
      } else {
        const prev = sanitizedTurns[sanitizedTurns.length - 1];
        if (prev.role === t.role) {
          prev.parts[0].text += `\n\n${t.parts[0].text}`;
        } else {
          sanitizedTurns.push(t);
        }
      }
    }

    // 1. Fast & reliable Gemini generation
    const models = ["gemini-3.1-flash-lite", "gemini-3.8-flash", "gemini-flash-latest"];
    for (const model of models) {
      try {
        const res = await ai.models.generateContent({
          model,
          contents: sanitizedTurns as any,
          config: {
            systemInstruction: systemPrompt,
          },
        });
        if (res.text && res.text.trim()) {
          return { reply: res.text.trim() };
        }
      } catch {
        // try next model
      }
    }

    // 2. Fallback to askModel pool
    try {
      const reply = await askModel("myai", systemPrompt, effectiveUserPrompt);
      if (reply) return { reply };
    } catch {
      // ignore
    }

    // 3. Resilient fallback with live info or project summary
    return {
      reply: liveSearch || liveFinancials
        ? `${liveSearch || ""}\n\n${liveFinancials || ""}`.trim()
        : `I've analyzed your project "${projectTitle}". ${
            sourcesContext
              ? "Based on your connected sources, let me know how you'd like to proceed!"
              : "Feel free to ask any question or connect Google Drive, Google Sheets, or Gmail in the Sources tab for deep context."
          }`,
    };
  });
