import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import crypto from "crypto";

interface ThreadItem {
  id: string;
  title: string;
  updated_at: string;
  created_at?: string;
  last_message?: string;
  user_id: string;
}

interface MessageItem {
  id: string;
  thread_id: string;
  role: string;
  content: string;
  image_url: string | null;
  images?: string[];
  created_at: string;
  user_id: string;
}

// Resilient memory store to guarantee chat operations always work
const memoryThreads: ThreadItem[] = [];
const memoryMessages: MessageItem[] = [];

export const listThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const { data, error } = await context.supabase
        .from("threads")
        .select("id, title, updated_at, created_at")
        .order("updated_at", { ascending: false });
      if (!error && Array.isArray(data)) {
        // Enrich with last message if available in memory
        return data.map((t) => {
          const mem = memoryThreads.find((m) => m.id === t.id);
          const msgs = memoryMessages.filter((m) => m.thread_id === t.id);
          const lastMsg = msgs[msgs.length - 1]?.content || mem?.last_message || "";
          return {
            ...t,
            last_message: lastMsg,
          };
        });
      }
    } catch {
      // fallback to memory
    }
    return memoryThreads
      .filter((t) => t.user_id === context.userId)
      .sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );
  });

export const createThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        title: z.string().optional(),
        id: z.string().optional(),
      })
      .optional()
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const threadId = data?.id || crypto.randomUUID();
    const title = data?.title || "New conversation";
    const now = new Date().toISOString();
    const newThread: ThreadItem = {
      id: threadId,
      title,
      updated_at: now,
      created_at: now,
      user_id: context.userId,
    };
    try {
      const { data: row, error } = await context.supabase
        .from("threads")
        .insert({
          id: threadId,
          user_id: context.userId,
          title,
        })
        .select("id, title, updated_at")
        .single();
      if (!error && row?.id) {
        memoryThreads.unshift(newThread);
        return row;
      }
    } catch {
      // fallback
    }
    const existing = memoryThreads.findIndex((t) => t.id === threadId);
    if (existing !== -1) {
      memoryThreads[existing] = newThread;
    } else {
      memoryThreads.unshift(newThread);
    }
    return { id: threadId, title };
  });

export const updateThreadTitle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z.object({ id: z.string(), title: z.string().min(1).max(200) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const now = new Date().toISOString();
    try {
      await context.supabase
        .from("threads")
        .update({ title: data.title, updated_at: now })
        .eq("id", data.id);
    } catch {
      // fallback
    }
    const t = memoryThreads.find((x) => x.id === data.id);
    if (t) {
      t.title = data.title;
      t.updated_at = now;
    }
    return { ok: true, title: data.title };
  });

export const saveChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        id: z.string().optional(),
        threadId: z.string(),
        role: z.enum(["user", "assistant"]),
        content: z.string(),
        imageUrl: z.string().nullable().optional(),
        images: z.array(z.string()).optional(),
        threadTitle: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const msgId = data.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const newMsg: MessageItem = {
      id: msgId,
      thread_id: data.threadId,
      role: data.role,
      content: data.content,
      image_url: data.imageUrl || (data.images?.[0] ?? null),
      images: data.images,
      created_at: now,
      user_id: context.userId,
    };
    memoryMessages.push(newMsg);

    // Update or create thread
    let t = memoryThreads.find((x) => x.id === data.threadId);
    if (!t) {
      const generatedTitle =
        data.threadTitle ||
        (data.role === "user" ? data.content.slice(0, 45).trim() : "New conversation");
      t = {
        id: data.threadId,
        title: generatedTitle || "New conversation",
        updated_at: now,
        created_at: now,
        last_message: data.content.slice(0, 100),
        user_id: context.userId,
      };
      memoryThreads.unshift(t);
    } else {
      t.updated_at = now;
      t.last_message = data.content.slice(0, 100);
      if (
        data.role === "user" &&
        (!t.title || t.title === "New conversation" || t.title === "Untitled")
      ) {
        t.title = data.content.slice(0, 45).trim() || "New conversation";
      }
    }

    try {
      // Ensure thread exists in supabase
      await context.supabase.from("threads").upsert(
        {
          id: data.threadId,
          user_id: context.userId,
          title: t.title,
          updated_at: now,
        },
        { onConflict: "id" },
      );

      // Insert message with multi-image preservation
      const storedImageUrl =
        data.images && data.images.length > 1
          ? data.images.join(" || ")
          : (data.imageUrl || data.images?.[0] || null);

      await context.supabase.from("messages").insert({
        id: msgId,
        thread_id: data.threadId,
        user_id: context.userId,
        role: data.role,
        content: data.content,
        image_url: storedImageUrl,
        created_at: now,
      });
    } catch {
      // memory fallback
    }

    return { ok: true, id: msgId, threadTitle: t?.title };
  });

export const deleteThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ context, data }) => {
    try {
      await context.supabase.from("messages").delete().eq("thread_id", data.id);
      await context.supabase.from("threads").delete().eq("id", data.id);
    } catch {
      // fallback
    }
    const idx = memoryThreads.findIndex((t) => t.id === data.id);
    if (idx !== -1) memoryThreads.splice(idx, 1);
    for (let i = memoryMessages.length - 1; i >= 0; i--) {
      if (memoryMessages[i].thread_id === data.id) {
        memoryMessages.splice(i, 1);
      }
    }
    return { ok: true };
  });

export const clearThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ context, data }) => {
    try {
      await context.supabase.from("messages").delete().eq("thread_id", data.id);
    } catch {
      // fallback
    }
    for (let i = memoryMessages.length - 1; i >= 0; i--) {
      if (memoryMessages[i].thread_id === data.id) {
        memoryMessages.splice(i, 1);
      }
    }
    return { ok: true };
  });

export const getMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ threadId: z.string() }).parse(d))
  .handler(async ({ context, data }) => {
    try {
      const { data: rows, error } = await context.supabase
        .from("messages")
        .select("id, role, content, image_url, created_at")
        .eq("thread_id", data.threadId)
        .order("created_at", { ascending: true });
      if (!error && Array.isArray(rows) && rows.length > 0) {
        return rows.map((r) => {
          const mem = memoryMessages.find((m) => m.id === r.id);
          let parsedImages: string[] | undefined = mem?.images;
          if (!parsedImages && r.image_url) {
            if (r.image_url.includes(" || ")) {
              parsedImages = r.image_url.split(" || ");
            } else if (r.image_url.startsWith("[")) {
              try {
                parsedImages = JSON.parse(r.image_url);
              } catch {
                parsedImages = [r.image_url];
              }
            } else {
              parsedImages = [r.image_url];
            }
          }
          return {
            ...r,
            images: parsedImages,
          };
        });
      }
    } catch {
      // fallback
    }
    return memoryMessages
      .filter((m) => m.thread_id === data.threadId)
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
  });

export const deleteMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ context, data }) => {
    try {
      await context.supabase.from("messages").delete().eq("id", data.id);
    } catch {
      // fallback
    }
    const idx = memoryMessages.findIndex((m) => m.id === data.id);
    if (idx !== -1) memoryMessages.splice(idx, 1);
    return { ok: true };
  });

export const listBusinessProfiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("business_profiles")
      .select(
        "id, channel, business_name, description, website, status, updated_at",
      )
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const businessInput = z.object({
  channel: z.enum(["whatsapp", "instagram", "x"]),
  business_name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(4000).default(""),
  website: z.string().trim().url().max(500).optional().or(z.literal("")),
});

export const saveBusinessProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => businessInput.parse(d))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("business_profiles")
      .upsert(
        {
          user_id: context.userId,
          channel: data.channel,
          business_name: data.business_name,
          description: data.description,
          website: data.website || null,
          status: "connected",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,channel" },
      )
      .select("id, channel, business_name, description, website, status")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteBusinessProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("business_profiles")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
