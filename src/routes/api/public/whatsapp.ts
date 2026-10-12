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
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) return "Thanks for reaching out — we'll get back to you shortly.";

  const system = `You are the customer support agent for "${opts.businessName}".
Reply concisely (max 3 short sentences), warmly, and in the customer's language.
${opts.businessDesc ? `About the business: ${opts.businessDesc}` : ""}
${opts.website ? `Website: ${opts.website}` : ""}
Never invent prices or availability you don't know — say you'll check and follow up.`;

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
  if (!res.ok) return "Thanks — we've received your message and will reply soon.";
  const j: any = await res.json();
  return j?.choices?.[0]?.message?.content?.toString().trim() || "Thanks — we'll be in touch.";
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
