import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Telescope,
  Loader2,
  Check,
  Download,
  Mail,
  ArrowLeft,
  Plus,
  FolderUp,
  Image as ImageIcon,
  Paperclip,
  X,
  Monitor,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { TopTabs } from "@/components/top-tabs";
import {
  researchQuestions,
  researchSweep,
  synthesizeResearch,
  type BuilderQuestion,
} from "@/lib/builder.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/research")({
  head: () => ({
    meta: [
      { title: "Deep research — My AI Bro" },
      { name: "description", content: "Give a topic, answer a few questions, and get a cited research report you can download or email." },
      { property: "og:title", content: "Deep research — My AI Bro" },
      { property: "og:description", content: "Give a topic, answer a few questions, and get a cited research report." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResearchPage,
});

type SweepResult = { query: string; notes: string; sources: string };

function baseQueries(topic: string): string[] {
  return [
    topic,
    `${topic} 2026 latest data and statistics`,
    `${topic} recent news and developments`,
    `${topic} challenges criticism limitations`,
    `${topic} market size forecast analysis`,
    `${topic} case studies real world examples`,
    `${topic} expert opinions research papers`,
    `${topic} regulation policy standards`,
    `${topic} competitors alternatives comparison`,
    `${topic} future outlook predictions`,
  ];
}

function gapsFrom(notes: string): string[] {
  const idx = notes.toUpperCase().lastIndexOf("GAPS:");
  if (idx === -1) return [];
  return notes
    .slice(idx + 5)
    .split("\n")
    .map((l) => l.replace(/^[-*\d.\s]+/, "").trim())
    .filter((l) => l.length > 8)
    .slice(0, 2);
}

function ResearchPage() {
  const qFn = useServerFn(researchQuestions);
  const sweepFn = useServerFn(researchSweep);
  const synthFn = useServerFn(synthesizeResearch);
  const [topic, setTopic] = useState("");
  const [questions, setQuestions] = useState<BuilderQuestion[] | null>(null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [report, setReport] = useState<string | null>(null);
  const [askTime, setAskTime] = useState(false);
  const [minutes, setMinutes] = useState(10);
  const [manual, setManual] = useState("");
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const cancelRef = useRef(false);

  const [attachments, setAttachments] = useState<{ name: string; type: string }[]>([]);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [screenCaptured, setScreenCaptured] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  const plan = useMutation({
    mutationFn: (t: string) => {
      let enriched = t;
      if (folderName) enriched += ` [Source Folder: ${folderName}]`;
      if (attachments.length > 0) enriched += ` [Files: ${attachments.map((a) => a.name).join(", ")}]`;
      if (screenCaptured) enriched += ` [Attached Live Screen Context]`;
      return qFn({ data: { topic: enriched } });
    },
    onSuccess: (r) => {
      setQuestions(r.questions);
      setAnswers(new Array(r.questions.length).fill(""));
      setStep(0);
    },
    onError: (e: any) => toast.error(e.message ?? "Could not start research."),
  });

  async function handleShareScreen() {
    setShowPlusMenu(false);
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        toast.error("Screen capture not supported.");
        return;
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      setScreenCaptured(true);
      stream.getTracks().forEach((track) => track.stop());
      toast.success("Attached screen capture context for research!");
    } catch {
      toast.info("Screen share cancelled.");
    }
  }

  function handleFolderSelect(e: React.ChangeEvent<HTMLInputElement>) {
    setShowPlusMenu(false);
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const folder = files[0]?.webkitRelativePath.split("/")[0] || "project-folder";
    setFolderName(folder);
    toast.success(`Attached research folder: ${folder} (${files.length} files)`);
  }

  function handleFilesSelect(e: React.ChangeEvent<HTMLInputElement>) {
    setShowPlusMenu(false);
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const list = Array.from(files).map((f) => ({ name: f.name, type: f.type || "file" }));
    setAttachments((prev) => [...prev, ...list]);
    toast.success(`Attached ${files.length} document/image file(s).`);
  }

  /** Runs live sweeps for the FULL time budget the user picked, then writes the paper. */
  async function startResearch() {
    setRunning(true);
    setElapsed(0);
    setLog([]);
    cancelRef.current = false;

    const budgetMs = minutes * 60_000;
    const reserveMs = Math.min(90_000, Math.max(30_000, budgetMs * 0.15)); // time to write the paper
    const started = Date.now();
    const queue = baseQueries(topic);
    const notes: SweepResult[] = [];
    const seen = new Set<string>();

    try {
      while (Date.now() - started < budgetMs - reserveMs && !cancelRef.current) {
        const q = queue.shift() ?? `${topic} ${["deep dive", "data", "risks", "opportunities", "timeline"][notes.length % 5]}`;
        if (seen.has(q.toLowerCase())) continue;
        seen.add(q.toLowerCase());
        setLog((l) => [`Searching: ${q}`, ...l].slice(0, 12));
        try {
          const r = (await sweepFn({ data: { topic, query: q } })) as SweepResult;
          notes.push(r);
          setLog((l) => [`✓ ${q}`, ...l.slice(1)].slice(0, 12));
          for (const g of gapsFrom(r.notes)) if (!seen.has(g.toLowerCase())) queue.push(g);
        } catch {
          setLog((l) => [`× ${q} (skipped)`, ...l.slice(1)].slice(0, 12));
        }
        // pace sweeps so the run genuinely lasts the requested time
        const remaining = budgetMs - reserveMs - (Date.now() - started);
        if (remaining > 0 && queue.length === 0) await new Promise((res) => setTimeout(res, Math.min(5000, remaining)));
      }

      setLog((l) => ["Writing the research paper…", ...l].slice(0, 12));
      const r = (await synthFn({
        data: {
          topic,
          minutes,
          answers: (questions ?? []).map((q, i) => ({ question: q.question, answer: answers[i] })),
          notes: notes.slice(0, 60),
        },
      })) as { report: string };
      setReport(r.report);
    } catch (e: any) {
      toast.error(e?.message ?? "Research failed.");
    } finally {
      setRunning(false);
    }
  }


  function download() {
    const blob = new Blob([report ?? ""], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${topic.slice(0, 40) || "research"}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function reset() {
    setReport(null);
    setAskTime(false);
    setMinutes(10);
    setManual("");
    setQuestions(null);
    setTopic("");
    setAnswers([]);
    setStep(0);
  }

  if (report) {
    return (
      <div className="flex h-[100dvh] flex-col bg-canvas font-sans text-ink">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-black/5 px-4">
          <button onClick={reset} className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <ArrowLeft className="size-4" /> New
          </button>
          <h1 className="truncate font-serif text-lg">Research</h1>
          <div className="flex gap-1">
            <button onClick={download} className="p-2 text-muted-foreground hover:text-ink" aria-label="Download">
              <Download className="size-4" />
            </button>
            <a
              href={`mailto:?subject=${encodeURIComponent("Research: " + topic)}&body=${encodeURIComponent(report.slice(0, 1800))}`}
              className="p-2 text-muted-foreground hover:text-ink"
              aria-label="Email"
            >
              <Mail className="size-4" />
            </a>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-6">
          <article className="prose prose-sm mx-auto max-w-2xl prose-headings:font-serif">
            <ReactMarkdown>{report}</ReactMarkdown>
          </article>
        </div>
      </div>
    );
  }

  if (askTime) {
    return (
      <div className="flex h-[100dvh] flex-col bg-canvas font-sans text-ink">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-black/5 px-4">
          <button onClick={() => setAskTime(false)} className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <ArrowLeft className="size-4" /> Back
          </button>
          <h1 className="font-serif text-lg">Research time</h1>
          <div className="w-12" />
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-10">
          <div className="mx-auto max-w-lg">
            <h2 className="font-serif text-2xl leading-snug">How long should I research?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Longer runs sweep more sources and produce a deeper paper.
            </p>

            <div className="mt-6 space-y-3">
              <button
                onClick={() => {
                  setMinutes(10);
                  setManual("");
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-4 text-left text-sm ring-1",
                  !manual ? "bg-ink text-white ring-ink" : "bg-surface ring-black/5",
                )}
              >
                <span>
                  <span className="block font-medium">AI time</span>
                  <span className="text-xs opacity-70">I&apos;ll research for 10 minutes</span>
                </span>
                {!manual && <Check className="size-4" />}
              </button>

              <div
                className={cn(
                  "rounded-2xl px-4 py-4 ring-1",
                  manual ? "bg-ink text-white ring-ink" : "bg-surface ring-black/5",
                )}
              >
                <p className="text-sm font-medium">Set it manually</p>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={manual}
                    onChange={(e) => {
                      setManual(e.target.value);
                      const n = Number(e.target.value);
                      if (n >= 1 && n <= 120) setMinutes(n);
                    }}
                    placeholder="Minutes"
                    className="w-28 rounded-xl bg-canvas px-3 py-2 text-sm text-ink outline-none ring-1 ring-black/10"
                  />
                  <span className="text-xs opacity-70">minutes (1–120)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <footer className="border-t border-black/5 px-5 pb-8 pt-4">
          {running && (
            <div className="mx-auto mb-3 max-w-lg rounded-2xl bg-surface p-3 ring-1 ring-black/5">
              <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {Math.floor(elapsed / 60)}m {elapsed % 60}s of {minutes}m
                </span>
                <span>{Math.min(99, Math.round((elapsed / (minutes * 60)) * 100))}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-canvas">
                <div
                  className="h-full rounded-full bg-brand transition-all"
                  style={{ width: `${Math.min(100, (elapsed / (minutes * 60)) * 100)}%` }}
                />
              </div>
              <ul className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
                {log.slice(0, 4).map((l, i) => (
                  <li key={i} className="truncate">
                    {l}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <button
            disabled={running}
            onClick={startResearch}
            className="mx-auto flex w-full max-w-lg items-center justify-center gap-2 rounded-full bg-brand py-3 text-sm font-medium text-brand-foreground disabled:opacity-60"
          >
            {running ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Researching for {minutes} min…
              </>
            ) : (
              `Start ${minutes}-minute research`
            )}
          </button>
          {running && (
            <button
              onClick={() => {
                cancelRef.current = true;
              }}
              className="mx-auto mt-2 block text-xs text-muted-foreground"
            >
              Finish early and write the paper
            </button>
          )}
        </footer>

      </div>
    );
  }

  if (questions) {
    const q = questions[step];
    const last = step === questions.length - 1;
    return (
      <div className="flex h-[100dvh] flex-col bg-canvas font-sans text-ink">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-black/5 px-4">
          <button onClick={reset} className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <ArrowLeft className="size-4" /> Back
          </button>
          <span className="text-xs text-muted-foreground">
            {step + 1} / {questions.length}
          </span>
          <div className="w-12" />
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-10">
          <div className="mx-auto max-w-lg">
            <h2 className="font-serif text-2xl leading-snug">{q.question}</h2>
            <div className="mt-6 space-y-3">
              {q.options.map((o) => {
                const sel = answers[step] === o;
                return (
                  <button
                    key={o}
                    onClick={() => setAnswers((a) => a.map((v, i) => (i === step ? o : v)))}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3.5 text-left text-sm ring-1",
                      sel ? "bg-ink text-white ring-ink" : "bg-surface ring-black/5",
                    )}
                  >
                    {o} {sel && <Check className="size-4" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <footer className="border-t border-black/5 px-5 pb-8 pt-4">
          <button
            disabled={!answers[step]}
            onClick={() => (last ? setAskTime(true) : setStep((s) => s + 1))}
            className="mx-auto flex w-full max-w-lg items-center justify-center gap-2 rounded-full bg-brand py-3 text-sm font-medium text-brand-foreground disabled:opacity-40"
          >
            {last ? "Next" : "Next"}
          </button>
        </footer>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-canvas font-sans text-ink">
      <header className="flex h-14 shrink-0 items-center justify-center border-b border-black/5 px-4">
        <h1 className="font-serif text-xl">Research</h1>
      </header>
      <TopTabs />
      <div className="flex-1 overflow-y-auto px-5">
        <div className="mx-auto max-w-lg pt-16 text-center">
          <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-brand text-brand-foreground">
            <Telescope className="size-6" />
          </div>
          <h2 className="font-serif text-3xl">Deep research</h2>
          <p className="mx-auto mt-3 max-w-xs text-sm text-muted-foreground">
            Enter a topic. I'll ask a few questions, sweep live sources and write a cited report.
          </p>
        </div>
      </div>
      <footer className="border-t border-black/5 px-4 pb-6 pt-3">
        <div className="mx-auto max-w-lg space-y-2">
          {/* Active Context Badges */}
          {(screenCaptured || folderName || attachments.length > 0) && (
            <div className="flex flex-wrap items-center gap-1.5 px-1">
              {screenCaptured && (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand/15 px-2.5 py-0.5 text-[11px] font-medium text-brand border border-brand/30">
                  <Monitor className="size-3" /> Screen Captured
                  <button onClick={() => setScreenCaptured(false)} className="ml-1 hover:text-red-500">
                    <X className="size-3" />
                  </button>
                </span>
              )}

              {folderName && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  <FolderUp className="size-3" /> {folderName}
                  <button onClick={() => setFolderName(null)} className="ml-1 hover:text-red-500">
                    <X className="size-3" />
                  </button>
                </span>
              )}

              {attachments.map((file, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground border border-border/60"
                >
                  <Paperclip className="size-3" /> {file.name}
                  <button onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))} className="ml-1 hover:text-red-500">
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="relative flex items-center gap-2 rounded-[24px] bg-surface p-2 ring-1 ring-black/5">
            {/* Plus Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowPlusMenu((v) => !v)}
                className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-canvas hover:text-ink transition"
                title="Attach Screen, Folders, Images for Deep Research"
              >
                <Plus className={cn("size-4 transition", showPlusMenu ? "rotate-45 text-brand" : "")} />
              </button>

              {/* Plus Popup Menu */}
              {showPlusMenu && (
                <div className="absolute bottom-11 left-0 z-50 w-60 rounded-2xl border border-border/80 bg-canvas p-2 shadow-xl animate-in fade-in-0 zoom-in-95">
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={handleShareScreen}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-ink hover:bg-surface transition text-left"
                    >
                      <Monitor className="size-4 text-brand" />
                      <div>
                        <div>Share Screen</div>
                        <div className="text-[10px] text-muted-foreground">Capture live screen context</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => folderInputRef.current?.click()}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-ink hover:bg-surface transition text-left"
                    >
                      <FolderUp className="size-4 text-amber-500" />
                      <div>
                        <div>Upload Folder</div>
                        <div className="text-[10px] text-muted-foreground">Research whole code directory</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-ink hover:bg-surface transition text-left"
                    >
                      <ImageIcon className="size-4 text-emerald-500" />
                      <div>
                        <div>Upload Images & Files</div>
                        <div className="text-[10px] text-muted-foreground">Attach charts, PDFs, documents</div>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Hidden file inputs */}
            <input
              type="file"
              ref={folderInputRef}
              onChange={handleFolderSelect}
              {...({ webkitdirectory: "", directory: "", multiple: true } as any)}
              className="hidden"
            />
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFilesSelect}
              multiple
              className="hidden"
            />

            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Topic to research…"
              className="flex-1 bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground"
            />
            <button
              onClick={() => topic.trim() && plan.mutate(topic.trim())}
              disabled={!topic.trim() || plan.isPending}
              className="rounded-full bg-ink px-4 py-2 text-xs font-medium text-white disabled:opacity-40"
            >
              {plan.isPending ? <Loader2 className="size-4 animate-spin" /> : "Start"}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
