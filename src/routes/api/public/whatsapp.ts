import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

/**
 * WhatsApp Business Cloud API webhook.
 *
 * Configure in Meta App Dashboard:
 *   Callback URL: https://<your-site>/api/public/whatsapp
 *   Verify token: value of env WHATSAPP_VERIFY_TOKEN
 *
 * Required env vars (add later via secrets):
 *   WHATSAPP_VERIFY_TOKEN    — you pick any random string; enter same value in Meta.
 *   WHATSAPP_ACCESS_TOKEN    — Permanent System User token from Meta.
 *   WHATSAPP_PHONE_NUMBER_ID — the phone_number_id of the WABA number.
 *
 * When a customer messages your WhatsApp number, this endpoint asks the
 * connected AI to reply in the voice of your business profile.
 */

const GRAPH_VERSION = "v21.0";

async function replyWithAI(opts: {
  incomingText: string;
  businessName: string;
  businessDesc: string;
  website: string | null;
}): Promise<string> {
  const system = `You are the professional, friendly customer support and sales assistant for "${opts.businessName}".
Current Date: October 2026.
Reply concisely (1-3 sentences maximum), warmly, politely, and in the customer's exact language.
${opts.businessDesc ? `About our business: ${opts.businessDesc}` : ""}
${opts.website ? `Official Website: ${opts.website}` : ""}
Never invent unverified prices or inventory — offer to connect them with a human specialist if needed. Fulfill questions directly.`;

  // 1. Primary fast AI API
  if (process.env.GEMINI_API_KEY) {
    try {
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: { headers: { "User-Agent": "aistudio-build" } },
      });
      for (const model of ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-flash-latest", "gemini-3.8-flash"]) {
        try {
          const res = await ai.models.generateContent({
            model,
            contents: opts.incomingText,
            config: {
              systemInstruction: system,
              maxOutputTokens: 1024,
            },
          });
          if (res.text && res.text.trim()) {
            return res.text.trim();
          }
        } catch {
          // try next model
        }
      }
    } catch {
      // fallback
    }
  }

  // 2. Perplexity fallback if configured
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "sonar",
          messages: [
            { role: "system", content: system },
            { role: "user", content: opts.incomingText },
          ],
        }),
      });
      if (res.ok) {
        const j: any = await res.json();
        const reply = j?.choices?.[0]?.message?.content?.toString().trim();
        if (reply) return reply;
      }
    } catch {
      // fallback
    }
  }

  return `Hello! Thanks for messaging ${opts.businessName}. We have received your inquiry and will assist you shortly. Let us know if you need any specific details!`;
}

async function sendWhatsAppMessage(to: string, body: string) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) {
    console.warn("[whatsapp] Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID — skipping send.");
    return;
  }
  const r = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: body.slice(0, 4000) },
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    console.error("[whatsapp] send failed", r.status, t);
  }
}

export const Route = createFileRoute("/api/public/whatsapp")({
  server: {
    handlers: {
      // Meta verification handshake
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

        if (!verifyToken) return new Response("Verify token not configured", { status: 500 });
        if (mode === "subscribe" && token === verifyToken && challenge) {
          return new Response(challenge, { status: 200, headers: { "content-type": "text/plain" } });
        }
        return new Response("Forbidden", { status: 403 });
      },

      // Incoming messages
      POST: async ({ request }) => {
        const payload: any = await request.json().catch(() => null);
        if (!payload) return new Response("ok"); // ack anyway so Meta stops retrying

        try {
          const entries = payload.entry ?? [];
          for (const entry of entries) {
            for (const change of entry.changes ?? []) {
              const value = change.value;
              const messages = value?.messages ?? [];
              const contacts = value?.contacts ?? [];
              const displayName = contacts[0]?.profile?.name ?? "customer";

              for (const msg of messages) {
                if (msg.type !== "text") continue;
                const from: string = msg.from;
                const incoming: string = msg.text?.body ?? "";
                if (!incoming) continue;

                // Look up first configured WhatsApp business profile (single-tenant).
                const supabase = createClient(
                  process.env.SUPABASE_URL!,
                  process.env.SUPABASE_SERVICE_ROLE_KEY!,
                  { auth: { persistSession: false, autoRefreshToken: false, storage: undefined } },
                );
                const { data: profile } = await supabase
                  .from("business_profiles")
                  .select("business_name, description, website")
                  .eq("channel", "whatsapp")
                  .order("updated_at", { ascending: false })
                  .limit(1)
                  .maybeSingle();

                if (!profile) {
                  console.warn("[whatsapp] no business profile connected — ignoring message");
                  continue;
                }

                const reply = await replyWithAI({
                  incomingText: `From ${displayName}: ${incoming}`,
                  businessName: profile.business_name,
                  businessDesc: profile.description ?? "",
                  website: profile.website,
                });

                await sendWhatsAppMessage(from, reply);
              }
            }
          }
        } catch (e) {
          console.error("[whatsapp] handler error", e);
        }

        // Always 200 so Meta doesn't retry.
        return new Response("ok", { status: 200 });
      },
    },
  },
});
