import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { askModel, extractJson, generateImage, editImageWithAI } from "@/lib/ai-providers.server";

export type Scene = { caption: string; image_prompt: string };

/** Step 1 — storyboard the prompt into shots so the UI can show a progress timeline. */
export const storyboardVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        prompt: z.string().trim().min(3).max(500),
        frames: z.number().int().min(2).max(8).default(5),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const raw = await askModel(
      "myai",
      'You write cinematic video storyboards. Output ONLY JSON: {"style":"one sentence describing the shared look, lighting and lens","scenes":[{"caption":"...","image_prompt":"vivid, photoreal, cinematic description of one still frame"}]}. No prose.',
      `Storyboard a ${data.frames}-shot video about: "${data.prompt}". Keep one cohesive style, lighting, subject and colour palette across all shots, and move the action forward shot by shot.`,
    );
    const plan = extractJson(raw);
    const scenes: Scene[] = (plan.scenes ?? []).slice(0, data.frames).map((s: any) => ({
      caption: String(s.caption ?? ""),
      image_prompt: String(s.image_prompt ?? ""),
    }));
    if (!scenes.length) throw new Error("Could not storyboard that prompt. Try again.");
    return { style: String(plan.style ?? ""), scenes };
  });

/** Step 2 — render one shot. Called per frame so failures can be retried individually. */
export const renderVideoFrame = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        image_prompt: z.string().trim().min(3).max(1200),
        style: z.string().max(400).default(""),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const image_url = await generateImage(
      `${data.image_prompt}. ${data.style} Cinematic still, 16:9, film grain, consistent style with the rest of the sequence.`,
      { aspectRatio: "16:9", speedOptimized: true }
    );
    return { image_url };
  });

/** Edit a specific video frame shot from a text edit prompt */
export const editVideoFrame = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        image_url: z.string().min(1),
        edit_prompt: z.string().trim().min(2).max(1200),
        style: z.string().optional().default(""),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const editInstruction = data.style
      ? `${data.edit_prompt}. Maintain cinematic style: ${data.style}`
      : data.edit_prompt;
    const image_url = await editImageWithAI(
      data.image_url,
      "image/jpeg",
      editInstruction,
      { aspectRatio: "16:9" }
    );
    return { image_url };
  });

/** Image mode — create a single still from a prompt, optimized for speed and high-volume use cases. */
export const generateStill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        prompt: z.string().trim().min(2).max(1200),
        aspectRatio: z.enum(["1:1", "16:9", "9:16", "4:3", "3:4"]).optional().default("16:9"),
        style: z.string().optional(),
        speedOptimized: z.boolean().optional().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const promptWithStyle = data.style ? `${data.prompt}, in ${data.style} style` : data.prompt;
    const image_url = await generateImage(promptWithStyle, {
      aspectRatio: data.aspectRatio,
      speedOptimized: data.speedOptimized,
      style: data.style,
    });
    return { image_url };
  });

/** Edit an existing still image from a text prompt */
export const editStill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        image_url: z.string().min(1),
        edit_prompt: z.string().trim().min(2).max(1200),
        aspectRatio: z.enum(["1:1", "16:9", "9:16", "4:3", "3:4"]).optional().default("16:9"),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const image_url = await editImageWithAI(
      data.image_url,
      "image/jpeg",
      data.edit_prompt,
      { aspectRatio: data.aspectRatio }
    );
    return { image_url };
  });
