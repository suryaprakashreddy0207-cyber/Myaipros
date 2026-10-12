import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  Folder,
  BookOpen,
  DollarSign,
  PenTool,
  Settings as SettingsIcon,
  ChevronDown,
  Sparkles,
  Loader2,
} from "lucide-react";
import { createProject } from "@/lib/projects-store";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/projects/new")({
  component: NewProjectPage,
});

const SUGGESTIONS = [
  {
    label: "Homework",
    icon: BookOpen,
    category: "Homework" as const,
    color: "text-blue-400 border-blue-500/40 bg-blue-500/10",
    defaultTitle: "Math & Science Homework",
    instructions: "You are an expert tutor. Break down problem steps clearly, explain underlying formulas, and encourage critical thinking.",
  },
  {
    label: "Investing",
    icon: DollarSign,
    category: "Investing" as const,
    color: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
    defaultTitle: "Investment Portfolio & Research",
    instructions: "Analyze financial concepts, market dynamics, and portfolio allocation strategies with balanced, data-driven reasoning.",
  },
  {
    label: "Writing",
    icon: PenTool,
    category: "Writing" as const,
    color: "text-purple-400 border-purple-500/40 bg-purple-500/10",
    defaultTitle: "Creative Story & Copywriting",
    instructions: "Act as an experienced editor and creative writer. Provide engaging narrative hooks, punchy structure, and refined prose.",
  },
];

function NewProjectPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<"Homework" | "Investing" | "Writing" | "General">("General");
  const [instructions, setInstructions] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  function applySuggestion(s: (typeof SUGGESTIONS)[number]) {
    setTitle(s.defaultTitle);
    setCategory(s.category);
    setInstructions(s.instructions);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setIsCreating(true);
    try {
      const proj = await createProject({
        title: title.trim(),
        category,
        instructions: instructions.trim(),
      });
      toast.success(`Project "${proj.title}" created!`);
      navigate({
        to: "/projects/$projectId",
        params: { projectId: proj.id },
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to create project");
      setIsCreating(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] w-full flex-col bg-black text-white font-sans">
      {/* Top Header matching screenshot 4 */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between px-4 bg-black/95 backdrop-blur-md">
        <button
          onClick={() => navigate({ to: "/projects" })}
          className="flex size-10 items-center justify-center rounded-full bg-neutral-900 text-white hover:bg-neutral-800 transition active:scale-95"
          aria-label="Back"
        >
          <ArrowLeft className="size-5" />
        </button>

        <h1 className="text-base font-semibold text-white">New Project</h1>

        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
            showSettings
              ? "bg-white text-black"
              : "bg-neutral-900 text-neutral-300 hover:text-white hover:bg-neutral-800"
          }`}
        >
          <SettingsIcon className="size-3.5" />
          <span>Settings</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col justify-between px-4 py-6 max-w-xl mx-auto w-full">
        <form onSubmit={handleCreate} className="space-y-4">
          {/* Main Title Input Card matching Screenshot 4 */}
          <div className="flex items-center gap-3 rounded-2xl bg-[#1c1c1e] px-4 py-3.5 border border-neutral-800 focus-within:border-neutral-600 transition">
            <Folder className="size-5 text-neutral-400 shrink-0" />
            <input
              type="text"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="E.g. Party planning"
              className="w-full bg-transparent text-sm text-white placeholder:text-neutral-500 outline-none"
            />
          </div>

          {/* Quick Suggestion Chips matching Screenshot 4 */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
            {SUGGESTIONS.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => applySuggestion(s)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition active:scale-95 ${s.color}`}
              >
                <s.icon className="size-3.5" />
                <span>{s.label}</span>
              </button>
            ))}
          </div>

          {/* Context Explainer text matching Screenshot 4 */}
          <p className="text-xs text-neutral-400 leading-relaxed pt-2 px-1">
            Projects give My AI shared context across chats and files, all in one place.
          </p>

          {/* Optional Project Settings Panel */}
          {showSettings && (
            <div className="rounded-2xl bg-[#1c1c1e] p-4 border border-neutral-800 space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                <Sparkles className="size-3.5 text-brand" />
                <span>Custom Instructions for My AI</span>
              </div>
              <textarea
                rows={3}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="How should My AI behave or respond in this project? (E.g. concise bullet points, specific programming stack, tone...)"
                className="w-full rounded-xl bg-black/50 border border-neutral-800 p-2.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-neutral-600"
              />
            </div>
          )}
        </form>

        {/* Bottom Create Button matching Screenshot 4 */}
        <div className="pt-8 pb-4">
          <button
            type="button"
            onClick={handleCreate}
            disabled={!title.trim() || isCreating}
            className={`flex w-full items-center justify-center gap-2 rounded-full py-3.5 px-6 text-sm font-semibold transition shadow-lg active:scale-95 ${
              title.trim()
                ? "bg-white text-black hover:bg-neutral-200"
                : "bg-[#2c2c2e] text-neutral-500 cursor-not-allowed"
            }`}
          >
            {isCreating ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Project"
            )}
          </button>
        </div>
      </main>
    </div>
  );
}
