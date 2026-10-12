import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState, useRef, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  MoreVertical,
  MessageSquare,
  Paperclip,
  Plus,
  Mic,
  Volume2,
  Trash2,
  Share2,
  Settings as SettingsIcon,
  ExternalLink,
  Loader2,
  AudioWaveform,
  Sparkles,
  Send,
} from "lucide-react";
import {
  GoogleDriveLogo,
  GoogleSheetsLogo,
  GmailLogo,
  SlackLogo,
} from "@/components/icons/app-logos";
import {
  getProjectById,
  getLocalProjectMessages,
  addProjectChatMessage,
  removeSourceFromProject,
  type ProjectItem,
  type ProjectSource,
  type ProjectChatMessage,
} from "@/lib/projects-store";
import { sendProjectChatMessage } from "@/lib/projects.functions";
import { AddSourceModal } from "@/components/projects/add-source-modal";
import { ShareProjectModal } from "@/components/projects/share-project-modal";
import { ProjectSettingsModal } from "@/components/projects/project-settings-modal";
import { RichMessage } from "@/components/rich-message";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/projects/$projectId")({
  component: ProjectDetailPage,
});

type ProjectTab = "chats" | "sources";

function ProjectDetailPage() {
  const { projectId } = useParams({ from: "/_authenticated/projects/$projectId" });
  const navigate = useNavigate();

  const [project, setProject] = useState<ProjectItem | null>(null);
  const [activeTab, setActiveTab] = useState<ProjectTab>("chats");
  const [messages, setMessages] = useState<ProjectChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Modals
  const [addSourceOpen, setAddSourceOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const hasWebSpeechCapturedRef = useRef(false);
  const lastCapturedSpeechRef = useRef("");
  const preMicInputRef = useRef("");
  const askServerFn = useServerFn(sendProjectChatMessage);

  // Load project & messages
  useEffect(() => {
    getProjectById(projectId).then((p) => {
      if (p) setProject(p);
    });
    setMessages(getLocalProjectMessages(projectId));
  }, [projectId]);

  // Scroll on messages
  useEffect(() => {
    if (activeTab === "chats") {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, sending, activeTab]);

  // Close 3-dots menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  // Build sources context string to ground the chatbot
  const sourcesContext = useMemo(() => {
    if (!project?.sources || project.sources.length === 0) return "";
    return project.sources
      .map(
        (s) =>
          `[Source: ${s.type.toUpperCase()}] ${s.title}${
            s.snippet ? `\nContent summary: ${s.snippet.slice(0, 800)}` : ""
          }`,
      )
      .join("\n\n");
  }, [project?.sources]);

  async function handleSendMessage(overrideText?: string) {
    const text = (overrideText ?? input).trim();
    if (!text || sending) return;

    if (activeTab !== "chats") {
      setActiveTab("chats");
    }

    setInput("");

    // Optimistically add user message immediately
    const userMsg: ProjectChatMessage = {
      id: `usr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);

    try {
      addProjectChatMessage(projectId, "user", text).catch(() => {});
    } catch {
      // non-blocking
    }

    let replyText = "";

    try {
      const history = messages.slice(-6).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      const res = await askServerFn({
        data: {
          projectId,
          projectTitle: project?.title || "Project",
          projectInstructions: project?.instructions,
          sourcesContext,
          userMessage: text,
          conversationHistory: history,
        },
      });

      replyText = res?.reply || "";
    } catch (err: any) {
      // Resilient fallback to /api/chat with project context
      try {
        const guestId = localStorage.getItem("myaipro_guest_id") || "guest-user";
        const promptWithProject = `[Project Context: "${project?.title || "Project"}"]\n${
          sourcesContext ? `[Connected Sources:\n${sourcesContext}]\n` : ""
        }${text}`;

        const chatRes = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-guest-id": guestId,
          },
          body: JSON.stringify({
            threadId: `proj-${projectId}`,
            messages: [{ role: "user", content: promptWithProject }],
          }),
        });

        if (chatRes.ok) {
          const chatData = await chatRes.json();
          replyText = chatData.content || chatData.message?.content || "";
        }
      } catch {
        // ignore
      }
    }

    if (!replyText) {
      replyText = `I have received your request for project "${project?.title || "Project"}". How would you like to proceed?`;
    }

    try {
      const botMsg = await addProjectChatMessage(projectId, "assistant", replyText);
      setMessages((prev) => {
        // Prevent duplicate assistant messages
        if (prev.some((m) => m.id === botMsg.id || (m.role === "assistant" && m.content === replyText))) {
          return prev;
        }
        return [...prev, botMsg];
      });
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `asst-${Date.now()}`,
          role: "assistant",
          content: replyText,
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  async function handleVoiceInput() {
    if (listening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
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

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: false },
          autoGainControl: { ideal: true },
        },
      });

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
          rec.start();
        } catch {
          // ignore
        }
      }

      let mimeType = "";
      const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
      for (const c of candidates) {
        if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) {
          mimeType = c;
          break;
        }
      }

      const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (
          !hasWebSpeechCapturedRef.current &&
          !lastCapturedSpeechRef.current &&
          chunks.length > 0
        ) {
          const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
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
                    toast.success("Voice transcribed into project chat");
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
      setListening(true);
      toast.info("Listening — Speak your question, tap mic to finish");
    } catch {
      toast.error("Microphone permission required for voice recording.");
      setListening(false);
    }
  }

  function speakText(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      toast.error("Speech synthesis not supported.");
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

  async function handleRemoveSource(sourceId: string) {
    if (!confirm("Remove this source from the project?")) return;
    await removeSourceFromProject(projectId, sourceId);
    setProject((prev) =>
      prev
        ? { ...prev, sources: (prev.sources || []).filter((s) => s.id !== sourceId) }
        : null,
    );
    toast.success("Source removed");
  }

  function renderSourceIcon(type: ProjectSource["type"]) {
    switch (type) {
      case "drive":
        return <GoogleDriveLogo className="size-6 shrink-0" />;
      case "sheet":
        return <GoogleSheetsLogo className="size-6 shrink-0" />;
      case "gmail":
        return <GmailLogo className="size-6 shrink-0" />;
      default:
        return <Paperclip className="size-5 text-neutral-400 shrink-0" />;
    }
  }

  return (
    <div className="flex h-[100dvh] w-full flex-col bg-black text-white font-sans overflow-hidden">
      {/* Top Header matching Screenshot 5 & 6 */}
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between px-4 bg-black/95 backdrop-blur-md border-b border-neutral-900">
        <button
          onClick={() => navigate({ to: "/projects" })}
          className="flex size-10 items-center justify-center rounded-full bg-neutral-900 text-white hover:bg-neutral-800 transition active:scale-95"
          aria-label="Back to projects"
        >
          <ArrowLeft className="size-5" />
        </button>

        <h1 className="text-base font-semibold text-white truncate max-w-[200px]">
          {project?.title || "Project"}
        </h1>

        {/* Right Three Dots Menu Button */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex size-10 items-center justify-center rounded-full bg-neutral-900 text-white hover:bg-neutral-800 transition active:scale-95"
            aria-label="Project options"
          >
            <MoreVertical className="size-5" />
          </button>

          {/* Three dots dropdown menu */}
          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-52 rounded-2xl border border-neutral-800 bg-[#1c1c1e] p-1.5 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  setShareOpen(true);
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-white hover:bg-neutral-800 transition text-left"
              >
                <Share2 className="size-4 text-neutral-300" />
                <span>Share project</span>
              </button>

              <button
                onClick={() => {
                  setMenuOpen(false);
                  setAddSourceOpen(true);
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-white hover:bg-neutral-800 transition text-left"
              >
                <Plus className="size-4 text-neutral-300" />
                <span>Add sources</span>
              </button>

              <button
                onClick={() => {
                  setMenuOpen(false);
                  setSettingsOpen(true);
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-white hover:bg-neutral-800 transition text-left"
              >
                <SettingsIcon className="size-4 text-neutral-300" />
                <span>Project settings</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Subtabs: Chats vs Sources matching Screenshot 5 & 6 */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-neutral-900 bg-black">
        <button
          onClick={() => setActiveTab("chats")}
          className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
            activeTab === "chats"
              ? "bg-[#2c2c2e] text-white"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          Chats
        </button>

        <button
          onClick={() => setActiveTab("sources")}
          className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
            activeTab === "sources"
              ? "bg-[#2c2c2e] text-white"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          <span>Sources</span>
          {project?.sources && project.sources.length > 0 && (
            <span className="flex size-4 items-center justify-center rounded-full bg-neutral-700 text-[10px] text-white font-medium">
              {project.sources.length}
            </span>
          )}
        </button>
      </div>

      {/* Main Tab Content */}
      <main className="flex-1 overflow-y-auto flex flex-col">
        {activeTab === "chats" ? (
          /* CHATS TAB */
          messages.length === 0 ? (
            /* Empty State matching Screenshot 5 */
            <div className="my-auto flex flex-col items-center justify-center text-center px-4">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-[#1c1c1e] text-neutral-300 mb-4 shadow-inner">
                <MessageSquare className="size-7" />
              </div>
              <h2 className="text-lg font-semibold text-white mb-1.5">No chats yet</h2>
              <p className="text-xs text-neutral-400">Start chatting below</p>
            </div>
          ) : (
            /* Active Chat Feed */
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
              <div className="max-w-2xl mx-auto w-full space-y-4">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${
                      m.role === "user" ? "items-end" : "items-start"
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-3xl px-4 py-3 text-sm leading-relaxed ${
                        m.role === "user"
                          ? "bg-brand text-brand-foreground rounded-tr-md shadow-sm"
                          : "bg-[#1c1c1e] text-white rounded-tl-md border border-neutral-800"
                      }`}
                    >
                      {m.role === "user" ? (
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      ) : (
                        <RichMessage content={m.content} />
                      )}
                    </div>

                    {m.role === "assistant" && (
                      <div className="flex items-center gap-2 mt-1.5 pl-2">
                        <button
                          onClick={() => speakText(m.content)}
                          className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] text-neutral-400 hover:text-white transition"
                        >
                          <Volume2 className="size-3" /> Listen
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {sending && (
                  <div className="flex items-center gap-2 text-xs text-neutral-400 pl-2">
                    <span className="inline-flex size-2 animate-pulse rounded-full bg-brand" />
                    <span>My AI is thinking with project context…</span>
                  </div>
                )}
              </div>
            </div>
          )
        ) : (
          /* SOURCES TAB matching Screenshot 6 */
          <div className="flex-1 overflow-y-auto px-4 py-6">
            {!project?.sources || project.sources.length === 0 ? (
              /* Empty Sources State matching Screenshot 6 */
              <div className="my-auto flex flex-col items-center justify-center text-center px-4 py-16">
                {/* 3 App Badges matching Screenshot 6 */}
                <div className="flex items-center justify-center gap-3 mb-6">
                  <div className="flex size-14 items-center justify-center rounded-2xl bg-[#1c1c1e] p-2.5 shadow-inner border border-neutral-800">
                    <SlackLogo className="size-8" />
                  </div>
                  <div className="flex size-14 items-center justify-center rounded-2xl bg-[#1c1c1e] p-2.5 shadow-inner border border-neutral-800">
                    <GoogleDriveLogo className="size-8" />
                  </div>
                  <div className="flex size-14 items-center justify-center rounded-2xl bg-[#1c1c1e] p-2.5 shadow-inner border border-neutral-800">
                    <Paperclip className="size-7 text-neutral-300" />
                  </div>
                </div>

                <h2 className="text-lg font-semibold text-white mb-2">
                  Give My AI more context
                </h2>
                <p className="max-w-xs text-xs text-neutral-400 leading-relaxed mb-6">
                  Upload Sources to give My AI deeper context about your project.
                </p>

                <button
                  onClick={() => setAddSourceOpen(true)}
                  className="rounded-full bg-white px-8 py-2.5 text-xs font-semibold text-black hover:bg-neutral-200 transition shadow-lg active:scale-95"
                >
                  Add
                </button>
              </div>
            ) : (
              /* Connected Sources List */
              <div className="max-w-2xl mx-auto w-full space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-neutral-900">
                  <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                    Connected Sources ({project.sources.length})
                  </h3>
                  <button
                    onClick={() => setAddSourceOpen(true)}
                    className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-black hover:bg-neutral-200 transition"
                  >
                    <Plus className="size-3.5" />
                    <span>Add Source</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {project.sources.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-start justify-between rounded-2xl bg-[#1c1c1e] p-4 border border-neutral-800/80 gap-3 group"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="p-1 mt-0.5">{renderSourceIcon(s.type)}</div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="truncate text-xs font-semibold text-white">
                              {s.title}
                            </h4>
                            <span className="rounded-md bg-neutral-800 px-1.5 py-0.5 text-[9px] uppercase font-bold text-neutral-400">
                              {s.type}
                            </span>
                          </div>

                          {s.snippet && (
                            <p className="text-[11px] text-neutral-400 line-clamp-2 mt-1 leading-relaxed">
                              {s.snippet}
                            </p>
                          )}

                          {s.link && (
                            <a
                              href={s.link}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] text-brand hover:underline mt-1"
                            >
                              <span>Open in Google</span>
                              <ExternalLink className="size-2.5" />
                            </a>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => handleRemoveSource(s.id)}
                        className="rounded-lg p-1.5 text-neutral-500 hover:text-destructive hover:bg-destructive/10 transition opacity-80 group-hover:opacity-100"
                        title="Remove source"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Bottom Composer matching Screenshot 5 & 6 */}
      <footer className="shrink-0 px-4 pb-6 pt-2 bg-gradient-to-t from-black via-black to-transparent">
        <div className="mx-auto max-w-xl flex items-center gap-2 rounded-full bg-[#1c1c1e] p-1.5 pl-3 border border-neutral-800 focus-within:border-neutral-600 transition shadow-2xl">
          {/* Plus action button */}
          <button
            type="button"
            onClick={() => setAddSourceOpen(true)}
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
            title="Add Google Drive, Sheets, Gmail or File"
          >
            <Plus className="size-5" />
          </button>

          {/* Textarea/input with placeholder 'New chat' matching screenshot */}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
            placeholder={
              activeTab === "sources"
                ? "Ask about these sources…"
                : "New chat"
            }
            className="flex-1 bg-transparent py-2 px-1 text-sm text-white placeholder:text-neutral-500 outline-none"
          />

          {/* Mic icon button */}
          <button
            type="button"
            onClick={handleVoiceInput}
            className={`flex size-8 shrink-0 items-center justify-center rounded-full transition ${
              listening
                ? "bg-red-500 text-white animate-pulse"
                : "text-neutral-400 hover:text-white hover:bg-neutral-800"
            }`}
            title="Voice input"
          >
            <Mic className="size-4" />
          </button>

          {/* Send or Audio assistant button */}
          {input.trim() ? (
            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={sending}
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-500 transition shadow-md active:scale-95 disabled:opacity-50"
              title="Send message"
            >
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (messages.length > 0) {
                  const last = [...messages].reverse().find((m) => m.role === "assistant");
                  if (last) speakText(last.content);
                } else {
                  handleSendMessage("Hello! Can you summarize what we can do in this project?");
                }
              }}
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-500 transition shadow-md active:scale-95"
              title="Audio assistant"
            >
              <AudioWaveform className="size-4" />
            </button>
          )}
        </div>
      </footer>

      {/* Modals */}
      {addSourceOpen && (
        <AddSourceModal
          projectId={projectId}
          isOpen={addSourceOpen}
          onClose={() => setAddSourceOpen(false)}
          onSourceAdded={(newSrc) => {
            setProject((prev) =>
              prev ? { ...prev, sources: [newSrc, ...(prev.sources || [])] } : null,
            );
          }}
        />
      )}

      {shareOpen && project && (
        <ShareProjectModal
          project={project}
          isOpen={shareOpen}
          onClose={() => setShareOpen(false)}
          onUpdated={() => {
            getProjectById(projectId).then((p) => p && setProject(p));
          }}
        />
      )}

      {settingsOpen && project && (
        <ProjectSettingsModal
          project={project}
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          onUpdated={(up) => setProject(up)}
        />
      )}
    </div>
  );
}
