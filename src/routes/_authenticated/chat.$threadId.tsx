import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { getMessages, deleteMessage, saveChatMessage } from "@/lib/chat.functions";
import {
  getLocalMessages,
  saveLocalMessages,
  generateThreadTitle,
  type LocalMessage,
} from "@/lib/chat-store";
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

  return (
    <>
      {/* Live search indicator banner */}
      <div className="flex items-center justify-between border-b border-border/40 bg-surface/60 px-4 py-1.5 text-xs text-muted-foreground backdrop-blur-sm">
        <div className="flex items-center gap-1.5 font-medium text-ink">
          <Globe className="size-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Live Google & Wikipedia Grounding Active</span>
        </div>
        <div className="flex items-center gap-2">
          {attachments.length > 0 && (
            <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">
              {attachments.length} image{attachments.length > 1 ? "s" : ""} attached
            </span>
          )}
          <span className="text-[11px] opacity-70">My AI 1.1</span>
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
            <div className="my-auto py-12 text-center">
              <h1 className="font-serif text-3xl font-bold text-ink">My AI 1.1</h1>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Ultra-fast assistant with multimodal image analysis, live Google search grounding, and device controls.
              </p>

              {/* Quick Starter Prompts */}
              <div className="mx-auto mt-8 grid max-w-md grid-cols-2 gap-2 text-left">
                {[
                  "Calculate 245 * 38 with steps",
                  "Open YouTube on my mobile",
                  "Generate a photorealistic cyberpunk city",
                  "Show me a video about Artificial Intelligence",
                ].map((s, sIdx) => (
                  <button
                    key={`starter-prompt-${sIdx}`}
                    onClick={() => send(s)}
                    className="rounded-2xl border border-border/60 bg-card p-3 text-xs leading-snug text-ink transition hover:bg-surface hover:border-brand/40"
                  >
                    {s}
                  </button>
                ))}
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
          <div className="mx-auto mb-2 flex max-w-2xl items-center gap-2 rounded-2xl bg-surface p-2 shadow-lg ring-1 ring-black/10 animate-in slide-in-from-bottom-2">
            <button
              type="button"
              onClick={() => {
                setPlusMenuOpen(false);
                setCameraOpen(true);
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand/10 p-2.5 text-xs font-semibold text-brand hover:bg-brand/20 transition"
            >
              <Camera className="size-4" />
              <span>Camera (Take Photo)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setPlusMenuOpen(false);
                fileInputRef.current?.click();
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border/80 bg-canvas p-2.5 text-xs font-semibold text-ink hover:bg-surface transition"
            >
              <Paperclip className="size-4 text-muted-foreground" />
              <span>Upload Gallery / Files</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setPlusMenuOpen(false);
                setImageMode((v) => !v);
              }}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-xl p-2.5 text-xs font-semibold transition",
                imageMode ? "bg-brand text-brand-foreground" : "bg-surface text-muted-foreground hover:text-ink"
              )}
            >
              <ImageIcon className="size-4" />
              <span>{imageMode ? "Image Mode: ON" : "Image Mode"}</span>
            </button>

            <button
              type="button"
              onClick={() => setPlusMenuOpen(false)}
              className="rounded-lg p-2 text-muted-foreground hover:text-ink"
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
    </>
  );
}
