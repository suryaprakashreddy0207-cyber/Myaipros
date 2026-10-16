import { createFileRoute } from "@tanstack/react-router";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: { headers: { "User-Agent": "aistudio-build" } },
});

type TranscribeBody = {
  audioDataUrl?: string;
  language?: string;
};

export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as TranscribeBody;
          if (!body?.audioDataUrl) {
            return new Response(
              JSON.stringify({ error: "Missing audioDataUrl", transcript: "" }),
              { status: 400, headers: { "content-type": "application/json" } },
            );
          }

          let mimeType = "audio/webm";
          let base64Data = body.audioDataUrl;

          if (body.audioDataUrl.startsWith("data:")) {
            const commaIdx = body.audioDataUrl.indexOf(",");
            if (commaIdx !== -1) {
              const header = body.audioDataUrl.slice(5, commaIdx);
              base64Data = body.audioDataUrl.slice(commaIdx + 1);
              const rawMime = header.split(";")[0]?.trim();
              if (rawMime) {
                mimeType = rawMime;
              }
            }
          }

          if (!base64Data || base64Data.length < 50) {
            return new Response(
              JSON.stringify({ transcript: "", success: false, reason: "audio buffer too short" }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }

          const targetLang = body.language || "en-US";
          const prompt = `Accurately transcribe all spoken speech in this audio recording into text verbatim.
Target language context: ${targetLang}.
Strict rules:
1. Return ONLY the transcribed text words spoken by the user.
2. Do not include introductory notes, timestamps, explanations, or quotes.
3. If the audio contains only silence, breathing, or background noise, return an empty string.`;

          let transcript = "";

          // Use valid neural AI models for accurate audio transcription
          const transcribeModels = [
            "gemini-3.5-transcribe",
            "gemini-3.5-flash",
            "gemini-3.5-flash-lite",
            "gemini-flash-latest",
          ];
          for (const model of transcribeModels) {
            try {
              const response = await ai.models.generateContent({
                model,
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

              if (response.text && response.text.trim()) {
                transcript = response.text.trim();
                break;
              }
            } catch {
              // try next model
            }
          }

          // Clean up any artifact quotes or "Transcribed: " prefixes
          transcript = transcript
            .replace(/^["'`]+|["'`]+$/g, "")
            .replace(/^(transcription|transcript|spoken words):\s*/i, "")
            .trim();

          return new Response(
            JSON.stringify({
              transcript,
              success: Boolean(transcript),
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        } catch (err: any) {
          return new Response(
            JSON.stringify({ error: err?.message || "Failed to transcribe", transcript: "" }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }
      },
    },
  },
});
