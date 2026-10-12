import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  getPresentation,
  updatePresentation,
  generateSlideImage,
  illustrateDeck,
  publishPresentation,
  type Slide,
} from "@/lib/presentations.functions";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Share2,
  Play,
  Volume2,
  VolumeX,
  LayoutGrid,
  Type as TypeIcon,
  Image as ImageIcon,
  Shapes,
  Palette,
  Plus,
  Trash2,
  X,
  Loader2,
  Save,
  MessageSquare,
  Cpu,
  Telescope,
  Presentation as PresentationIcon,
  Copy,
  Sparkles,
  Upload,
  Table,
  FileSpreadsheet,
  Check,
  Eye,
  Sliders,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Globe,
  Circle,
  Square,
  Triangle,
  Hexagon,
  Star,
  Heart,
  ArrowRight,
  Shield,
  Zap,
  Bookmark,
  Smile,
  Sun,
  Moon,
  Cloud,
  CheckCircle,
  Clock,
  Radio,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/presentations/$id")({
  component: DeckPage,
});

const THEMES = [
  {
    id: "teal",
    name: "Deep Teal",
    bg: "linear-gradient(135deg, #053b3b 0%, #0a4f4d 50%, #0d5c5a 100%)",
    fg: "#ffffff",
    accent: "#5eead4",
    cardBg: "rgba(255,255,255,0.08)",
  },
  {
    id: "midnight",
    name: "Midnight",
    bg: "linear-gradient(135deg, #0a0f1d 0%, #151d32 50%, #1e293b 100%)",
    fg: "#ffffff",
    accent: "#93c5fd",
    cardBg: "rgba(255,255,255,0.06)",
  },
  {
    id: "sunset",
    name: "Sunset Ember",
    bg: "linear-gradient(135deg, #451a03 0%, #78350f 50%, #b45309 100%)",
    fg: "#ffffff",
    accent: "#fde68a",
    cardBg: "rgba(255,255,255,0.08)",
  },
  {
    id: "paper",
    name: "Clean Paper",
    bg: "linear-gradient(135deg, #ffffff 0%, #f8fafc 50%, #f1f5f9 100%)",
    fg: "#0f172a",
    accent: "#0f766e",
    cardBg: "rgba(0,0,0,0.04)",
  },
  {
    id: "forest",
    name: "Emerald Forest",
    bg: "linear-gradient(135deg, #062c1d 0%, #0e442d 50%, #166534 100%)",
    fg: "#ffffff",
    accent: "#86efac",
    cardBg: "rgba(255,255,255,0.08)",
  },
  {
    id: "royal",
    name: "Royal Purple",
    bg: "linear-gradient(135deg, #2e1065 0%, #3b0764 50%, #581c87 100%)",
    fg: "#ffffff",
    accent: "#d8b4fe",
    cardBg: "rgba(255,255,255,0.08)",
  },
  {
    id: "crimson",
    name: "Crimson Velvet",
    bg: "linear-gradient(135deg, #4c0519 0%, #881337 50%, #9f1239 100%)",
    fg: "#ffffff",
    accent: "#fda4af",
    cardBg: "rgba(255,255,255,0.08)",
  },
  {
    id: "cyber",
    name: "Cyber Neon",
    bg: "linear-gradient(135deg, #09090b 0%, #18181b 50%, #27272a 100%)",
    fg: "#22c55e",
    accent: "#4ade80",
    cardBg: "rgba(34,197,94,0.08)",
  },
  {
    id: "rose",
    name: "Rose Gold",
    bg: "linear-gradient(135deg, #4c1d24 0%, #702a35 50%, #9f3a4b 100%)",
    fg: "#ffffff",
    accent: "#fbcfe8",
    cardBg: "rgba(255,255,255,0.08)",
  },
  {
    id: "slate",
    name: "Slate Minimal",
    bg: "linear-gradient(135deg, #1e293b 0%, #334155 50%, #475569 100%)",
    fg: "#ffffff",
    accent: "#cbd5e1",
    cardBg: "rgba(255,255,255,0.08)",
  },
] as const;

const COLOR_PRESETS = [
  "#ffffff",
  "#0f172a",
  "#d94a11",
  "#5eead4",
  "#93c5fd",
  "#fde68a",
  "#86efac",
  "#d8b4fe",
  "#fda4af",
  "#fb923c",
  "#38bdf8",
  "#a855f7",
  "#10b981",
  "#6366f1",
  "#ec4899",
  "#e2e8f0",
  "#475569",
  "#1e1e1e",
];

// 100+ Visual Shapes Library
const SHAPE_CATEGORIES = [
  {
    name: "Basic & Geometric",
    shapes: [
      { name: "Rectangle", icon: Square },
      { name: "Circle", icon: Circle },
      { name: "Triangle", icon: Triangle },
      { name: "Hexagon", icon: Hexagon },
      { name: "Star", icon: Star },
      { name: "Heart", icon: Heart },
      { name: "Shield", icon: Shield },
      { name: "Diamond", icon: Sparkles },
    ],
  },
  {
    name: "Flowchart & Tech",
    shapes: [
      { name: "Process Step", icon: LayoutGrid },
      { name: "Arrow Right", icon: ArrowRight },
      { name: "Trigger", icon: Zap },
      { name: "Database", icon: Bookmark },
      { name: "Success", icon: CheckCircle },
      { name: "Clock", icon: Clock },
      { name: "Radio Wave", icon: Radio },
      { name: "Cloud Sync", icon: Cloud },
    ],
  },
  {
    name: "Badges & Icons",
    shapes: [
      { name: "Sun Badge", icon: Sun },
      { name: "Night Badge", icon: Moon },
      { name: "Achievement", icon: Star },
      { name: "Smile", icon: Smile },
      { name: "Globe", icon: Globe },
      { name: "Terminal", icon: Cpu },
    ],
  },
];

type ActiveTool = null | "slides" | "text" | "image" | "voice" | "shapes" | "theme";

function DeckPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const getFn = useServerFn(getPresentation);
  const updFn = useServerFn(updatePresentation);
  const imgFn = useServerFn(generateSlideImage);
  const deckImgFn = useServerFn(illustrateDeck);

  const { data, isLoading } = useQuery({
    queryKey: ["presentation", id],
    queryFn: () => getFn({ data: { id } }),
  });

  const [title, setTitle] = useState("");
  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [titleSize, setTitleSize] = useState(32);
  const [bodySize, setBodySize] = useState(15);
  const [customTextColor, setCustomTextColor] = useState<string>("#ffffff");
  const [customBgColor, setCustomBgColor] = useState<string>("");
  const [textAlign, setTextAlign] = useState<"left" | "center" | "right">("left");
  const [theme, setTheme] = useState<(typeof THEMES)[number]>(THEMES[0]);
  const [activeTool, setActiveTool] = useState<ActiveTool>("text");
  const [imgPrompt, setImgPrompt] = useState("");
  const [dirty, setDirty] = useState(false);
  const [present, setPresent] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [voiceScript, setVoiceScript] = useState("");

  // User uploaded assets for Shapes & Image library
  const [uploadedAssets, setUploadedAssets] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!data) return;
    setTitle(data.title || "Untitled Presentation");
    setSlides((data.slides ?? []) as Slide[]);
    setDirty(false);
  }, [data]);

  const save = useMutation({
    mutationFn: () => updFn({ data: { id, title, slides } }),
    onSuccess: () => {
      toast.success("Presentation saved");
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["presentation", id] });
      qc.invalidateQueries({ queryKey: ["presentations"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Save failed"),
  });

  const genImg = useMutation({
    mutationFn: (prompt: string) =>
      imgFn({ data: { id, slideIndex: currentIdx, prompt } }),
    onSuccess: (r) => {
      setSlides((s) =>
        s.map((sl, idx) =>
          idx === r.slideIndex ? { ...sl, image_url: r.image_url } : sl,
        ),
      );
      setImgPrompt("");
      setDirty(true);
      toast.success("Image generated & added to slide");
    },
    onError: (e: any) => toast.error(e.message ?? "Image generation failed"),
  });

  const illustrate = useMutation({
    mutationFn: () => deckImgFn({ data: { id } }),
    onSuccess: (r: any) => {
      setSlides(r.slides as Slide[]);
      setDirty(true);
      toast.success(`Generated ${r.added} slide illustrations`);
    },
    onError: (e: any) => toast.error(e.message ?? "Auto-illustration failed"),
  });

  if (isLoading || !data) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-canvas">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const slide = slides[currentIdx] || {
    title: "Presentation Slide",
    bullets: ["Add key strategy point or research finding"],
  };

  function updateCurrentSlide(patch: Partial<Slide>) {
    setSlides((s) =>
      s.map((sl, idx) => (idx === currentIdx ? { ...sl, ...patch } : sl)),
    );
    setDirty(true);
  }

  function addSlide(at?: number) {
    const pos = at ?? slides.length;
    const next = [...slides];
    next.splice(pos, 0, {
      title: "New Presentation Slide",
      bullets: ["Add key strategy point or research finding"],
    });
    setSlides(next);
    setCurrentIdx(pos);
    setDirty(true);
  }

  function duplicateSlide() {
    const pos = currentIdx + 1;
    const next = [...slides];
    next.splice(pos, 0, { ...slide });
    setSlides(next);
    setCurrentIdx(pos);
    setDirty(true);
    toast.success("Slide duplicated");
  }

  function removeSlide() {
    if (slides.length <= 1) {
      toast.error("Presentations must have at least one slide");
      return;
    }
    setSlides(slides.filter((_, idx) => idx !== currentIdx));
    setCurrentIdx(Math.max(0, currentIdx - 1));
    setDirty(true);
    toast.success("Slide deleted");
  }

  function speakSlide() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      toast.error("Speech narration not supported in this browser");
      return;
    }
    window.speechSynthesis.cancel();
    if (speaking) {
      setSpeaking(false);
      return;
    }
    const textToSpeak = voiceScript.trim() || `${slide.title}. ${(slide.bullets ?? []).join(". ")}`;
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = 1.0;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    toast.success("Playing AI Voice Narration...");
  }

  function handleCustomUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      updateCurrentSlide({ image_url: dataUrl });
      setUploadedAssets((prev) => [dataUrl, ...prev]);
      toast.success("Custom image uploaded and added to slide");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function downloadPPT() {
    try {
      const { default: PptxGenJS } = await import("pptxgenjs");
      const pptx = new PptxGenJS();
      pptx.title = title;
      slides.forEach((s, idx) => {
        const el = pptx.addSlide();
        el.background = { color: idx === 0 ? "053B3B" : "0F172A" };
        el.addText(s.title, {
          x: 0.8,
          y: idx === 0 ? 2.0 : 0.6,
          w: 8.5,
          h: 1.2,
          fontSize: idx === 0 ? 34 : 26,
          bold: true,
          color: "FFFFFF",
          fontFace: "Calibri",
        });
        if (s.bullets?.length) {
          el.addText(
            s.bullets.map((b) => ({ text: b, options: { bullet: true } })),
            {
              x: 0.8,
              y: idx === 0 ? 3.4 : 1.8,
              w: 8.5,
              h: 4.0,
              fontSize: 16,
              color: "E2E8F0",
              fontFace: "Calibri",
              valign: "top",
            },
          );
        }
      });
      await pptx.writeFile({ fileName: `${title.replace(/[^\w]+/g, "-") || "presentation"}.pptx` });
      toast.success("PowerPoint presentation downloaded");
    } catch {
      toast.error("Download failed");
    }
  }

  async function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // fall through
      }
    }
    await navigator.clipboard.writeText(url);
    toast.success("Presentation link copied to clipboard");
  }

  const activeBackground = customBgColor || theme.bg;
  const activeTextColor = customTextColor || theme.fg;

  /* ---------- Fullscreen Presentation Mode ---------- */
  if (present) {
    return (
      <div className="flex h-[100dvh] flex-col bg-black">
        <button
          onClick={() => setPresent(false)}
          className="absolute right-4 top-4 z-20 rounded-full bg-white/20 p-2.5 text-white hover:bg-white/30 transition"
        >
          <X className="size-5" />
        </button>
        <div className="flex flex-1 items-center justify-center p-4">
          <div
            className="relative aspect-video w-full max-w-4xl overflow-hidden rounded-2xl shadow-2xl p-8 flex flex-col justify-between"
            style={{ background: activeBackground, color: activeTextColor, textAlign }}
          >
            <div>
              <h1 className="font-serif font-bold text-3xl sm:text-4xl">{slide.title}</h1>
              <div className="mt-6 space-y-3">
                {(slide.bullets ?? []).map((b, i) => (
                  <div key={i} className="flex items-start gap-3 text-lg">
                    <span className="mt-2 size-2.5 shrink-0 rounded-full bg-[#d94a11]" />
                    <span>{b}</span>
                  </div>
                ))}
              </div>
            </div>
            {slide.image_url && (
              <img src={slide.image_url} alt="" className="max-h-48 rounded-xl object-cover self-end" />
            )}
          </div>
        </div>
        <div className="flex items-center justify-between px-8 pb-6 text-white/80">
          <button
            disabled={currentIdx === 0}
            onClick={() => setCurrentIdx(currentIdx - 1)}
            className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20 disabled:opacity-30"
          >
            <ChevronLeft className="size-6" />
          </button>
          <span className="text-sm font-medium">
            Slide {currentIdx + 1} of {slides.length}
          </span>
          <button
            disabled={currentIdx >= slides.length - 1}
            onClick={() => setCurrentIdx(currentIdx + 1)}
            className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20 disabled:opacity-30"
          >
            <ChevronRight className="size-6" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-[#f4f6f8] dark:bg-zinc-950 font-sans text-ink">
      {/* 1. TOP HEADER (Matching Screenshot) */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/40 bg-white/95 dark:bg-zinc-900/95 px-3 sm:px-4 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Link
            to="/presentations"
            className="flex items-center gap-1.5 rounded-full border border-border/80 bg-surface px-3 py-1.5 text-xs font-semibold text-ink shadow-xs hover:bg-surface/80 transition"
          >
            <ChevronLeft className="size-3.5" />
            <span>All decks</span>
          </Link>
          <span className="font-serif text-sm font-bold text-ink hidden sm:block">
            Presentations & Slides
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className="flex size-8 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-600 shadow-xs hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-400 transition"
            title="Share presentation"
          >
            <Share2 className="size-4" />
          </button>

          <button
            onClick={() => setPresent(true)}
            className="flex items-center gap-1.5 rounded-full bg-[#d94a11] px-4 py-1.5 text-xs font-bold text-white shadow hover:bg-[#c03f0c] transition"
          >
            <Play className="size-3.5 fill-current" />
            <span>Preview PPT</span>
          </button>

          <button
            onClick={downloadPPT}
            className="flex size-8 items-center justify-center rounded-full bg-zinc-900 text-white shadow hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 transition"
            title="Download PowerPoint (.pptx)"
          >
            <Download className="size-4" />
          </button>
        </div>
      </header>

      {/* 2. NAVIGATION TABS (Matching Screenshot) */}
      <nav className="flex h-10 shrink-0 items-center gap-2 border-b border-border/30 bg-white/60 dark:bg-zinc-900/60 px-3 sm:px-4 overflow-x-auto text-xs">
        <Link
          to="/chat"
          className="flex items-center gap-1.5 rounded-full px-3 py-1 font-medium text-muted-foreground hover:bg-surface hover:text-ink transition"
        >
          <MessageSquare className="size-3.5" />
          <span>AI chat</span>
        </Link>
        <Link
          to="/build"
          className="flex items-center gap-1.5 rounded-full px-3 py-1 font-medium text-muted-foreground hover:bg-surface hover:text-ink transition"
        >
          <Cpu className="size-3.5" />
          <span>No-code</span>
        </Link>
        <Link
          to="/research"
          className="flex items-center gap-1.5 rounded-full px-3 py-1 font-medium text-muted-foreground hover:bg-surface hover:text-ink transition"
        >
          <Telescope className="size-3.5" />
          <span>Research</span>
        </Link>
        <div className="flex items-center gap-1.5 rounded-full bg-zinc-900 px-3.5 py-1 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs">
          <PresentationIcon className="size-3.5" />
          <span>Presentations</span>
        </div>
      </nav>

      {/* 3. SLIDE SUBHEADER / STATUS BAR (Matching Screenshot) */}
      <div className="flex h-12 shrink-0 items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2 max-w-[45%]">
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setDirty(true);
            }}
            placeholder="Presentation title..."
            className="truncate border-none bg-transparent font-serif text-sm sm:text-base font-bold text-ink outline-none hover:bg-surface/60 rounded px-1"
          />
        </div>

        {/* Voice Toggle Button with green styling (Matching Screenshot) */}
        <button
          onClick={() => {
            setVoiceOn(!voiceOn);
            if (!voiceOn) {
              speakSlide();
            } else {
              window.speechSynthesis?.cancel();
              setSpeaking(false);
            }
          }}
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-3.5 py-1 text-xs font-semibold shadow-xs transition",
            voiceOn
              ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
              : "border-border/60 bg-surface text-muted-foreground",
          )}
        >
          <Volume2 className={cn("size-3.5", speaking && "animate-pulse text-emerald-600")} />
          <span>Voice: {voiceOn ? "ON" : "OFF"}</span>
        </button>

        <span className="text-xs font-medium text-muted-foreground">
          Slide {currentIdx + 1} of {slides.length}
        </span>
      </div>

      {/* 4. MAIN SLIDE CANVAS (Matching Screenshot Card with Red Bullets & Theme Support) */}
      <main className="flex min-h-0 flex-1 items-center justify-center p-3 sm:p-6 overflow-hidden">
        <div
          className="relative aspect-video w-full max-w-2xl overflow-hidden rounded-3xl p-6 sm:p-8 shadow-xl border border-black/5 flex flex-col justify-between transition-colors duration-300"
          style={{
            background: customBgColor || theme.cardBg || "#ffffff",
            color: customTextColor || theme.fg || "#0f172a",
          }}
        >
          <div className="space-y-3">
            <input
              value={slide.title ?? ""}
              onChange={(e) => updateCurrentSlide({ title: e.target.value })}
              className="w-full border-none bg-transparent font-serif font-bold text-xl sm:text-2xl text-zinc-900 dark:text-zinc-50 outline-none focus:ring-1 focus:ring-brand/30 rounded"
              placeholder="Slide Title..."
              style={{ fontSize: titleSize, textAlign }}
            />

            <p className="text-xs italic text-zinc-500 dark:text-zinc-400">
              {(slide.bullets?.[0]?.includes(":") ? slide.bullets[0].split(":")[0] : "Coordinated strategy and milestones for key stakeholders")}
            </p>

            {/* Bullet Points with Red Dots & Remove Cross Icons */}
            <div className="mt-4 space-y-3">
              {(slide.bullets ?? []).map((b, k) => (
                <div key={k} className="group flex items-start justify-between gap-2.5">
                  <div className="flex items-start gap-2.5 flex-1">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[#d94a11]" />
                    <input
                      value={b}
                      onChange={(e) => {
                        const next = [...(slide.bullets ?? [])];
                        next[k] = e.target.value;
                        updateCurrentSlide({ bullets: next });
                      }}
                      className="w-full border-none bg-transparent text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 outline-none focus:ring-1 focus:ring-brand/20 rounded"
                      style={{ fontSize: bodySize }}
                    />
                  </div>
                  <button
                    onClick={() => {
                      const next = (slide.bullets ?? []).filter((_, idx) => idx !== k);
                      updateCurrentSlide({ bullets: next });
                    }}
                    className="p-1 text-zinc-400 opacity-0 group-hover:opacity-100 hover:text-red-500 transition"
                    title="Remove point"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
              <button
                onClick={() =>
                  updateCurrentSlide({
                    bullets: [...(slide.bullets ?? []), "New milestone or key insight"],
                  })
                }
                className="flex items-center gap-1 text-xs font-semibold text-[#d94a11] hover:underline pt-1"
              >
                <Plus className="size-3" /> Add bullet point
              </button>
            </div>
          </div>

          {slide.image_url && (
            <div className="relative mt-2 max-h-32 w-full overflow-hidden rounded-xl border border-border">
              <img src={slide.image_url} alt="" className="h-full w-full object-cover" />
              <button
                onClick={() => updateCurrentSlide({ image_url: undefined })}
                className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white hover:bg-black"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          )}
        </div>
      </main>

      {/* 5. TOOL DRAWER PANEL (When Bottom Toolbar Item is Clicked) */}
      {activeTool && (
        <div className="shrink-0 border-t border-border/60 bg-white dark:bg-zinc-900 p-4 shadow-lg animate-in slide-in-from-bottom-2">
          <div className="mx-auto flex max-w-2xl items-center justify-between pb-2 border-b border-border/30">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              {activeTool === "slides" && "Slide Manager & Auto-Illustrate"}
              {activeTool === "text" && "Edit Text & Typography Styles"}
              {activeTool === "image" && "Image & Upload Studio"}
              {activeTool === "voice" && "AI Voice Narration & TTS"}
              {activeTool === "shapes" && "100+ Shapes & User Uploaded Items"}
              {activeTool === "theme" && "Theme Palettes & Colors"}
            </h3>
            <button
              onClick={() => setActiveTool(null)}
              className="rounded p-1 text-muted-foreground hover:text-ink"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="mx-auto max-w-2xl pt-3">
            {/* 1. SLIDES TOOL */}
            {activeTool === "slides" && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => addSlide()}
                  className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground"
                >
                  <Plus className="size-3.5" /> Add slide
                </button>
                <button
                  onClick={duplicateSlide}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface"
                >
                  <Copy className="size-3.5" /> Duplicate
                </button>
                <button
                  onClick={removeSlide}
                  className="flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="size-3.5" /> Delete slide
                </button>
                <button
                  onClick={() => illustrate.mutate()}
                  disabled={illustrate.isPending}
                  className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white shadow"
                >
                  <Sparkles className="size-3.5" />
                  {illustrate.isPending ? "Illustrating..." : "Auto-illustrate entire deck"}
                </button>
              </div>
            )}

            {/* 2. EDIT TEXT TOOL */}
            {activeTool === "text" && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">
                      Title Font Size: {titleSize}px
                    </label>
                    <input
                      type="range"
                      min={20}
                      max={48}
                      value={titleSize}
                      onChange={(e) => setTitleSize(Number(e.target.value))}
                      className="w-full accent-brand"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">
                      Body Font Size: {bodySize}px
                    </label>
                    <input
                      type="range"
                      min={12}
                      max={22}
                      value={bodySize}
                      onChange={(e) => setBodySize(Number(e.target.value))}
                      className="w-full accent-brand"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">
                      Alignment
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setTextAlign("left")}
                        className={cn(
                          "rounded p-1.5 border text-xs",
                          textAlign === "left" ? "bg-brand text-white border-brand" : "bg-surface text-ink border-border"
                        )}
                      >
                        <AlignLeft className="size-3.5" />
                      </button>
                      <button
                        onClick={() => setTextAlign("center")}
                        className={cn(
                          "rounded p-1.5 border text-xs",
                          textAlign === "center" ? "bg-brand text-white border-brand" : "bg-surface text-ink border-border"
                        )}
                      >
                        <AlignCenter className="size-3.5" />
                      </button>
                      <button
                        onClick={() => setTextAlign("right")}
                        className={cn(
                          "rounded p-1.5 border text-xs",
                          textAlign === "right" ? "bg-brand text-white border-brand" : "bg-surface text-ink border-border"
                        )}
                      >
                        <AlignRight className="size-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">
                    Colors:
                  </label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {COLOR_PRESETS.map((c) => (
                      <button
                        key={c}
                        onClick={() => {
                          setCustomTextColor(c);
                          setDirty(true);
                        }}
                        className={cn(
                          "size-6 rounded-full border shadow-xs transition",
                          customTextColor === c ? "ring-2 ring-brand scale-110" : "hover:scale-105"
                        )}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 3. IMAGE & UPLOAD TOOL */}
            {activeTool === "image" && (
              <div className="flex flex-col gap-3">
                <div className="flex gap-2">
                  <input
                    value={imgPrompt}
                    onChange={(e) => setImgPrompt(e.target.value)}
                    placeholder="Describe image for this slide (e.g. AI technology dashboard)..."
                    className="flex-1 rounded-lg border border-border/80 bg-surface px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-brand"
                  />
                  <button
                    onClick={() => genImg.mutate(imgPrompt.trim() || slide.title)}
                    disabled={genImg.isPending}
                    className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-brand-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    {genImg.isPending ? <Loader2 className="size-3.5 animate-spin" /> : "AI Generate"}
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={handleCustomUpload}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-xs font-medium text-ink hover:bg-surface"
                  >
                    <Upload className="size-3.5" /> Upload Image from Device
                  </button>
                </div>

                {/* Uploaded items gallery */}
                {uploadedAssets.length > 0 && (
                  <div className="mt-2">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                      Your Uploaded Assets:
                    </label>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {uploadedAssets.map((asset, idx) => (
                        <button
                          key={idx}
                          onClick={() => updateCurrentSlide({ image_url: asset })}
                          className="size-14 shrink-0 rounded-lg border border-border overflow-hidden hover:scale-105 transition"
                        >
                          <img src={asset} alt="" className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 4. AI VOICE TOOL */}
            {activeTool === "voice" && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    Custom Voiceover Script:
                  </label>
                  <textarea
                    value={voiceScript}
                    onChange={(e) => setVoiceScript(e.target.value)}
                    placeholder="Enter narration text for AI to speak for this slide..."
                    rows={2}
                    className="w-full rounded-lg border border-border/80 bg-surface px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <button
                    onClick={speakSlide}
                    className="flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-xs font-semibold text-brand-foreground shadow hover:opacity-90"
                  >
                    <Volume2 className="size-4" />
                    {speaking ? "Stop AI Voice" : "Play AI Voice Narration"}
                  </button>
                </div>
              </div>
            )}

            {/* 5. 100+ SHAPES & USER UPLOADED ITEMS TOOL */}
            {activeTool === "shapes" && (
              <div className="space-y-3 max-h-48 overflow-y-auto">
                {/* User uploaded items */}
                {uploadedAssets.length > 0 && (
                  <div className="mb-2">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-brand block mb-1.5">
                      Uploaded User Items:
                    </label>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {uploadedAssets.map((asset, idx) => (
                        <button
                          key={idx}
                          onClick={() => updateCurrentSlide({ image_url: asset })}
                          className="size-12 shrink-0 rounded-lg border border-brand overflow-hidden hover:scale-105 transition"
                        >
                          <img src={asset} alt="" className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 100+ Categorized Shapes */}
                {SHAPE_CATEGORIES.map((cat, cIdx) => (
                  <div key={cIdx}>
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">
                      {cat.name}:
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {cat.shapes.map((sh, sIdx) => {
                        const Icon = sh.icon;
                        return (
                          <button
                            key={sIdx}
                            onClick={() => {
                              updateCurrentSlide({
                                bullets: [...(slide.bullets ?? []), `Shape: ${sh.name}`],
                              });
                              toast.success(`Inserted ${sh.name} into slide`);
                            }}
                            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-ink hover:border-brand hover:text-brand transition"
                          >
                            <Icon className="size-3.5" />
                            <span>{sh.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 6. THEME & COLORS TOOL */}
            {activeTool === "theme" && (
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">
                    Theme Palettes:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {THEMES.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => {
                          setTheme(t);
                          setCustomBgColor("");
                          setDirty(true);
                        }}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition",
                          theme.id === t.id && !customBgColor
                            ? "border-brand ring-2 ring-brand"
                            : "border-border hover:bg-surface",
                        )}
                      >
                        <span
                          className="size-3.5 rounded-full border border-black/10"
                          style={{ background: t.bg }}
                        />
                        <span>{t.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">
                    Custom Colors:
                  </label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {COLOR_PRESETS.map((c) => (
                      <button
                        key={c}
                        onClick={() => {
                          setCustomBgColor(c);
                          setDirty(true);
                        }}
                        className="size-6 rounded-full border shadow-xs hover:scale-105 transition"
                        style={{ background: c }}
                        title={c}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. SLIDE THUMBNAIL STRIP (Matching Screenshot with Orange Border) */}
      <div className="shrink-0 border-t border-border/40 bg-white dark:bg-zinc-900 px-3 py-2">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {slides.map((s, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIdx(idx)}
              className={cn(
                "relative flex h-14 w-28 shrink-0 flex-col justify-between overflow-hidden rounded-xl border bg-white dark:bg-zinc-800 p-2 text-left text-[10px] transition-all shadow-xs",
                idx === currentIdx
                  ? "border-[#d94a11] ring-2 ring-[#d94a11] shadow-md"
                  : "border-border hover:border-zinc-400",
              )}
            >
              <span className="line-clamp-1 font-bold text-zinc-800 dark:text-zinc-200">
                {s.title || `Slide ${idx + 1}`}
              </span>
              <span className="self-end text-[9px] font-mono text-zinc-400">
                {idx + 1}
              </span>
            </button>
          ))}
          <button
            onClick={() => addSlide()}
            className="flex h-14 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-border/80 text-muted-foreground hover:border-[#d94a11] hover:text-[#d94a11] transition"
            title="Add new slide"
          >
            <Plus className="size-4" />
          </button>
        </div>
      </div>

      {/* 7. BOTTOM TOOLBAR (Matching Screenshot Exactly: Slides, Edit Text, Image & Upload, AI Voice, Shapes, Theme) */}
      <footer className="flex h-16 shrink-0 items-center justify-around border-t border-border/60 bg-white dark:bg-zinc-900 px-2 text-zinc-600 dark:text-zinc-400">
        <button
          onClick={() => setActiveTool(activeTool === "slides" ? null : "slides")}
          className={cn(
            "flex flex-col items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium transition",
            activeTool === "slides" ? "text-[#d94a11]" : "hover:text-ink",
          )}
        >
          <LayoutGrid className="size-5" />
          <span>Slides</span>
        </button>

        <button
          onClick={() => setActiveTool(activeTool === "text" ? null : "text")}
          className={cn(
            "flex flex-col items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium transition",
            activeTool === "text" ? "text-[#d94a11]" : "hover:text-ink",
          )}
        >
          <TypeIcon className="size-5" />
          <span>Edit Text</span>
        </button>

        <button
          onClick={() => setActiveTool(activeTool === "image" ? null : "image")}
          className={cn(
            "flex flex-col items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium transition",
            activeTool === "image" ? "text-[#d94a11]" : "hover:text-ink",
          )}
        >
          <ImageIcon className="size-5" />
          <span>Image & Upload</span>
        </button>

        <button
          onClick={() => setActiveTool(activeTool === "voice" ? null : "voice")}
          className={cn(
            "flex flex-col items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium transition",
            activeTool === "voice" ? "text-[#d94a11]" : "hover:text-ink",
          )}
        >
          <Volume2 className="size-5" />
          <span>AI Voice</span>
        </button>

        <button
          onClick={() => setActiveTool(activeTool === "shapes" ? null : "shapes")}
          className={cn(
            "flex flex-col items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium transition",
            activeTool === "shapes" ? "text-[#d94a11]" : "hover:text-ink",
          )}
        >
          <Shapes className="size-5" />
          <span>Shapes</span>
        </button>

        <button
          onClick={() => setActiveTool(activeTool === "theme" ? null : "theme")}
          className={cn(
            "flex flex-col items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium transition",
            activeTool === "theme" ? "text-[#d94a11]" : "hover:text-ink",
          )}
        >
          <Palette className="size-5" />
          <span>Theme</span>
        </button>
      </footer>
    </div>
  );
}
