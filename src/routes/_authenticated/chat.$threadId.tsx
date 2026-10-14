import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { getMessages, deleteMessage, saveChatMessage, clearThread } from "@/lib/chat.functions";
import {
  getLocalMessages,
  saveLocalMessages,
  generateThreadTitle,
  type LocalMessage,
} from "@/lib/chat-store";
import { getActiveUserSession, type AppUserSession } from "@/lib/user-session";
import { extractTextFromPdfBuffer } from "@/lib/pdf-generator";
import { supabase } from "@/integrations/supabase/client";
import { auth } from "@/lib/firebase";
import {
  Mic,
  Send,
  Image as ImageIcon,
  Paperclip,
  Volume2,
  StopCircle,
  X,
  Bot,
  Trash2,
  Search,
  Globe,
  Plus,
  Play,
  Film,
  Sparkles,
  Smartphone,
  Camera,
  Wand2,
  Code,
  LogIn,
  User,
  StickyNote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { RichMessage } from "@/components/rich-message";
import { ChatImageCard } from "@/components/chat-image-card";
import { CameraModal } from "@/components/camera-modal";

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  component: ChatThread,
});

type AttachedImage = {
  id: string;
  dataUrl: string;
  mime: string;
  name: string;
};

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  image_url: string | null;
  images?: string[];
  created_at: string;
};

/** Deduplicate messages by ID and content fingerprint so messages never appear double */
function deduplicateMessages(list: Msg[]): Msg[] {
  const result: Msg[] = [];
  const seenIds = new Set<string>();
  const seenFingerprints = new Set<string>();

  for (const m of list) {
    if (!m) continue;
    if (m.id && seenIds.has(m.id)) continue;

    const clean = (m.content || "").trim();
    // Bucket by 90s window to collapse duplicate sends/server echoes
    const timeBucket = Math.floor(new Date(m.created_at || Date.now()).getTime() / 90000);
    const fp = `${m.role}::${clean}::${timeBucket}`;

    if (clean.length > 0 && seenFingerprints.has(fp)) {
      continue;
    }

    if (m.id) seenIds.add(m.id);
    if (clean.length > 0) seenFingerprints.add(fp);
    result.push(m);
  }

  return result.sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

function ChatThread() {
  const { threadId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getMsgs = useServerFn(getMessages);
  const delMsgFn = useServerFn(deleteMessage);
  const saveMsgFn = useServerFn(saveChatMessage);

  const { data: initial } = useQuery({
    queryKey: ["messages", threadId],
    queryFn: async () => {
      try {
        return (await getMsgs({ data: { threadId } })) || [];
      } catch {
        return [];
      }
    },
    retry: false,
  });

  const [messages, setMessages] = useState<Msg[]>([]);
  const [mounted, setMounted] = useState(false);
  const [input, setInput] = useState("");
  const [imageMode, setImageMode] = useState(false);
  const [imageAspectRatio, setImageAspectRatio] = useState<"1:1" | "16:9" | "9:16" | "4:3">("1:1");
  const [imageStyle, setImageStyle] = useState<string>("Photorealistic");
  const [researchMode, setResearchMode] = useState(false);
  const [attachments, setAttachments] = useState<AttachedImage[]>([]);
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [scratchpadText, setScratchpadText] = useState("");
  const [activeUserSession, setActiveUserSession] = useState<AppUserSession | null>(null);

  useEffect(() => {
    setActiveUserSession(getActiveUserSession());
    try {
      const stored = localStorage.getItem("myaipro_scratchpad") || "";
      setScratchpadText(stored);
    } catch {
      // ignore
    }
    function onAuth() {
      setActiveUserSession(getActiveUserSession());
    }
    window.addEventListener("myaipro_auth_changed", onAuth);
    return () => window.removeEventListener("myaipro_auth_changed", onAuth);
  }, []);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const hasWebSpeechCapturedRef = useRef(false);
  const lastCapturedSpeechRef = useRef("");
  const preMicInputRef = useRef("");

  const delMsgMut = useMutation({
    mutationFn: (id: string) => delMsgFn({ data: { id } }),
    onSuccess: (_r, id) => {
      setMessages((m) => {
        const next = m.filter((x) => x.id !== id);
        saveLocalMessages(threadId, next as LocalMessage[]);
        return next;
      });
    },
    onError: (e: any) => toast.error(e.message ?? "Delete failed"),
  });

  const clearFn = useServerFn(clearThread);
  const clearMsgMut = useMutation({
    mutationFn: (tId: string) => clearFn({ data: { id: tId } }),
    onSuccess: () => {
      setMessages([]);
      saveLocalMessages(threadId, []);
      toast.success("Chat cleared");
    },
    onError: () => {
      setMessages([]);
      saveLocalMessages(threadId, []);
      toast.success("Chat cleared");
    },
  });

  // Hydration-safe cache loading after mount
  useEffect(() => {
    setMounted(true);
    const cached = getLocalMessages(threadId);
    if (cached.length > 0) {
      setMessages((current) => {
        const combined = [...(cached as Msg[]), ...current];
        return deduplicateMessages(combined);
      });
    } else {
      setMessages((current) => (current.length > 0 ? deduplicateMessages(current) : []));
    }
  }, [threadId]);

  // When server messages arrive, sync and merge (never drop local messages)
  useEffect(() => {
    if (initial && Array.isArray(initial) && initial.length > 0) {
      setMessages((current) => {
        const combined = [...current, ...(initial as Msg[])];
        const merged = deduplicateMessages(combined);
        saveLocalMessages(threadId, merged as LocalMessage[]);
        return merged;
      });
    }
  }, [initial, threadId]);

  // Listen to external chat clear events
  useEffect(() => {
    function handleCleared(e: any) {
      if (!e.detail || e.detail === threadId) {
        setMessages([]);
        saveLocalMessages(threadId, []);
      }
    }
    window.addEventListener("myaipro_chat_cleared", handleCleared);
    return () => window.removeEventListener("myaipro_chat_cleared", handleCleared);
  }, [threadId]);

  const sendRef = useRef<(prompt: string) => void>(() => {});

  // Listen to external note/action prompt dispatches
  useEffect(() => {
    function handleExternalPrompt(e: any) {
      const p = e.detail;
      if (typeof p === "string" && p.trim()) {
        sendRef.current(p.trim());
      }
    }
    window.addEventListener("myaipro_send_chat_prompt", handleExternalPrompt);
    return () => window.removeEventListener("myaipro_send_chat_prompt", handleExternalPrompt);
  }, [threadId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, sending]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [threadId]);

  async function send(
    overrideText?: string,
    options?: {
      isImageEdit?: boolean;
      originalImageUrl?: string;
      aspectRatio?: "1:1" | "16:9" | "9:16" | "4:3";
      imageStyle?: string;
    },
  ) {
    const text = (overrideText ?? input).trim();
    if (!text && attachments.length === 0 && !options?.isImageEdit) return;
    if (sending) return;

    // Allocate real threadId if on "default"
    const effectiveThreadId =
      threadId === "default"
        ? `chat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
        : threadId;

    const currentAttachments = [...attachments];
    const userMsg: Msg = {
      id: `usr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: "user",
      content: options?.isImageEdit
        ? `[Image Edit Request]: ${text}`
        : text,
      image_url: options?.originalImageUrl || currentAttachments[0]?.dataUrl || null,
      images: currentAttachments.length > 0
        ? currentAttachments.map((a) => a.dataUrl)
        : options?.originalImageUrl
          ? [options.originalImageUrl]
          : undefined,
      created_at: new Date().toISOString(),
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setAttachments([]);
    setSending(true);

    // Generate intelligent thread title from what user started with at first
    const generatedTitle = generateThreadTitle(text);

    // Save to local cache immediately so history never loses it
    saveLocalMessages(effectiveThreadId, nextMessages as LocalMessage[]);

    // Asynchronously save to server
    saveMsgFn({
      data: {
        id: userMsg.id,
        threadId: effectiveThreadId,
        role: "user",
        content: userMsg.content,
        imageUrl: currentAttachments[0]?.dataUrl || options?.originalImageUrl || null,
        images: userMsg.images,
        threadTitle: generatedTitle,
      },
    }).catch(() => {});

    try {
      let token: string | undefined;
      if (auth.currentUser) {
        try {
          token = await auth.currentUser.getIdToken();
        } catch {
          // ignore
        }
      }
      if (!token) {
        try {
          const { data: sess } = await supabase.auth.getSession();
          token = sess.session?.access_token;
        } catch {
          // ignore
        }
      }
      const guestId =
        localStorage.getItem("myaipro_guest_id") || "guest-user";

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-guest-id": guestId,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          threadId: effectiveThreadId,
          messages: nextMessages.map((m) => ({
            role: m.role,
            content: m.content,
            image_url: m.image_url,
            images: m.images,
          })),
          imageMode,
          isImageEdit: options?.isImageEdit,
          originalImageUrl: options?.originalImageUrl,
          aspectRatio: options?.aspectRatio || (imageMode ? imageAspectRatio : "1:1"),
          imageStyle: options?.imageStyle || (imageMode ? imageStyle : undefined),
          researchMode,
          attachment: currentAttachments[0]
            ? {
                dataUrl: currentAttachments[0].dataUrl,
                mime: currentAttachments[0].mime,
              }
            : null,
          attachments: currentAttachments.map((a) => ({
            dataUrl: a.dataUrl,
            mime: a.mime,
            name: a.name,
          })),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || "Request failed");
      }
      const data = await res.json();
      const content = data.content ?? data.message?.content ?? data.text ?? "";
      const imageUrl = data.image_url ?? data.imageUrl ?? data.message?.image_url ?? data.message?.imageUrl ?? null;
      const images: string[] = Array.isArray(data.images) && data.images.length > 0
        ? data.images
        : Array.isArray(data.message?.images) && data.message.images.length > 0
          ? data.message.images
          : imageUrl ? [imageUrl] : [];
      const msgId = data.id ?? data.message?.id ?? `asst-${Date.now()}`;
      const createdAt = data.created_at ?? data.message?.created_at ?? new Date().toISOString();

      const assistantMsg: Msg = {
        id: msgId,
        role: "assistant",
        content,
        image_url: imageUrl || (images[0] || null),
        images: images.length > 0 ? images : undefined,
        created_at: createdAt,
      };

      const finalMessages = [...nextMessages, assistantMsg];
      setMessages(finalMessages);

      // Save to local cache with ending message
      saveLocalMessages(effectiveThreadId, finalMessages as LocalMessage[]);

      // Asynchronously save assistant message to server
      saveMsgFn({
        data: {
          id: assistantMsg.id,
          threadId: effectiveThreadId,
          role: "assistant",
          content,
          imageUrl,
          images: assistantMsg.images,
        },
      }).catch(() => {});

      qc.invalidateQueries({ queryKey: ["threads"] });

      // If user started from /chat/default, update route to real thread ID seamlessly
      if (threadId === "default") {
        navigate({
          to: "/chat/$threadId",
          params: { threadId: effectiveThreadId },
          replace: true,
        });
      }

      return assistantMsg;
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to send message",
      );
      setMessages((m) => m.filter((x) => x.id !== userMsg.id));
      saveLocalMessages(
        effectiveThreadId,
        messages.filter((x) => x.id !== userMsg.id) as LocalMessage[],
      );
    } finally {
      setSending(false);
      setImageMode(false);
      textareaRef.current?.focus();
    }
  }

  async function handleAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    for (const file of files) {
      if (
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf")
      ) {
        try {
          const buf = await file.arrayBuffer();
          const extracted = extractTextFromPdfBuffer(buf, file.name);
          setInput((prev) =>
            `${prev ? prev + "\n\n" : ""}[Attached PDF: ${file.name}]\n\`\`\`text\n${extracted.slice(0, 6000)}\n\`\`\`\nPlease edit, analyze, or update this PDF document:`,
          );
          toast.success(`Loaded PDF "${file.name}" for editing/analysis`);
        } catch {
          toast.error(`Could not read ${file.name}`);
        }
        continue;
      }

      if (
        file.type === "text/csv" ||
        file.name.toLowerCase().endsWith(".csv") ||
        file.name.toLowerCase().endsWith(".tsv") ||
        file.name.toLowerCase().endsWith(".txt")
      ) {
        try {
          const text = await file.text();
          setInput((prev) =>
            `${prev ? prev + "\n\n" : ""}[Attached Spreadsheet / File: ${file.name}]\n\`\`\`csv\n${text.slice(0, 8000)}\n\`\`\`\nPlease edit, analyze, or format this spreadsheet:`,
          );
          toast.success(`Loaded Spreadsheet "${file.name}" for editing`);
        } catch {
          toast.error(`Could not read ${file.name}`);
        }
        continue;
      }

      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} is not a supported image, PDF, or CSV spreadsheet.`);
        continue;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setAttachments((prev) => [
          ...prev,
          {
            id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            dataUrl: reader.result as string,
            mime: file.type,
            name: file.name,
          },
        ]);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  }

  function handlePaste(e: React.ClipboardEvent) {
    const items = Array.from(e.clipboardData?.items || []);
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = () => {
            setAttachments((prev) => [
              ...prev,
              {
                id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                dataUrl: reader.result as string,
                mime: file.type,
                name: "pasted-image.png",
              },
            ]);
          };
          reader.readAsDataURL(file);
        }
      }
    }
  }

  function handleCameraCapture(dataUrl: string, name: string) {
    setAttachments((prev) => [
      ...prev,
      {
        id: `att-cam-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        dataUrl,
        mime: "image/jpeg",
        name: name || "camera-capture.jpg",
      },
    ]);
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  async function toggleMic() {
    if (listening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // ignore
        }
      }
      setListening(false);
      return;
    }

    preMicInputRef.current = input.trim();
    hasWebSpeechCapturedRef.current = false;
    lastCapturedSpeechRef.current = "";

    // MediaRecorder API capturing audio input and converting via speech-to-text service
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: false },
          autoGainControl: { ideal: true },
        },
      });

      // Start Web Speech API if supported for live instant preview
      const SR: any =
        typeof window !== "undefined" &&
        ((window as any).SpeechRecognition ||
          (window as any).webkitSpeechRecognition);

      if (SR) {
        try {
          const rec = new SR();
          rec.lang = navigator.language || "en-US";
          rec.interimResults = true;
          rec.continuous = true;
          rec.maxAlternatives = 1;
          recognitionRef.current = rec;

          rec.onresult = (evt: any) => {
            let full = "";
            for (let i = 0; i < evt.results.length; i++) {
              const seg = (evt.results[i][0]?.transcript || "").trim();
              if (seg) {
                full = full ? `${full} ${seg}` : seg;
              }
            }
            if (full) {
              hasWebSpeechCapturedRef.current = true;
              lastCapturedSpeechRef.current = full;
              const prefix = preMicInputRef.current;
              setInput(prefix ? `${prefix} ${full}` : full);
            }
          };

          rec.onerror = () => {
            // Web speech error, MediaRecorder fallback will handle if needed
          };

          rec.start();
        } catch {
          // ignore
        }
      }

      // Browser MediaRecorder API as reliable backup
      let mimeType = "";
      const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
      for (const c of candidates) {
        if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) {
          mimeType = c;
          break;
        }
      }

      const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        // Only run neural transcribe if Web Speech API didn't capture the speech!
        if (
          !hasWebSpeechCapturedRef.current &&
          !lastCapturedSpeechRef.current &&
          audioChunksRef.current.length > 0
        ) {
          const blob = new Blob(audioChunksRef.current, { type: mr.mimeType || "audio/webm" });
          if (blob.size > 300) {
            const reader = new FileReader();
            reader.onload = async () => {
              const dataUrl = reader.result as string;
              try {
                const res = await fetch("/api/transcribe", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ audioDataUrl: dataUrl }),
                });
                if (res.ok) {
                  const data = await res.json();
                  const cleanText = (data?.transcript || "").trim();
                  if (cleanText) {
                    const prefix = preMicInputRef.current;
                    setInput(prefix ? `${prefix} ${cleanText}` : cleanText);
                    toast.success("Voice transcribed into chat input");
                  }
                }
              } catch {
                // ignore
              }
            };
            reader.readAsDataURL(blob);
          }
        }
      };

      mr.start(250);
      mediaRecorderRef.current = mr;
      setListening(true);
      toast.info("Recording voice — Speak now, click mic to finish");
    } catch {
      toast.error("Microphone permission required for voice recording.");
      setListening(false);
    }
  }

  function speak(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      toast.error("Voice output not supported.");
      return;
    }
    window.speechSynthesis.cancel();
    const clean = text
      .replace(/```[\s\S]*?```/g, "Code block omitted.")
      .replace(/[*_#`~[\]()]/g, "")
      .slice(0, 500);
    const u = new SpeechSynthesisUtterance(clean);
    u.rate = 1.05;
    window.speechSynthesis.speak(u);
  }

  sendRef.current = send;

  return (
    <>
      {/* Live search indicator banner */}
      <div className="flex items-center justify-between border-b border-border/40 bg-surface/60 px-4 py-1.5 text-xs text-muted-foreground backdrop-blur-sm">
        <div className="flex items-center gap-1.5 font-medium text-ink">
          <Globe className="size-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Live Google & Wikipedia Grounding Active</span>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (confirm("Clear all messages in this conversation?")) {
                  clearMsgMut.mutate(threadId);
                }
              }}
              className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition cursor-pointer"
              title="Clear all messages in this chat"
            >
              <Trash2 className="size-3" />
              <span>Clear chat</span>
            </button>
          )}
          {attachments.length > 0 && (
            <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">
              {attachments.length} image{attachments.length > 1 ? "s" : ""} attached
            </span>
          )}
          <span className="text-[11px] opacity-70">My AI Pro 1.1</span>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onPaste={handlePaste}
        className="flex-1 overflow-y-auto px-4 py-6"
      >
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          {messages.length === 0 && (
            <div className="my-auto py-8 text-center max-w-xl mx-auto">
              <div className="inline-flex size-14 items-center justify-center rounded-2xl bg-brand/10 text-brand shadow-xs mb-4">
                <Sparkles className="size-7" />
              </div>
              <h1 className="font-serif text-3xl font-bold tracking-tight text-ink">
                My AI Pro
              </h1>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                How can I help you today? Chat freely, ask to write or debug code, attach images for deep visual analysis, or search real-time facts.
              </p>

              {!activeUserSession && (
                <div className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand/5 px-3.5 py-1.5 text-xs text-muted-foreground shadow-2xs">
                  <span className="inline-flex size-2 rounded-full bg-brand" />
                  <span>Guest session active</span>
                  <span className="text-border">•</span>
                  <Link
                    to="/auth"
                    className="font-semibold text-brand underline underline-offset-2 hover:text-brand/80 transition"
                  >
                    Sign in to save history
                  </Link>
                </div>
              )}

              {/* Quick starter prompt chips */}
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
                <button
                  type="button"
                  onClick={() => send("Write a TypeScript function to debounce an event handler with proper types and generic arguments")}
                  className="group flex flex-col gap-1 rounded-xl border border-border/70 bg-surface/80 p-3 hover:border-brand/60 hover:bg-surface transition shadow-xs text-xs cursor-pointer"
                >
                  <span className="font-semibold text-ink group-hover:text-brand flex items-center gap-1.5">
                    <span>💻</span> Write Code
                  </span>
                  <span className="text-muted-foreground text-[11px] line-clamp-1">
                    TypeScript debounce helper with generic types
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => send("Write a Python script for a simple REST API using FastAPI with request validation")}
                  className="group flex flex-col gap-1 rounded-xl border border-border/70 bg-surface/80 p-3 hover:border-brand/60 hover:bg-surface transition shadow-xs text-xs cursor-pointer"
                >
                  <span className="font-semibold text-ink group-hover:text-brand flex items-center gap-1.5">
                    <span>⚡</span> Python API
                  </span>
                  <span className="text-muted-foreground text-[11px] line-clamp-1">
                    FastAPI REST backend with validation
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    fileInputRef.current?.click();
                  }}
                  className="group flex flex-col gap-1 rounded-xl border border-border/70 bg-surface/80 p-3 hover:border-brand/60 hover:bg-surface transition shadow-xs text-xs cursor-pointer"
                >
                  <span className="font-semibold text-ink group-hover:text-brand flex items-center gap-1.5">
                    <span>🖼️</span> Analyze Image
                  </span>
                  <span className="text-muted-foreground text-[11px] line-clamp-1">
                    Upload a photo, screenshot, or diagram to inspect
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => send("Explain how modern transformers work in machine learning with a clear mental model")}
                  className="group flex flex-col gap-1 rounded-xl border border-border/70 bg-surface/80 p-3 hover:border-brand/60 hover:bg-surface transition shadow-xs text-xs cursor-pointer"
                >
                  <span className="font-semibold text-ink group-hover:text-brand flex items-center gap-1.5">
                    <span>🧠</span> Explain Concepts
                  </span>
                  <span className="text-muted-foreground text-[11px] line-clamp-1">
                    How AI transformers and attention work
                  </span>
                </button>
              </div>
            </div>
          )}

          {messages.map((m, mIdx) =>
            m.role === "user" ? (
              <div key={m.id ? `msg-user-${m.id}-${mIdx}` : `msg-user-${mIdx}`} className="group flex flex-col items-end gap-2">
                {/* Single or Multiple Image attachments rendering */}
                {Array.isArray(m.images) && m.images.length > 0 ? (
                  <div className={cn(
                    "grid gap-1.5 max-w-[85%]",
                    m.images.length === 1 ? "grid-cols-1" : m.images.length === 2 ? "grid-cols-2" : "grid-cols-3"
                  )}>
                    {m.images.map((imgUrl, idx) => (
                      <img
                        key={`user-img-${m.id || mIdx}-${idx}`}
                        src={imgUrl}
                        alt={`attachment-${idx}`}
                        className="max-h-48 w-full rounded-xl object-cover shadow-sm ring-1 ring-black/5"
                      />
                    ))}
                  </div>
                ) : m.image_url ? (
                  <img
                    src={m.image_url}
                    alt="attachment"
                    className="max-w-[75%] rounded-2xl object-cover shadow-sm ring-1 ring-black/5"
                  />
                ) : null}

                {m.content && (
                  <div className="flex max-w-[85%] items-start gap-1">
                    <button
                      onClick={() => delMsgMut.mutate(m.id)}
                      className="mt-1 rounded-md p-1 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Delete message"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                    <div className="rounded-[20px] rounded-tr-md bg-brand px-4 py-2.5 text-sm leading-relaxed text-brand-foreground">
                      {m.content}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div
                key={m.id ? `msg-assistant-${m.id}-${mIdx}` : `msg-assistant-${mIdx}`}
                className="group flex w-full flex-col items-start gap-2"
              >
                {/* Single or Multiple Image rendering for assistant */}
                {Array.isArray(m.images) && m.images.length > 0 ? (
                  m.images.length === 1 ? (
                    <ChatImageCard
                      imageUrl={m.images[0]}
                      alt={m.content || "AI Generated Image"}
                      isEditing={sending}
                      onEdit={(editPrompt, origUrl, ratio) =>
                        send(editPrompt, {
                          isImageEdit: true,
                          originalImageUrl: origUrl,
                          aspectRatio: ratio,
                        })
                      }
                    />
                  ) : (
                    <div className={cn(
                      "grid gap-3 w-full max-w-2xl",
                      m.images.length === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                    )}>
                      {m.images.map((imgUrl, imgIdx) => (
                        <ChatImageCard
                          key={`asst-img-${m.id || mIdx}-${imgIdx}`}
                          imageUrl={imgUrl}
                          alt={`${m.content || "AI Generated Image"} (${imgIdx + 1})`}
                          isEditing={sending}
                          onEdit={(editPrompt, origUrl, ratio) =>
                            send(editPrompt, {
                              isImageEdit: true,
                              originalImageUrl: origUrl,
                              aspectRatio: ratio,
                            })
                          }
                        />
                      ))}
                    </div>
                  )
                ) : m.image_url ? (
                  <ChatImageCard
                    imageUrl={m.image_url}
                    alt={m.content || "AI Generated Image"}
                    isEditing={sending}
                    onEdit={(editPrompt, origUrl, ratio) =>
                      send(editPrompt, {
                        isImageEdit: true,
                        originalImageUrl: origUrl,
                        aspectRatio: ratio,
                      })
                    }
                  />
                ) : null}
                {m.content ? (
                  <div className="max-w-[90%]">
                    <RichMessage content={m.content} />
                  </div>
                ) : null}

                <div className="flex items-center gap-1">
                  {m.content && !m.image_url && (
                    <button
                      onClick={() => speak(m.content)}
                      className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] text-muted-foreground transition hover:text-ink"
                    >
                      <Volume2 className="size-3" /> Listen
                    </button>
                  )}
                  <button
                    onClick={() => delMsgMut.mutate(m.id)}
                    className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-destructive"
                    aria-label="Delete message"
                  >
                    <Trash2 className="size-3" /> Delete
                  </button>
                </div>
              </div>
            ),
          )}

          {sending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="inline-flex size-2 animate-pulse rounded-full bg-brand" />
              Thinking with live search & vision…
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <footer className="border-t border-black/5 bg-canvas/90 px-4 pb-6 pt-3 backdrop-blur-md">
        {/* Attached images carousel/strip */}
        {attachments.length > 0 && (
          <div className="mx-auto mb-3 flex max-w-2xl items-center gap-2 overflow-x-auto rounded-2xl bg-surface p-2 text-xs shadow-sm ring-1 ring-black/5">
            {attachments.map((att) => (
              <div key={att.id} className="relative group shrink-0">
                <img
                  src={att.dataUrl}
                  alt={att.name}
                  className="size-16 rounded-lg object-cover ring-1 ring-border"
                />
                <button
                  type="button"
                  onClick={() => removeAttachment(att.id)}
                  className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-destructive text-white shadow transition hover:scale-110"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
            <label className="flex size-16 shrink-0 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border/80 text-muted-foreground hover:border-brand hover:text-brand">
              <Plus className="size-4" />
              <span className="text-[9px] font-medium">Add more</span>
              <input
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={handleAttach}
              />
            </label>
          </div>
        )}

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.csv,.tsv,.txt"
          className="hidden"
          onChange={handleAttach}
        />

        {/* Plus Action Popup Menu */}
        {plusMenuOpen && (
          <div className="mx-auto mb-2 flex max-w-2xl flex-wrap items-center gap-2 rounded-2xl bg-surface p-2.5 shadow-xl ring-1 ring-black/10 border border-border/80 animate-in slide-in-from-bottom-2">
            <button
              type="button"
              onClick={() => {
                setPlusMenuOpen(false);
                setCameraOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-xl bg-brand/10 px-3 py-2 text-xs font-semibold text-brand hover:bg-brand/20 transition cursor-pointer"
            >
              <Camera className="size-4" />
              <span>Camera</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setPlusMenuOpen(false);
                fileInputRef.current?.click();
              }}
              className="flex items-center gap-1.5 rounded-xl border border-border/80 bg-canvas px-3 py-2 text-xs font-semibold text-ink hover:bg-surface transition cursor-pointer"
            >
              <Paperclip className="size-4 text-muted-foreground" />
              <span>Files / Photos</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setPlusMenuOpen(false);
                setImageMode((v) => !v);
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition cursor-pointer",
                imageMode
                  ? "bg-brand text-brand-foreground shadow-xs"
                  : "bg-surface text-muted-foreground hover:text-ink border border-border/70"
              )}
            >
              <ImageIcon className="size-4" />
              <span>{imageMode ? "Image Mode: ON" : "Image Mode"}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setPlusMenuOpen(false);
                setInput((prev) =>
                  prev
                    ? `${prev}\n\nWrite a complete production-ready code in TypeScript/Python: `
                    : "Write a complete production-ready code in TypeScript/Python: "
                );
                textareaRef.current?.focus();
              }}
              className="flex items-center gap-1.5 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/70 dark:bg-blue-950/30 px-3 py-2 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition cursor-pointer"
              title="Code Assistant prompt helper"
            >
              <Code className="size-4" />
              <span>Code Assistant</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setPlusMenuOpen(false);
                setNotesModalOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50/70 dark:bg-amber-950/20 px-3 py-2 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition cursor-pointer"
              title="Open Notes & Scratchpad"
            >
              <StickyNote className="size-4" />
              <span>Notes</span>
            </button>

            <Link
              to="/auth"
              onClick={() => setPlusMenuOpen(false)}
              className="flex items-center gap-1.5 rounded-xl border border-purple-200 dark:border-purple-900/50 bg-purple-50/70 dark:bg-purple-950/30 px-3 py-2 text-xs font-semibold text-purple-700 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition cursor-pointer"
              title="Sign in or register account"
            >
              <LogIn className="size-4" />
              <span>{activeUserSession ? "Account" : "Sign In"}</span>
            </Link>

            <button
              type="button"
              onClick={() => setPlusMenuOpen(false)}
              className="ml-auto rounded-lg p-1.5 text-muted-foreground hover:bg-canvas hover:text-ink transition cursor-pointer"
              aria-label="Close menu"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        {/* Image Mode & Speed Engine Configuration Toolbar */}
        {imageMode && (
          <div className="mx-auto mb-2 flex max-w-2xl flex-col gap-2 rounded-2xl bg-surface p-2.5 shadow-md border border-brand/30 animate-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-ink flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-brand" />
                Image Creation & Editing Active
              </span>
              <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">
                ⚡ High Speed Creative Engine
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-border/60">
              <div className="flex items-center gap-1 text-[11px]">
                <span className="text-muted-foreground mr-1">Aspect:</span>
                {(["1:1", "16:9", "9:16", "4:3"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setImageAspectRatio(r)}
                    className={cn(
                      "rounded-lg px-2 py-0.5 font-medium transition text-[10px]",
                      imageAspectRatio === r
                        ? "bg-brand text-brand-foreground font-semibold shadow-xs"
                        : "bg-canvas text-muted-foreground hover:text-ink"
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 text-[11px] overflow-x-auto">
                <span className="text-muted-foreground mr-1">Style:</span>
                {["Photorealistic", "Anime", "Cyberpunk", "3D Render", "Watercolor", "Cinematic"].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setImageStyle(st)}
                    className={cn(
                      "rounded-lg px-2 py-0.5 font-medium transition text-[10px] shrink-0",
                      imageStyle === st
                        ? "bg-brand text-brand-foreground font-semibold shadow-xs"
                        : "bg-canvas text-muted-foreground hover:text-ink"
                    )}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="mx-auto flex max-w-2xl items-end gap-2 rounded-[24px] bg-surface p-2 ring-1 ring-black/5">
          <button
            type="button"
            onClick={() => setPlusMenuOpen((v) => !v)}
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full transition",
              plusMenuOpen
                ? "bg-brand text-brand-foreground"
                : "text-muted-foreground hover:text-ink hover:bg-canvas"
            )}
            title="Add attachments, take photo with camera, or toggle image mode"
          >
            <Plus className={cn("size-5 transition-transform", plusMenuOpen && "rotate-45")} />
          </button>
          
          <button
            type="button"
            onClick={() => setCameraOpen(true)}
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-ink hover:bg-canvas transition"
            title="Take photo with device camera"
          >
            <Camera className="size-4 text-brand" />
          </button>

          <button
            type="button"
            onClick={() => setImageMode((v) => !v)}
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full transition",
              imageMode
                ? "bg-brand text-brand-foreground"
                : "text-muted-foreground hover:text-ink",
            )}
            title={
              imageMode ? "Image mode on" : "Generate image with next message"
            }
          >
            <ImageIcon className="size-4" />
          </button>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder={
              imageMode
                ? "Describe the image to generate…"
                : attachments.length > 0
                  ? "Ask anything about the attached images / photo…"
                  : "Ask My AI anything (with Google images, live web & vision)…"
            }
            className="flex-1 resize-none border-none bg-transparent px-1 py-2 text-sm outline-none placeholder:text-muted-foreground"
            style={{ maxHeight: 140 }}
          />
          <button
            type="button"
            onClick={toggleMic}
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full transition",
              listening
                ? "bg-destructive text-white"
                : "text-muted-foreground hover:text-ink",
            )}
            aria-label="Voice input"
          >
            {listening ? (
              <StopCircle className="size-4" />
            ) : (
              <Mic className="size-4" />
            )}
          </button>
          <button
            type="button"
            onClick={() => send()}
            disabled={sending || (!input.trim() && attachments.length === 0)}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink text-white transition hover:opacity-90 disabled:opacity-40"
            aria-label="Send"
          >
            <Send className="size-4" />
          </button>
        </div>
        <div className="mx-auto mt-2 flex max-w-2xl items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setResearchMode((v) => !v)}
              className={cn(
                "flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest transition",
                researchMode
                  ? "bg-brand text-brand-foreground"
                  : "text-muted-foreground hover:text-ink",
              )}
              title="Deep web research with sources"
            >
              <Search className="size-3" /> Research
            </button>
          </div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {imageMode
              ? "Image Mode"
              : researchMode
                ? "Live Research"
                : "Chat + Live Web & Camera"}
          </p>
        </div>
      </footer>

      {/* Live Camera Viewfinder Modal */}
      <CameraModal
        isOpen={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={handleCameraCapture}
      />

      {/* Quick Notes & Scratchpad Modal */}
      {notesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-border/80 bg-surface p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2 font-semibold text-ink">
                <StickyNote className="size-4 text-amber-500" />
                <span>Notes & Scratchpad</span>
              </div>
              <button
                type="button"
                onClick={() => setNotesModalOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-canvas hover:text-ink transition cursor-pointer"
                aria-label="Close modal"
              >
                <X className="size-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Jot down thoughts, code snippets, or prompt ideas. Notes are automatically saved locally.
            </p>

            <textarea
              value={scratchpadText}
              onChange={(e) => {
                setScratchpadText(e.target.value);
                try {
                  localStorage.setItem("myaipro_scratchpad", e.target.value);
                } catch {
                  // ignore
                }
              }}
              rows={8}
              placeholder="Type your notes or prompt ideas here..."
              className="w-full rounded-xl border border-border/80 bg-canvas p-3 text-xs text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand font-mono leading-relaxed"
            />

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <div className="text-[11px] text-muted-foreground">
                {scratchpadText.length} characters
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(scratchpadText);
                    toast.success("Notes copied to clipboard!");
                  }}
                  disabled={!scratchpadText.trim()}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink hover:bg-canvas transition disabled:opacity-40 cursor-pointer"
                >
                  Copy
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInput((prev) => (prev ? `${prev}\n\n${scratchpadText}` : scratchpadText));
                    setNotesModalOpen(false);
                    textareaRef.current?.focus();
                    toast.success("Notes inserted into prompt!");
                  }}
                  disabled={!scratchpadText.trim()}
                  className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground hover:bg-brand/90 transition disabled:opacity-40 cursor-pointer"
                >
                  Insert into Prompt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
