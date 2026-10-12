import { getActiveUserSession, getActiveUserStorageKey } from "@/lib/user-session";

export interface LocalThread {
  id: string;
  title: string;
  first_prompt?: string;
  last_message?: string;
  updated_at: string;
  created_at: string;
  message_count?: number;
  user_key?: string;
}

export interface LocalMessage {
  id: string;
  thread_id: string;
  role: "user" | "assistant";
  content: string;
  image_url: string | null;
  images?: string[];
  created_at: string;
}

const LEGACY_THREADS_KEY = "myaipro_chat_threads_v2";
const LEGACY_MESSAGES_PREFIX = "myaipro_chat_messages_v2_";

function getThreadsKey(): string {
  const userKey = getActiveUserStorageKey();
  return userKey === "guest"
    ? LEGACY_THREADS_KEY
    : `myaipro_chat_threads_v2_${userKey}`;
}

function getMessagesKey(threadId: string): string {
  const userKey = getActiveUserStorageKey();
  return userKey === "guest"
    ? `${LEGACY_MESSAGES_PREFIX}${threadId}`
    : `myaipro_chat_messages_v2_${userKey}_${threadId}`;
}

/** Get all threads stored in localStorage for the active user */
export function getLocalThreads(): LocalThread[] {
  if (typeof window === "undefined") return [];
  try {
    const key = getThreadsKey();
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }

    // If returning ("old") user and scoped key is not yet written, check legacy key
    const session = getActiveUserSession();
    if (session && !session.isNewUser) {
      const legacyRaw = localStorage.getItem(LEGACY_THREADS_KEY);
      if (legacyRaw) {
        const parsed = JSON.parse(legacyRaw);
        if (Array.isArray(parsed)) {
          localStorage.setItem(key, legacyRaw);
          return parsed;
        }
      }
    }
    return [];
  } catch {
    return [];
  }
}

/** Save list of threads for the active user */
export function saveLocalThreads(threads: LocalThread[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getThreadsKey(), JSON.stringify(threads));
  } catch {
    // ignore quota
  }
}

/** Get messages for a thread from localStorage for the active user */
export function getLocalMessages(threadId: string): LocalMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const key = getMessagesKey(threadId);
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }

    // For returning ("old") users, fall back to legacy messages if not yet migrated
    const session = getActiveUserSession();
    if (session && !session.isNewUser) {
      const legacyRaw = localStorage.getItem(`${LEGACY_MESSAGES_PREFIX}${threadId}`);
      if (legacyRaw) {
        const parsed = JSON.parse(legacyRaw);
        if (Array.isArray(parsed)) {
          localStorage.setItem(key, legacyRaw);
          return parsed;
        }
      }
    }
    return [];
  } catch {
    return [];
  }
}

/** Save messages for a thread to localStorage for the active user */
export function saveLocalMessages(threadId: string, messages: LocalMessage[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getMessagesKey(threadId), JSON.stringify(messages));

    // Also update thread metadata in the user's threads list
    const threads = getLocalThreads();
    const idx = threads.findIndex((t) => t.id === threadId);
    const now = new Date().toISOString();
    const lastMsg = messages[messages.length - 1]?.content || "";
    const firstUserMsg = messages.find((m) => m.role === "user")?.content || "";

    const cleanTitle = firstUserMsg
      ? firstUserMsg.replace(/^[#\s*]+/, "").slice(0, 48).trim()
      : "New conversation";

    if (idx !== -1) {
      threads[idx] = {
        ...threads[idx],
        title:
          !threads[idx].title ||
          threads[idx].title === "New conversation" ||
          threads[idx].title === "Untitled"
            ? cleanTitle || "New conversation"
            : threads[idx].title,
        first_prompt: threads[idx].first_prompt || firstUserMsg,
        last_message: lastMsg,
        updated_at: now,
        message_count: messages.length,
      };
    } else if (threadId && (threadId !== "default" || messages.length > 0)) {
      threads.unshift({
        id: threadId,
        title: cleanTitle || "New conversation",
        first_prompt: firstUserMsg,
        last_message: lastMsg,
        updated_at: now,
        created_at: now,
        message_count: messages.length,
        user_key: getActiveUserStorageKey(),
      });
    }

    saveLocalThreads(threads);
  } catch {
    // ignore
  }
}

/** Update thread title in localStorage */
export function updateLocalThreadTitle(threadId: string, newTitle: string): void {
  const threads = getLocalThreads();
  const idx = threads.findIndex((t) => t.id === threadId);
  if (idx !== -1) {
    threads[idx].title = newTitle;
    threads[idx].updated_at = new Date().toISOString();
    saveLocalThreads(threads);
  }
}

/** Delete thread and its messages from localStorage */
export function deleteLocalThread(threadId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(getMessagesKey(threadId));
    const threads = getLocalThreads().filter((t) => t.id !== threadId);
    saveLocalThreads(threads);
  } catch {
    // ignore
  }
}

/** Clear messages for a thread */
export function clearLocalThreadMessages(threadId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getMessagesKey(threadId), JSON.stringify([]));
    const threads = getLocalThreads();
    const idx = threads.findIndex((t) => t.id === threadId);
    if (idx !== -1) {
      threads[idx].last_message = "";
      threads[idx].message_count = 0;
      saveLocalThreads(threads);
    }
  } catch {
    // ignore
  }
}

/** Generate a clean conversation title from first user prompt */
export function generateThreadTitle(userText: string): string {
  const clean = userText
    .replace(/^(can you|please|help me|tell me|what is|how to|write|create|generate)\s+/i, "")
    .trim();
  const firstSentence = clean.split(/[.?!;\n]/)[0]?.trim() || clean;
  const capitalized = firstSentence.charAt(0).toUpperCase() + firstSentence.slice(1);
  return capitalized.slice(0, 48).trim() || "New conversation";
}

/** Format timestamp for history grouping */
export function formatHistoryDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    if (isToday) {
      return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday =
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear();

    if (isYesterday) {
      return "Yesterday";
    }

    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return "Recent";
  }
}
