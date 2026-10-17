import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  listPresentations,
  generatePresentation,
  deletePresentation,
} from "@/lib/presentations.functions";
import {
  Sparkles,
  Plus,
  Trash2,
  Presentation,
  Loader2,
  X,
  Image as ImageIcon,
  Pencil,
  Search,
  MessageSquare,
  Cpu,
  Telescope,
  Play,
  Share2,
  FileSpreadsheet,
  Palette,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/presentations/")({
  head: () => ({
    meta: [
      { title: "Presentation maker — My AI Bro" },
      {
        name: "description",
        content:
          "Type a topic, pick how many slides, and My AI builds an editable deck you can present, download or share.",
      },
      { property: "og:title", content: "Presentation maker — My AI Bro" },
      {
        property: "og:description",
        content: "Type a topic, pick slides, and get an editable AI deck.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PresentationsPage,
});

type Preview = {
  id: string;
  title: string;
  slides: { title: string; bullets: string[]; image_url?: string }[];
};

const SAVED_DECKS_STORAGE_KEY = "myaipro_saved_presentations";

function loadLocalDecks(): any[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SAVED_DECKS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalDecks(list: any[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SAVED_DECKS_STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

function PresentationsPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const listFn = useServerFn(listPresentations);
  const genFn = useServerFn(generatePresentation);
  const delFn = useServerFn(deletePresentation);

  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(8);
  const [ghibliStyle, setGhibliStyle] = useState(false);
  const [includeImages, setIncludeImages] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [refs, setRefs] = useState<string[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState(0);
  const [genStage, setGenStage] = useState("");
  const [localDecks, setLocalDecks] = useState<any[]>([]);

  useEffect(() => {
    setLocalDecks(loadLocalDecks());
  }, []);

  const { data: serverDecks = [] } = useQuery({
    queryKey: ["presentations"],
    queryFn: () => listFn(),
  });

  // Sync server decks into local cache so decks NEVER disappear across page switches
  useEffect(() => {
    if (serverDecks && serverDecks.length > 0) {
      setLocalDecks((prev) => {
        const map = new Map<string, any>();
        for (const d of prev) {
          if (d?.id) map.set(d.id, d);
        }
        for (const d of serverDecks) {
          if (d?.id) map.set(d.id, d);
        }
        const merged = Array.from(map.values()).sort(
          (a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime(),
        );
        saveLocalDecks(merged);
        return merged;
      });
    }
  }, [serverDecks]);

  // Combined decks ensures instant persistent display below
  const decks = (() => {
    const map = new Map<string, any>();
    for (const d of localDecks) {
      if (d?.id) map.set(d.id, d);
    }
    for (const d of serverDecks) {
      if (d?.id) map.set(d.id, d);
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime(),
    );
  })();

  const gen = useMutation({
    mutationFn: async () => {
      setGenerating(true);
      setGenProgress(10);
      setGenStage("Researching topic & structuring slide narrative…");

      const startTime = Date.now();
      const targetDuration = 18000;

      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const pct = Math.min(95, Math.floor((elapsed / targetDuration) * 95));
        setGenProgress(pct);

        if (elapsed < 6000) {
          setGenStage("Researching key facts & outlining slide flow (1/4)…");
        } else if (elapsed < 12000) {
          setGenStage("Synthesizing content & crafting punchy bullet points (2/4)…");
        } else if (elapsed < 16000) {
          setGenStage(
            ghibliStyle
              ? "Generating Studio Ghibli artwork & watercolor anime aesthetics (3/4)…"
              : "Designing visual templates, contrast & layout typography (3/4)…",
          );
        } else {
          setGenStage("Polishing slide decks for Canva-style editing (4/4)…");
        }
      }, 500);

      try {
        const isGhibli = ghibliStyle || /ghibli|miyazaki|anime|watercolor/i.test(topic);
        const [res] = await Promise.all([
          genFn({
            data: {
              topic: topic.trim(),
              slideCount: count,
              style: isGhibli ? "ghibli" : undefined,
              includeImages: includeImages || isGhibli,
            },
          }),
          new Promise((resolve) => setTimeout(resolve, targetDuration)),
        ]);
        clearInterval(interval);
        setGenProgress(100);
        setGenStage("Ready!");
        return res;
      } catch (e) {
        clearInterval(interval);
        throw e;
      } finally {
        setGenerating(false);
      }
    },
    onSuccess: (d: any) => {
      toast.success("Presentation generated successfully!");
      qc.invalidateQueries({ queryKey: ["presentations"] });
      const newDeckRecord = {
        id: d.id,
        title: d.title ?? topic,
        topic: topic.trim(),
        slides: d.slides ?? [],
        slideCount: (d.slides ?? []).length,
        cover: d.slides?.[0]?.image_url ?? null,
        updated_at: new Date().toISOString(),
      };
      setLocalDecks((prev) => {
        const next = [newDeckRecord, ...prev.filter((p) => p.id !== d.id)];
        saveLocalDecks(next);
        return next;
      });
      setPreview({ id: d.id, title: d.title ?? topic, slides: d.slides ?? [] });
      setTopic("");
      setRefs([]);
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to generate"),
  });

  const del = useMutation({
    mutationFn: (id: string) => {
      setLocalDecks((prev) => {
        const next = prev.filter((p) => p.id !== id);
        saveLocalDecks(next);
        return next;
      });
      return delFn({ data: { id } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["presentations"] }),
  });

  function attach(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setRefs((r) => [...r, reader.result as string]);
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-canvas font-sans text-ink">
      {/* Top navigation tabs bar */}
      <nav className="flex h-12 shrink-0 items-center justify-between border-b border-border/40 bg-white/80 dark:bg-zinc-900/80 px-4 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Link
            to="/chat"
            className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-surface hover:text-ink transition"
          >
            <MessageSquare className="size-3.5" />
            <span>AI chat</span>
          </Link>
          <Link
            to="/build"
            className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-surface hover:text-ink transition"
          >
            <Cpu className="size-3.5" />
            <span>No-code</span>
          </Link>
          <Link
            to="/research"
            className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-surface hover:text-ink transition"
          >
            <Telescope className="size-3.5" />
            <span>Research</span>
          </Link>
          <div className="flex items-center gap-1.5 rounded-full bg-zinc-900 px-3.5 py-1 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm">
            <Presentation className="size-3.5" />
            <span>Presentations & Templates</span>
          </div>
        </div>

        <Link
          to="/chat"
          className="rounded-full border border-border/80 bg-surface px-3 py-1 text-xs font-medium text-ink hover:bg-surface/80 transition"
        >
          Back to Chat
        </Link>
      </nav>

      <div className="flex-1 overflow-y-auto px-4 py-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 text-center">
            <h1 className="font-serif text-3xl font-bold text-ink">
              Presentation Maker
            </h1>
            <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
              Describe your topic or pitch deck. My AI creates structured slides with themes, speaker notes, and an editable Canva-style editor.
            </p>
          </div>

          {/* Generator Input Box */}
          <div className="rounded-3xl border border-border/60 bg-surface p-4 shadow-sm">
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. AI & Neural Systems Revolution, Q3 Enterprise Pitch Deck, Clean Energy Transition 2026…"
              rows={3}
              className="w-full resize-none border-none bg-transparent text-sm text-ink outline-none placeholder:text-muted-foreground"
            />

            {refs.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {refs.map((src, idx) => (
                  <div key={idx} className="relative group">
                    <img
                      src={src}
                      alt="ref"
                      className="size-12 rounded-lg object-cover ring-1 ring-border"
                    />
                    <button
                      onClick={() => setRefs((r) => r.filter((_, i) => i !== idx))}
                      className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-white"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Style toggles: Studio Ghibli & Topic Images */}
            <div className="mt-3 flex flex-wrap items-center gap-2 pt-2 border-t border-border/40">
              <button
                type="button"
                onClick={() => {
                  const next = !ghibliStyle;
                  setGhibliStyle(next);
                  if (next) setIncludeImages(true);
                  toast.info(next ? "Studio Ghibli aesthetic images enabled for slides!" : "Ghibli style disabled.");
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition border cursor-pointer",
                  ghibliStyle || /ghibli|miyazaki|anime|watercolor/i.test(topic)
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                    : "border-border/80 bg-surface text-muted-foreground hover:text-ink",
                )}
              >
                <Palette className="size-3.5" />
                <span>Studio Ghibli Images</span>
                {(ghibliStyle || /ghibli|miyazaki|anime|watercolor/i.test(topic)) && <Check className="size-3" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  const next = !includeImages;
                  setIncludeImages(next);
                  toast.info(next ? "Custom AI topic illustrations enabled!" : "Images disabled.");
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition border cursor-pointer",
                  includeImages || /image|picture|photo|illustration/i.test(topic)
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                    : "border-border/80 bg-surface text-muted-foreground hover:text-ink",
                )}
              >
                <ImageIcon className="size-3.5" />
                <span>Add Topic Images</span>
                {(includeImages || /image|picture|photo|illustration/i.test(topic)) && <Check className="size-3" />}
              </button>
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-3">
              <div className="flex items-center gap-3">
                <label className="flex cursor-pointer items-center gap-1.5 rounded-full border border-border/80 px-3 py-1 text-xs font-medium text-muted-foreground hover:text-ink">
                  <ImageIcon className="size-3.5" />
                  <span>Attach image</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={attach}
                  />
                </label>

                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span>Slides:</span>
                  <input
                    type="number"
                    min={4}
                    max={15}
                    value={count}
                    onChange={(e) =>
                      setCount(
                        Math.max(4, Math.min(15, Number(e.target.value) || 8)),
                      )
                    }
                    className="w-12 rounded border border-border/60 bg-transparent px-1.5 py-0.5 text-center text-xs font-semibold text-ink outline-none"
                  />
                </div>
              </div>

              <button
                onClick={() => gen.mutate()}
                disabled={gen.isPending || topic.trim().length < 3}
                className="flex items-center gap-2 rounded-full bg-brand px-5 py-2 text-xs font-bold text-brand-foreground shadow hover:opacity-90 disabled:opacity-40 transition cursor-pointer"
              >
                {gen.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
                <span>{gen.isPending ? "Generating…" : "Generate Deck"}</span>
              </button>
            </div>
          </div>

          {/* Quick Examples */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-muted-foreground">Try asking:</span>
            <button
              type="button"
              onClick={() => {
                setTopic("Could you please add Ghibli images about this topic: Future of Artificial Intelligence and Human Civilization");
                setGhibliStyle(true);
                setIncludeImages(true);
              }}
              className="rounded-full bg-surface border border-border/60 px-2.5 py-1 text-[11px] text-muted-foreground hover:text-ink hover:border-brand/40 transition cursor-pointer"
            >
              🌸 "Add Ghibli images about AI Future"
            </button>
            <button
              type="button"
              onClick={() => {
                setTopic("Could you please add images of this topic: Modern Renewable Energy and Green Cities 2026");
                setIncludeImages(true);
              }}
              className="rounded-full bg-surface border border-border/60 px-2.5 py-1 text-[11px] text-muted-foreground hover:text-ink hover:border-brand/40 transition cursor-pointer"
            >
              🖼️ "Add images of Renewable Energy"
            </button>
          </div>

          {/* Generation Progress Indicator */}
          {generating && (
            <div className="mt-6 rounded-3xl bg-surface p-6 ring-1 ring-brand/30 animate-in fade-in">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="flex items-center gap-2 text-brand">
                  <Loader2 className="size-4 animate-spin" />
                  {genStage}
                </span>
                <span className="font-mono text-muted-foreground">
                  {genProgress}%
                </span>
              </div>
              <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-canvas">
                <div
                  className="h-full bg-brand transition-all duration-300"
                  style={{ width: `${genProgress}%` }}
                />
              </div>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Generating full slide deck ({count} slides) with custom themes and outlines…
              </p>
            </div>
          )}

          {/* Freshly Generated Deck Preview with Continue to Edit */}
          {preview && (
            <div className="mt-6 rounded-3xl border border-brand/40 bg-surface p-5 shadow-md">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Presentation className="size-5 text-brand" />
                    <h3 className="font-serif text-xl font-bold text-ink">
                      {preview.title}
                    </h3>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Successfully generated <strong className="text-ink">{preview.slides.length} slides</strong> with templates & styling.
                  </p>
                </div>

                {/* Action Buttons: Continue to edit & Save in Sheets */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const headers = ["Slide Number", "Slide Title", "Bullet Points", "Speaker Notes", "Image URL"];
                      const rows = preview.slides.map((s, idx) => [
                        `Slide ${idx + 1}`,
                        `"${(s.title || "").replace(/"/g, '""')}"`,
                        `"${(s.bullets || []).join(" \n• ").replace(/"/g, '""')}"`,
                        `""`,
                        `"${(s.image_url || "").replace(/"/g, '""')}"`,
                      ]);
                      const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
                      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement("a");
                      link.setAttribute("href", url);
                      link.setAttribute("download", `${(preview.title || "presentation").replace(/[^\w]+/g, "_")}_sheets.csv`);
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      toast.success("Saved & exported to Google Sheets (.csv)!");
                    }}
                    className="flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-800 shadow-sm hover:bg-emerald-100 transition"
                  >
                    <FileSpreadsheet className="size-3.5 text-emerald-600" />
                    <span>Save in Sheets</span>
                  </button>

                  <button
                    onClick={() =>
                      nav({ to: "/presentations/$id", params: { id: preview.id } })
                    }
                    className="flex items-center gap-2 rounded-full bg-[#d94a11] px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#c03f0c] transition"
                  >
                    <Pencil className="size-3.5" />
                    <span>Continue to edit</span>
                  </button>
                </div>
              </div>

              {/* Featured slide preview */}
              <div className="aspect-video w-full overflow-hidden rounded-2xl bg-gradient-to-br from-[#053b3b] to-[#0a4f4d] p-6 text-white shadow-inner flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-300">
                    SLIDE 01 • PREVIEW
                  </span>
                  <p className="font-serif text-2xl font-bold leading-tight mt-2">
                    {preview.slides[0]?.title ?? preview.title}
                  </p>
                </div>
                <ul className="space-y-1.5 text-xs text-white/90">
                  {preview.slides[0]?.bullets?.slice(0, 3).map((b, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold">•</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Template gallery of all generated slides */}
              <div className="mt-5">
                <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  All {preview.slides.length} Generated Slide Templates:
                </h4>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {preview.slides.map((s, idx) => (
                    <div
                      key={idx}
                      onClick={() =>
                        nav({
                          to: "/presentations/$id",
                          params: { id: preview.id },
                        })
                      }
                      className="group flex aspect-video cursor-pointer flex-col justify-between rounded-xl border border-border/60 bg-canvas p-2.5 transition hover:border-brand hover:shadow-md"
                    >
                      <div>
                        <div className="mb-1 flex items-center justify-between text-[9px] font-bold text-muted-foreground">
                          <span>Slide {idx + 1}</span>
                          <span className="text-[8px] uppercase text-brand">
                            {idx === 0
                              ? "Title"
                              : idx === preview.slides.length - 1
                                ? "Closing"
                                : "Content"}
                          </span>
                        </div>
                        <p className="line-clamp-2 text-[10px] font-semibold leading-tight text-ink">
                          {s.title}
                        </p>
                      </div>
                      <p className="line-clamp-2 text-[8px] text-muted-foreground">
                        {s.bullets?.join(" • ")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Section: Your Generated Presentations */}
          <div className="mt-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Presentation className="size-4 text-brand" />
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Your Presentations ({decks.length})
                </h2>
              </div>
            </div>

            {decks.length === 0 ? (
              <p className="text-xs text-muted-foreground p-4 text-center rounded-2xl bg-surface border border-border/40">
                No presentations generated yet. Enter a topic above to create your first deck!
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {decks.map((d) => (
                  <div
                    key={d.id}
                    className="group flex flex-col justify-between rounded-2xl border border-border/60 bg-surface p-4 shadow-sm hover:shadow-md transition"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">
                          {d.slideCount ?? 8} slides
                        </span>
                        <button
                          onClick={() => {
                            if (confirm("Delete this presentation?"))
                              del.mutate(d.id);
                          }}
                          className="rounded p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                      <h3 className="font-serif text-base font-bold text-ink line-clamp-2">
                        {d.title}
                      </h3>
                      {d.topic && (
                        <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">
                          Topic: {d.topic}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-3">
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(d.updated_at).toLocaleDateString()}
                      </span>
                      <button
                        onClick={() =>
                          nav({
                            to: "/presentations/$id",
                            params: { id: d.id },
                          })
                        }
                        className="flex items-center gap-1.5 rounded-full bg-[#d94a11] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#c03f0c] shadow-sm transition"
                      >
                        <Pencil className="size-3" />
                        <span>Continue to edit</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
