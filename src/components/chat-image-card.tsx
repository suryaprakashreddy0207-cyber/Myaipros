import { useState } from "react";
import {
  Wand2,
  Download,
  Mic,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Send,
  Loader2,
  ExternalLink,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";

interface ChatImageCardProps {
  imageUrl: string;
  alt?: string;
  onEdit?: (editPrompt: string, originalUrl: string, aspectRatio?: "1:1" | "16:9" | "9:16" | "4:3") => void;
  isEditing?: boolean;
}

const EDIT_PRESETS = [
  { label: "Anime Style", prompt: "Convert into high-quality Japanese anime manga aesthetic with vibrant cel-shading" },
  { label: "Cyberpunk Neon", prompt: "Transform into a futuristic cyberpunk night scene with glowing neon lights and cinematic rain reflections" },
  { label: "Sunset Golden Hour", prompt: "Shift lighting to warm golden hour sunset with rich orange hues and dramatic long shadows" },
  { label: "35mm Vintage Film", prompt: "Give it authentic 35mm retro film grain, nostalgic colors, and subtle vintage analog texture" },
  { label: "Add Snow & Frost", prompt: "Add gentle falling snowflakes and frosty winter atmosphere to the scene" },
  { label: "3D Pixar Render", prompt: "Turn into a charming 3D stylized character animation render with soft subsurface scattering" },
  { label: "Studio Portrait", prompt: "Enhance with professional studio portrait lighting, softbox highlights, and clean bokeh background" },
];

export function ChatImageCard({
  imageUrl,
  alt = "AI Generated Image",
  onEdit,
  isEditing = false,
}: ChatImageCardProps) {
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [editPrompt, setEditPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState<"1:1" | "16:9" | "9:16" | "4:3">("1:1");

  function handleDownload() {
    try {
      const a = document.createElement("a");
      a.href = imageUrl;
      a.download = `myaipro-image-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("Image download started");
    } catch {
      window.open(imageUrl, "_blank");
    }
  }

  function handleApplyEdit(promptText?: string) {
    const text = (promptText ?? editPrompt).trim();
    if (!text) {
      toast.error("Please enter what you would like to edit");
      return;
    }
    if (onEdit) {
      onEdit(text, imageUrl, aspectRatio);
      setEditPrompt("");
      setShowEditPanel(false);
    }
  }

  return (
    <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-black/10 bg-surface shadow-md ring-1 ring-black/5 transition hover:shadow-lg">
      {/* Image Preview */}
      <div className="relative group bg-black/5 overflow-hidden">
        <img
          src={imageUrl}
          alt={alt}
          className="w-full object-cover max-h-[460px] transition-transform duration-300 group-hover:scale-[1.01]"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(e) => {
            const target = e.currentTarget;
            if (!target.dataset.triedFallback) {
              target.dataset.triedFallback = "true";
              const fallbackSubject = encodeURIComponent(alt.slice(0, 50));
              target.src = `https://image.pollinations.ai/prompt/${fallbackSubject}?width=800&height=600&nologo=true`;
            }
          }}
        />

        {/* Floating Quick Action Overlay */}
        <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-90 transition-opacity">
          <button
            onClick={() => setShowEditPanel((v) => !v)}
            className="flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md hover:bg-brand transition"
            title="Edit this image with AI"
          >
            <Wand2 className="size-3" />
            <span>Edit</span>
          </button>
          <button
            onClick={handleDownload}
            className="flex size-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md hover:bg-black/80 transition"
            title="Download image"
          >
            <Download className="size-3.5" />
          </button>
        </div>

        {/* Image Tag */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-md">
          <Sparkles className="size-2.5 text-amber-300" />
          <span>AI Image</span>
        </div>
      </div>

      {/* Action Footer Bar */}
      <div className="flex items-center justify-between border-t border-border/60 bg-canvas/40 px-3 py-2 text-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEditPanel((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-medium transition",
              showEditPanel
                ? "bg-brand text-brand-foreground"
                : "text-muted-foreground hover:bg-surface hover:text-ink"
            )}
          >
            <Wand2 className="size-3.5" />
            <span>Edit Image</span>
            {showEditPanel ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          </button>

          <Link
            to="/voice"
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-medium text-muted-foreground hover:bg-surface hover:text-ink transition"
            title="Discuss this image with Voice Assistant"
          >
            <Mic className="size-3.5 text-brand" />
            <span className="hidden sm:inline">Voice Assistant</span>
          </Link>
        </div>

        <button
          onClick={handleDownload}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-muted-foreground hover:text-ink hover:bg-surface transition"
        >
          <Download className="size-3.5" />
          <span className="hidden sm:inline">Save</span>
        </button>
      </div>

      {/* Expandable Image Edit Panel */}
      {showEditPanel && (
        <div className="border-t border-border/80 bg-surface p-3 animate-in slide-in-from-top-2 duration-150">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-ink flex items-center gap-1">
              <Sparkles className="size-3 text-brand" />
              Edit Image with Prompt (⚡ High Speed)
            </span>
            <div className="flex items-center gap-1 text-[10px]">
              <span className="text-muted-foreground">Ratio:</span>
              {(["1:1", "16:9", "9:16", "4:3"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setAspectRatio(r)}
                  className={cn(
                    "rounded px-1.5 py-0.5 font-mono text-[9px] transition",
                    aspectRatio === r
                      ? "bg-brand text-brand-foreground font-semibold"
                      : "bg-canvas text-muted-foreground hover:text-ink"
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Quick 1-Click Preset Chips */}
          <div className="mb-2.5 flex flex-wrap gap-1">
            {EDIT_PRESETS.map((p, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setEditPrompt(p.prompt);
                  handleApplyEdit(p.prompt);
                }}
                className="rounded-full border border-border/60 bg-canvas px-2.5 py-0.5 text-[10px] text-ink hover:border-brand hover:text-brand transition"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom Edit Input */}
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleApplyEdit();
                }
              }}
              placeholder="e.g. Add neon glasses, change to sunset background, make it anime..."
              className="flex-1 rounded-xl border border-border/80 bg-canvas px-3 py-1.5 text-xs text-ink placeholder:text-muted-foreground outline-none focus:border-brand transition"
            />
            <button
              onClick={() => handleApplyEdit()}
              disabled={isEditing || !editPrompt.trim()}
              className="flex items-center gap-1.5 rounded-xl bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground shadow-sm hover:opacity-90 active:scale-95 transition disabled:opacity-40"
            >
              {isEditing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Send className="size-3.5" />
              )}
              <span>Apply</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
