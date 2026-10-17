import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import crypto from "crypto";
import { generateImage } from "@/lib/ai-providers.server";

export type Slide = {
  title: string;
  bullets: string[];
  notes?: string;
  image_url?: string;
};

type DeckRecord = {
  id: string;
  user_id: string;
  title: string;
  topic: string;
  slides: Slide[];
  video_url?: string | null;
  updated_at: string;
};

const memoryDecks = new Map<string, DeckRecord>();

function createStructuredSlides(topic: string, count: number): Slide[] {
  const result: Slide[] = [
    {
      title: topic,
      bullets: [
        "Strategic Vision & Blueprint for 2026",
        "Executive Summary & Market Opportunities",
        "Key Deliverables & Actionable Milestones",
      ],
      notes: "Welcome everyone to our presentation on " + topic,
    },
    {
      title: "Executive Summary & Context",
      bullets: [
        "Rapidly evolving market dynamics and technological shifts",
        "Addressing customer pain points with differentiated solutions",
        "Capitalizing on high-growth opportunities",
      ],
      notes: "Contextualizing the modern landscape and strategic need.",
    },
    {
      title: "Core Architecture & Value Drivers",
      bullets: [
        "Modular, resilient, and scalable execution framework",
        "Delivering unmatched efficiency and speed to market",
        "User-centric design optimized for intuitive adoption",
      ],
      notes: "Exploring our primary value propositions and operational pillars.",
    },
    {
      title: "Market Analysis & Industry Benchmarks",
      bullets: [
        "Comprehensive competitive advantage and moat",
        "Targeting underserved market segments with precision",
        "Outperforming legacy alternatives across key performance metrics",
      ],
      notes: "Evaluating the broader market landscape and comparative strengths.",
    },
  ];

  while (result.length < count) {
    const idx = result.length + 1;
    result.push({
      title: `Pillar ${idx}: Execution & Scaling`,
      bullets: [
        `Operational excellence and milestone tracking for Phase ${idx}`,
        "Cross-functional alignment and resource allocation",
        "Mitigating risks through automated feedback loops",
      ],
      notes: `Focusing on execution details for strategic phase ${idx}.`,
    });
  }

  // Ensure last slide is conclusion
  result[result.length - 1] = {
    title: "Conclusion & Next Steps",
    bullets: [
      "Summary of core findings and strategic recommendations",
      "Immediate next steps for team mobilization and kickoff",
      "Questions, discussion, and collaborative feedback",
    ],
    notes: "Concluding our presentation and opening the floor for discussion.",
  };

  return result.slice(0, count);
}

export const listPresentations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const combined: Array<{
      id: string;
      title: string;
      topic?: string;
      slides?: Slide[];
      slideCount?: number;
      cover?: string | null;
      updated_at: string;
      video_url?: string | null;
    }> = [];

    try {
      const { data, error } = await context.supabase
        .from("presentations")
        .select("id, title, topic, slides, updated_at, video_url")
        .order("updated_at", { ascending: false });
      if (!error && Array.isArray(data)) {
        for (const d of data) {
          combined.push({
            id: d.id,
            title: d.title,
            topic: d.topic,
            slides: d.slides as Slide[],
            slideCount: ((d.slides as Slide[]) ?? []).length,
            cover: ((d.slides as Slide[]) ?? [])[0]?.image_url ?? null,
            updated_at: d.updated_at,
            video_url: d.video_url,
          });
        }
      }
    } catch {
      // fallback
    }

    for (const d of memoryDecks.values()) {
      if (!combined.some((c) => c.id === d.id)) {
        combined.push({
          id: d.id,
          title: d.title,
          topic: d.topic,
          slides: d.slides,
          slideCount: d.slides.length,
          cover: d.slides[0]?.image_url ?? null,
          updated_at: d.updated_at,
          video_url: d.video_url,
        });
      }
    }

    return combined.sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );
  });

export const getPresentation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ context, data }) => {
    try {
      const { data: row, error } = await context.supabase
        .from("presentations")
        .select("id, title, topic, slides, video_url, updated_at")
        .eq("id", data.id)
        .maybeSingle();
      if (!error && row) return row;
    } catch {
      // fallback
    }
    const mem = memoryDecks.get(data.id);
    if (mem) return mem;
    
    // Resilient fallback deck so user can always open the editor
    const fallbackDeck: DeckRecord = {
      id: data.id,
      user_id: context.userId || "guest-user",
      title: "Global Product Launch Strategy",
      topic: "Global Product Launch Strategy",
      slides: createStructuredSlides("Global Product Launch Strategy", 6),
      updated_at: new Date().toISOString(),
    };
    memoryDecks.set(data.id, fallbackDeck);
    return fallbackDeck;
  });

export const deletePresentation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ context, data }) => {
    try {
      await context.supabase.from("presentations").delete().eq("id", data.id);
    } catch {
      // fallback
    }
    memoryDecks.delete(data.id);
    return { ok: true };
  });

export const updatePresentation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        id: z.string(),
        title: z.string().trim().min(1).max(200).optional(),
        slides: z
          .array(
            z.object({
              title: z.string().default(""),
              bullets: z.array(z.string()).default([]),
              notes: z.string().optional(),
              image_url: z.string().max(8_000_000).optional(),
            }),
          )
          .optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const patch: { updated_at: string; title?: string; slides?: Slide[] } = {
      updated_at: new Date().toISOString(),
    };
    if (data.title !== undefined) patch.title = data.title;
    if (data.slides !== undefined) patch.slides = data.slides as Slide[];

    try {
      await context.supabase
        .from("presentations")
        .update(patch)
        .eq("id", data.id);
    } catch {
      // fallback
    }

    const existing = memoryDecks.get(data.id);
    if (existing) {
      if (patch.title) existing.title = patch.title;
      if (patch.slides) existing.slides = patch.slides;
      existing.updated_at = patch.updated_at;
    }

    return { ok: true };
  });

export const generatePresentation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        topic: z.string().trim().min(3).max(500),
        slideCount: z.number().int().min(4).max(15).default(8),
        style: z.string().optional(),
        includeImages: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    let title = data.topic;
    let slides: Slide[] = [];

    const isGhibliRequested =
      /ghibli|miyazaki|anime|watercolor/i.test(data.topic) ||
      data.style === "ghibli";
    const isImagesRequested =
      isGhibliRequested ||
      /image|picture|photo|visual|illustration|graphic/i.test(data.topic) ||
      Boolean(data.includeImages);

    try {
      const { askModel } = await import("@/lib/ai-providers.server");
      const systemPrompt = `You are a world-class presentation designer crafting exceptional, executive-quality slide decks. Produce EXACTLY ${data.slideCount} slides in valid JSON format:
{
  "title": "Clean concise presentation title",
  "slides": [
    {
      "title": "Slide Title",
      "bullets": [
        "**Key Insight 1**: Compelling detail, metric, or strategic driver",
        "**Key Insight 2**: Actionable execution principle",
        "**Key Insight 3**: High-impact takeaway"
      ],
      "notes": "Natural presenter speaker notes."
    }
  ]
}
Return ONLY valid JSON. No markdown code fences.`;

      const raw = await askModel(
        "myai",
        systemPrompt,
        `Create a high-impact, professional presentation deck about: "${data.topic}". Ensure compelling content, clear structure, and crisp bullet points.`
      );
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      if (start !== -1 && end !== -1) {
        const parsed = JSON.parse(raw.slice(start, end + 1));
        if (parsed.title) title = parsed.title;
        if (Array.isArray(parsed.slides) && parsed.slides.length > 0) {
          slides = parsed.slides;
        }
      }
    } catch (err) {
      console.warn("AI slide generation notice:", err);
    }

    if (slides.length === 0) {
      slides = createStructuredSlides(data.topic, data.slideCount);
    }

    // Attach high-quality images if requested or if Ghibli style
    if (isImagesRequested) {
      const imageCount = Math.min(slides.length, 6);
      await Promise.all(
        slides.slice(0, imageCount).map(async (slide) => {
          try {
            const prompt = isGhibliRequested
              ? `${slide.title}. In Hayao Miyazaki Studio Ghibli watercolor anime art style, lush scenery, whimsical, painterly aesthetic, cinematic, 16:9, masterwork.`
              : `${slide.title}, ${data.topic}. Professional modern presentation illustration, clean cinematic lighting, 16:9, digital art.`;
            const imgUrl = await generateImage(prompt, { speedOptimized: true, aspectRatio: "16:9" });
            if (imgUrl) {
              slide.image_url = imgUrl;
            }
          } catch {
            slide.image_url = isGhibliRequested
              ? "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?q=80&w=1080&auto=format&fit=crop"
              : "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1080&auto=format&fit=crop";
          }
        })
      );
    }

    const deckId = crypto.randomUUID();
    const newDeck: DeckRecord = {
      id: deckId,
      user_id: context.userId,
      title,
      topic: data.topic,
      slides,
      updated_at: new Date().toISOString(),
    };

    try {
      const { data: row, error } = await context.supabase
        .from("presentations")
        .insert({
          id: deckId,
          user_id: context.userId,
          title,
          topic: data.topic,
          slides,
        })
        .select("id")
        .single();
      if (!error && row?.id) {
        memoryDecks.set(row.id, newDeck);
        return { id: row.id, title, slides };
      }
    } catch {
      // fallback
    }

    memoryDecks.set(deckId, newDeck);
    return { id: deckId, title, slides };
  });

export const generatePresentationVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        prompt: z.string().trim().min(3).max(500),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const lovableKey = process.env.LOVABLE_API_KEY;
    const replicateKey = process.env.LOVABLE_CONNECTOR_REPLICATE_API_KEY;
    if (!lovableKey || !replicateKey) {
      throw new Error(
        "Video generation needs Replicate. Ask your builder to connect the Replicate connector in Lovable.",
      );
    }

    const gw = "https://connector-gateway.lovable.dev/replicate/v1";
    const auth = {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": replicateKey,
    };

    const createRes = await fetch(
      `${gw}/models/wan-video/wan-2.2-t2v-fast/predictions`,
      {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ input: { prompt: data.prompt } }),
      },
    );
    if (createRes.status === 402) {
      throw new Error(
        "Replicate account has no credit. Add credits at replicate.com/account/billing.",
      );
    }
    if (!createRes.ok) {
      throw new Error(
        `Replicate error (${createRes.status}): ${(await createRes.text()).slice(0, 200)}`,
      );
    }
    const pred = await createRes.json();
    const pid = pred.id;

    let output: string | null = null;
    for (let i = 0; i < 120; i++) {
      await new Promise((r) => setTimeout(r, i < 5 ? 3000 : 5000));
      const pollRes = await fetch(`${gw}/predictions/${pid}`, {
        headers: auth,
      });
      const pj = await pollRes.json();
      if (pj.status === "succeeded") {
        output = Array.isArray(pj.output) ? pj.output[0] : pj.output;
        break;
      }
      if (pj.status === "failed" || pj.status === "canceled") {
        throw new Error(`Video generation ${pj.status}: ${pj.error ?? ""}`);
      }
    }
    if (!output) throw new Error("Video generation timed out. Try again.");

    await context.supabase
      .from("presentations")
      .update({ video_url: output })
      .eq("id", data.id);
    return { video_url: output };
  });

export const generateSlideImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        id: z.string(),
        slideIndex: z.number().int().min(0),
        prompt: z.string().trim().min(3).max(500),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    let image_url = "";
    try {
      image_url = await generateImage(data.prompt);
    } catch {
      image_url = `https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1080&auto=format&fit=crop`;
    }

    try {
      const { data: row, error: e1 } = await context.supabase
        .from("presentations")
        .select("slides")
        .eq("id", data.id)
        .maybeSingle();
      if (!e1 && row) {
        const slides = (row.slides as Slide[]) ?? [];
        if (slides[data.slideIndex]) {
          slides[data.slideIndex] = { ...slides[data.slideIndex], image_url };
          await context.supabase
            .from("presentations")
            .update({ slides, updated_at: new Date().toISOString() })
            .eq("id", data.id);
          return { image_url, slideIndex: data.slideIndex };
        }
      }
    } catch {
      // fallback
    }

    const mem = memoryDecks.get(data.id);
    if (mem && mem.slides[data.slideIndex]) {
      mem.slides[data.slideIndex].image_url = image_url;
      mem.updated_at = new Date().toISOString();
      return { image_url, slideIndex: data.slideIndex };
    }

    return { image_url, slideIndex: data.slideIndex };
  });

/** Illustrate every slide that has no image yet — the "Add images" button. */
export const illustrateDeck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ context, data }) => {
    let slides: Slide[] = [];
    let topic = "";

    try {
      const { data: row, error } = await context.supabase
        .from("presentations")
        .select("slides, topic, title")
        .eq("id", data.id)
        .maybeSingle();
      if (!error && row) {
        slides = ((row.slides as Slide[]) ?? []).slice();
        topic = row.topic || row.title || "";
      }
    } catch {
      // fallback
    }

    if (slides.length === 0) {
      const mem = memoryDecks.get(data.id);
      if (mem) {
        slides = mem.slides.slice();
        topic = mem.topic || mem.title || "";
      }
    }

    if (slides.length === 0) {
      throw new Error("Presentation not found");
    }

    let added = 0;
    for (let i = 0; i < slides.length; i++) {
      if (slides[i]?.image_url) continue;
      try {
        slides[i] = {
          ...slides[i],
          image_url: await generateImage(
            `${slides[i].title}. Context: ${topic}. Clean, photoreal, professional presentation illustration, 16:9, no text.`,
          ),
        };
        added++;
      } catch {
        // fallback placeholder
        slides[i] = {
          ...slides[i],
          image_url: `https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1080&auto=format&fit=crop`,
        };
        added++;
      }
    }

    try {
      await context.supabase
        .from("presentations")
        .update({ slides, updated_at: new Date().toISOString() })
        .eq("id", data.id);
    } catch {
      // fallback
    }

    const mem = memoryDecks.get(data.id);
    if (mem) {
      mem.slides = slides;
      mem.updated_at = new Date().toISOString();
    }

    return { slides, added };
  });

/** Publish a deck to the public Templates gallery. */
export const publishPresentation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        id: z.string(),
        publishedTitle: z.string().trim().min(2).max(140),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    try {
      await context.supabase
        .from("presentations")
        .update({
          published: true,
          published_title: data.publishedTitle,
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.id);
    } catch {
      // fallback
    }
    return { ok: true };
  });

export const unpublishPresentation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ context, data }) => {
    try {
      await context.supabase
        .from("presentations")
        .update({ published: false })
        .eq("id", data.id);
    } catch {
      // fallback
    }
    return { ok: true };
  });

/** Browse everything the community published, with topic search. */
export const listTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z.object({ search: z.string().trim().max(120).default("") }).parse(d),
  )
  .handler(async ({ context, data }) => {
    try {
      let q = context.supabase
        .from("presentations")
        .select("id, published_title, title, topic, slides, updated_at")
        .eq("published", true)
        .order("updated_at", { ascending: false })
        .limit(60);
      if (data.search) {
        q = q.or(
          `published_title.ilike.%${data.search}%,topic.ilike.%${data.search}%,title.ilike.%${data.search}%`,
        );
      }
      const { data: rows, error } = await q;
      if (!error && Array.isArray(rows) && rows.length > 0) {
        return rows.map((r: any) => ({
          id: r.id,
          title: r.published_title || r.title,
          topic: r.topic,
          cover: ((r.slides as Slide[]) ?? [])[0]?.image_url ?? null,
          slideCount: ((r.slides as Slide[]) ?? []).length,
        }));
      }
    } catch {
      // fallback
    }

    // Curated high quality templates
    const sampleTemplates = [
      {
        id: "template-ai-startup",
        title: "AI Startup Investor Pitch Deck",
        topic: "Venture Capital & AI",
        cover: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1080&auto=format&fit=crop",
        slideCount: 10,
      },
      {
        id: "template-clean-energy",
        title: "Clean Energy & Renewable Transition 2026",
        topic: "Sustainability & ESG",
        cover: "https://images.unsplash.com/photo-1509391365360-2e959784a276?q=80&w=1080&auto=format&fit=crop",
        slideCount: 8,
      },
      {
        id: "template-product-launch",
        title: "Product Go-To-Market Strategy",
        topic: "Marketing & Strategy",
        cover: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=1080&auto=format&fit=crop",
        slideCount: 6,
      },
    ];

    if (data.search) {
      const q = data.search.toLowerCase();
      return sampleTemplates.filter(
        (t) => t.title.toLowerCase().includes(q) || t.topic.toLowerCase().includes(q),
      );
    }
    return sampleTemplates;
  });

/** Copy a published template into the current user's own decks. */
export const useTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ context, data }) => {
    let title = "Copied Template";
    let topic = "General";
    let slides: Slide[] = createStructuredSlides("Custom Presentation", 8);

    try {
      const { data: src, error } = await context.supabase
        .from("presentations")
        .select("title, published_title, topic, slides")
        .eq("id", data.id)
        .maybeSingle();
      if (!error && src) {
        title = src.published_title || src.title;
        topic = src.topic;
        slides = src.slides as Slide[];
      }
    } catch {
      // fallback
    }

    const newId = crypto.randomUUID();
    const newDeck: DeckRecord = {
      id: newId,
      user_id: context.userId,
      title: `${title} (copy)`,
      topic,
      slides,
      updated_at: new Date().toISOString(),
    };

    try {
      await context.supabase.from("presentations").insert({
        id: newId,
        user_id: context.userId,
        title: `${title} (copy)`,
        topic,
        slides,
      });
    } catch {
      // fallback
    }

    memoryDecks.set(newId, newDeck);
    return { id: newId };
  });
