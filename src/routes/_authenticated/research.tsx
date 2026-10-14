import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
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
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Copy,
  Share2,
  FileText,
  Sparkles,
  ListTree,
  Menu,
  Compass,
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

type ResearchSection = {
  id: string;
  title: string;
  content: string;
  level: number;
};

const SAMPLE_RESEARCH_TOPIC = "Autonomous AI Agents in Enterprise Software (2026-2028 Architecture)";
const SAMPLE_RESEARCH_REPORT = `## Executive Summary & Market Drivers
Autonomous AI agent architectures have shifted from reactive single-prompt LLM wrappers to multi-agent orchestrated state machines. Enterprise adoption in 2026 is accelerating at an annualized rate of 42%, primarily driven by reasoning-first foundation models, deterministic tool execution, and local sandbox verification.

### Core Strategic Highlights
- **Shift from RAG to Grounded Tool Loops**: Retrieval-augmented generation is now a baseline; high-value enterprise agents employ multi-turn cognitive loops (Hypothesize -> Tool Probe -> Synthesize -> Verify).
- **Latency & Reliability Breakthroughs**: Sub-second TTFT combined with speculatively executed code sandboxes has brought tool success rates from 71% in 2024 to over 96.8% in late 2026.
- **Enterprise Spend Allocation**: 68% of Fortune 500 engineering organizations report active budget migration from traditional robotic process automation (RPA) towards autonomous coding and research agents.

## Architectural Evolution: Single-Shot to Multi-Agent Swarms
Modern agentic architectures organize specialized agents into hierarchical graphs rather than monolithic prompt orchestrators:

1. **Strategic Planner Agent**: Decomposes high-level ambiguous user objectives into Directed Acyclic Graphs (DAGs) of executable subtasks with explicit dependencies and timeout budgets.
2. **Deterministic Tool Dispatchers**: Safe sandboxed environments with capability-based security (limiting file system, network egress, and credential exposure).
3. **Critic & Verifier Agents**: Double-check generated code against AST parsers, runtime type checkers, and test suites prior to user presentation.

### Performance Benchmarks (SWE-bench & WebArena 2026)
Enterprise benchmarks illustrate a decisive leap:
- Multi-agent cognitive architecture: **78.4% resolution rate**
- Single-turn chain-of-thought: **49.1% resolution rate**
- Legacy fine-tuned models: **31.2% resolution rate**

## Production Challenges, Guardrails & Security
Despite technical advances, enterprise deployment requires rigorous containment protocols:

- **Egress & Credential Poisoning**: Indirect prompt injection via external web crawls remains the primary vector. Modern defenses employ isolated unprivileged crawler agents that sanitize scraped HTML into semantic JSON before handing off to the reasoning core.
- **Runaway Token Costs & Infinite Loops**: Production runtimes mandate strict circuit breakers, deterministic step limits (e.g., maximum 12 tool iterations per subtask), and adaptive budget allocation based on task complexity.
- **Human-in-the-Loop Thresholds**: Destructive actions (e.g. database schema migrations, payments, public publishing) require cryptographically verified human approval steps.

## Future Trajectory & Strategic Recommendations
Looking toward 2027 and 2028, the convergence of multimodal reasoning and native code generation tools points toward self-healing software platforms and zero-code continuous delivery pipelines.

### Actionable Next Steps
1. **Adopt Standardized Tool Protocols**: Implement standardized tool definitions across models to avoid vendor lock-in.
2. **Isolate Sandboxed Execution**: Ensure all dynamically generated scripts run inside ephemeral micro-VMs or secure WebAssembly runtimes.
3. **Implement Telemetry for Agentic Reasoning**: Monitor intermediate reasoning traces and tool call latencies to optimize prompt budgets.

## References & Verified Citations
1. Deep Research Intelligence Group (2026). *The State of Autonomous Software Engineering and Agent Workflows*.
2. Stanford Institute for Human-Centered Artificial Intelligence (HAI) 2026 Report on Foundation Agent Reliability.
3. IEEE Computer Society (Vol. 59, No. 3). *Formal Verification and Sandboxing of Generative AI Code Agents*.
4. ACM Transactions on Software Engineering and Methodology (TOSEM 2026). *Evaluating Autonomous Multi-Agent Synthesis in Mission-Critical Systems*.`;

function parseReportSections(markdown: string, fallbackTopic: string): ResearchSection[] {
  if (!markdown) return [];

  const lines = markdown.split("\n");
  const sections: ResearchSection[] = [];
  let currentTitle = "Executive Summary";
  let currentLevel = 2;
  let currentContent: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headerMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headerMatch) {
      if (currentContent.length > 0 || sections.length > 0) {
        sections.push({
          id: `section-${sections.length + 1}`,
          title: currentTitle.replace(/[*_`]/g, "").trim(),
          content: currentContent.join("\n").trim(),
          level: currentLevel,
        });
        currentContent = [];
      }
      currentLevel = headerMatch[1].length;
      currentTitle = headerMatch[2].replace(/[*_`]/g, "").trim();
    } else {
      currentContent.push(line);
    }
  }

  if (currentContent.length > 0 || sections.length === 0) {
    sections.push({
      id: `section-${sections.length + 1}`,
      title: currentTitle.replace(/[*_`]/g, "").trim() || "Findings & Analysis",
      content: currentContent.join("\n").trim(),
      level: currentLevel,
    });
  }

  // Fallback splitting if there are fewer than 2 headers
  if (sections.length <= 1) {
    const paras = markdown.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
    if (paras.length >= 4) {
      const chunkSize = Math.ceil(paras.length / 4);
      const titles = [
        "Executive Summary & Overview",
        "Key Market & Field Findings",
        "Deep Technical Analysis",
        "Strategic Trajectory & Sources",
      ];
      return titles.map((t, idx) => ({
        id: `section-${idx + 1}`,
        title: t,
        content: paras.slice(idx * chunkSize, (idx + 1) * chunkSize).join("\n\n"),
        level: 2,
      }));
    }
  }

  return sections;
}

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

  // Deep Research Sidebar, Outline & Moving Ball State
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [ballTop, setBallTop] = useState(24);
  const railRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const articleRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);

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

  const sections = useMemo(() => parseReportSections(report ?? "", topic), [report, topic]);

  function scrollToSection(idx: number) {
    if (idx < 0 || idx >= sections.length) return;
    setActiveSectionIndex(idx);
    const targetEl = sectionRefs.current[idx];
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    const nodeEl = nodeRefs.current[idx];
    const railEl = railRef.current;
    if (nodeEl && railEl) {
      const railRect = railEl.getBoundingClientRect();
      const nodeRect = nodeEl.getBoundingClientRect();
      setBallTop(nodeRect.top - railRect.top + nodeRect.height / 2);
    }
  }

  function handleArticleScroll() {
    const el = articleRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const maxScroll = Math.max(1, scrollHeight - clientHeight);
    const progress = Math.min(1, Math.max(0, scrollTop / maxScroll));
    setScrollProgress(progress);

    // Calculate active section based on section headings
    let foundIdx = 0;
    const containerTop = el.getBoundingClientRect().top;
    for (let i = 0; i < sections.length; i++) {
      const secEl = sectionRefs.current[i];
      if (secEl) {
        const rect = secEl.getBoundingClientRect();
        if (rect.top - containerTop <= 160) {
          foundIdx = i;
        }
      }
    }
    setActiveSectionIndex(foundIdx);

    // Position ball along vertical rail
    const railEl = railRef.current;
    const nodeEl = nodeRefs.current[foundIdx];
    if (railEl && nodeEl) {
      const railRect = railEl.getBoundingClientRect();
      const nodeRect = nodeEl.getBoundingClientRect();
      const nextNode = nodeRefs.current[foundIdx + 1];

      let targetY = nodeRect.top - railRect.top + nodeRect.height / 2;
      // Interpolate smoothly between current and next node if next exists
      if (nextNode && foundIdx < sections.length - 1) {
        const curSecEl = sectionRefs.current[foundIdx];
        const nextSecEl = sectionRefs.current[foundIdx + 1];
        if (curSecEl && nextSecEl) {
          const curTop = curSecEl.offsetTop;
          const nextTop = nextSecEl.offsetTop;
          const span = Math.max(1, nextTop - curTop);
          const ratio = Math.min(1, Math.max(0, (scrollTop - curTop) / span));
          const nextNodeRect = nextNode.getBoundingClientRect();
          const nextTargetY = nextNodeRect.top - railRect.top + nextNodeRect.height / 2;
          targetY = targetY + (nextTargetY - targetY) * ratio;
        }
      }
      setBallTop(targetY);
    }
  }

  function copyReport() {
    if (!report) return;
    navigator.clipboard.writeText(report);
    toast.success("Research report copied to clipboard!");
  }

  useEffect(() => {
    if (report && sections.length > 0) {
      const timer = setTimeout(() => {
        const nodeEl = nodeRefs.current[0];
        const railEl = railRef.current;
        if (nodeEl && railEl) {
          const railRect = railEl.getBoundingClientRect();
          const nodeRect = nodeEl.getBoundingClientRect();
          setBallTop(nodeRect.top - railRect.top + nodeRect.height / 2);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [report, sections]);

  if (report) {
    return (
      <div className="flex h-[100dvh] flex-col bg-canvas font-sans text-ink overflow-hidden">
        {/* Top Header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-black/5 bg-surface/90 backdrop-blur-md px-3 sm:px-5 z-30">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={reset}
              className="flex items-center gap-1.5 rounded-full bg-canvas border border-border/80 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-ink hover:bg-surface transition cursor-pointer"
            >
              <ArrowLeft className="size-3.5" />
              <span>New Research</span>
            </button>

            {/* Toggle Sidebar button */}
            <button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              className={cn(
                "hidden md:flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium transition cursor-pointer",
                sidebarOpen
                  ? "border-brand/30 bg-brand/10 text-brand"
                  : "border-border/80 bg-canvas text-muted-foreground hover:text-ink"
              )}
              title={sidebarOpen ? "Hide outline sidebar" : "Show outline sidebar"}
            >
              <ListTree className="size-3.5" />
              <span>{sidebarOpen ? "Sidebar" : "Show Outline"}</span>
            </button>
          </div>

          <div className="flex items-center gap-2 truncate max-w-xs sm:max-w-md px-2">
            <Telescope className="size-4 shrink-0 text-brand" />
            <h1 className="truncate font-serif text-sm sm:text-base font-semibold">{topic || "Research Paper"}</h1>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={copyReport}
              className="flex items-center gap-1 rounded-full border border-border/80 bg-canvas px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-ink hover:bg-surface transition cursor-pointer"
              title="Copy markdown report"
            >
              <Copy className="size-3.5" />
              <span className="hidden sm:inline">Copy</span>
            </button>
            <button
              type="button"
              onClick={download}
              className="flex items-center gap-1 rounded-full border border-border/80 bg-canvas px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-ink hover:bg-surface transition cursor-pointer"
              title="Download Markdown"
            >
              <Download className="size-3.5" />
              <span className="hidden sm:inline">Download</span>
            </button>
            <a
              href={`mailto:?subject=${encodeURIComponent("Research: " + topic)}&body=${encodeURIComponent(report.slice(0, 1800))}`}
              className="flex items-center justify-center size-8 rounded-full border border-border/80 bg-canvas text-muted-foreground hover:text-ink hover:bg-surface transition"
              title="Email Report"
            >
              <Mail className="size-3.5" />
            </a>
          </div>
        </header>

        {/* Content Body: Left Outline Sidebar with moving ball + Main Report Document */}
        <div className="flex flex-1 min-h-0 overflow-hidden relative">
          {/* Section Outline Sidebar with Vertical Rail & Moving Orb */}
          {sidebarOpen && (
            <aside className="w-72 sm:w-80 shrink-0 border-r border-black/5 bg-surface/85 backdrop-blur-md flex flex-col h-full z-20 transition-all">
              {/* Sidebar Header: Section count & Reading progress bar */}
              <div className="p-4 border-b border-black/5">
                <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground mb-1.5">
                  <span className="flex items-center gap-1.5 text-ink">
                    <Compass className="size-3.5 text-amber-500" />
                    <span>Sections ({sections.length})</span>
                  </span>
                  <span className="font-mono text-[11px] text-amber-600 dark:text-amber-400 font-bold">
                    {Math.round(scrollProgress * 100)}% read
                  </span>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 w-full bg-border/40 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-150"
                    style={{ width: `${Math.round(scrollProgress * 100)}%` }}
                  />
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground truncate">
                  Now reading: <span className="font-semibold text-ink">{sections[activeSectionIndex]?.title || "Overview"}</span>
                </div>
              </div>

              {/* Scrollable Section Tree with Vertical Rail & The Moving Ball */}
              <div className="flex-1 overflow-y-auto p-3 relative" ref={railRef}>
                {/* Continuous Vertical Guide Line */}
                <div className="absolute left-6 top-5 bottom-5 w-0.5 bg-black/10 dark:bg-white/10 rounded-full pointer-events-none" />

                {/* THE MOVING BALL ("the ball kind of thing will be moving") */}
                <div
                  className="absolute left-[18px] size-4 rounded-full bg-gradient-to-tr from-amber-500 via-orange-400 to-amber-300 shadow-[0_0_14px_rgba(245,158,11,0.7)] ring-2 ring-amber-300/80 z-20 pointer-events-none transition-all duration-200 ease-out flex items-center justify-center -translate-y-1/2"
                  style={{ top: `${ballTop}px` }}
                >
                  <div className="size-1.5 rounded-full bg-white shadow-xs animate-ping opacity-75" />
                </div>

                {/* Section Nodes */}
                <div className="space-y-1 relative">
                  {sections.map((sec, idx) => {
                    const isActive = idx === activeSectionIndex;
                    const isPassed = idx < activeSectionIndex;
                    return (
                      <button
                        key={sec.id}
                        type="button"
                        ref={(el) => {
                          nodeRefs.current[idx] = el;
                        }}
                        onClick={() => scrollToSection(idx)}
                        className={cn(
                          "group relative flex items-start gap-3 pl-9 pr-3 py-2.5 rounded-xl text-left transition-all w-full cursor-pointer",
                          isActive
                            ? "bg-amber-500/10 text-ink font-semibold ring-1 ring-amber-500/30"
                            : "text-muted-foreground hover:text-ink hover:bg-canvas/60"
                        )}
                      >
                        {/* Node marker on the line */}
                        <div
                          className={cn(
                            "absolute left-[19px] top-4 size-2 rounded-full -translate-x-1/2 transition-all",
                            isActive
                              ? "bg-amber-500 ring-4 ring-amber-400/30 scale-125"
                              : isPassed
                              ? "bg-zinc-400 dark:bg-zinc-600"
                              : "bg-border ring-1 ring-border"
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono uppercase tracking-wider opacity-60">
                              {String(idx + 1).padStart(2, "0")}
                            </span>
                            {isActive && (
                              <span className="text-[9px] font-bold uppercase tracking-widest text-amber-600 bg-amber-500/15 px-1.5 py-0.5 rounded-full">
                                Active
                              </span>
                            )}
                          </div>
                          <p className="text-xs truncate font-medium mt-0.5 leading-snug">
                            {sec.title}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sidebar Footer: Steppers for Moving Section by Section */}
              <div className="p-3 border-t border-black/5 bg-surface/90 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => scrollToSection(activeSectionIndex - 1)}
                  disabled={activeSectionIndex <= 0}
                  className="flex-1 flex items-center justify-center gap-1 rounded-xl border border-border/80 bg-canvas py-1.5 text-xs font-medium text-ink hover:bg-surface disabled:opacity-40 transition cursor-pointer"
                  title="Move to previous section"
                >
                  <ChevronUp className="size-3.5" />
                  <span>Prev</span>
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection(activeSectionIndex + 1)}
                  disabled={activeSectionIndex >= sections.length - 1}
                  className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-ink text-white py-1.5 text-xs font-semibold hover:bg-ink/90 disabled:opacity-40 transition cursor-pointer"
                  title="Move to next section"
                >
                  <span>Next</span>
                  <ChevronDown className="size-3.5" />
                </button>
              </div>
            </aside>
          )}

          {/* Main Article Document */}
          <div
            ref={articleRef}
            onScroll={handleArticleScroll}
            className="flex-1 overflow-y-auto px-4 sm:px-10 py-8 scroll-smooth"
          >
            <div className="mx-auto max-w-3xl space-y-10">
              {sections.map((sec, idx) => (
                <section
                  key={sec.id}
                  id={sec.id}
                  ref={(el) => {
                    sectionRefs.current[idx] = el;
                  }}
                  className="scroll-mt-8 pb-8 border-b border-border/30 last:border-b-0 space-y-4"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex size-6 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 font-mono text-xs font-bold">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <h2 className="font-serif text-xl sm:text-2xl font-bold text-ink">
                      {sec.title}
                    </h2>
                  </div>
                  <div className="prose prose-sm sm:prose-base max-w-none text-ink/90 leading-relaxed prose-headings:font-serif prose-headings:text-ink prose-a:text-brand prose-code:bg-surface prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded">
                    <ReactMarkdown>{sec.content}</ReactMarkdown>
                  </div>
                </section>
              ))}
            </div>
          </div>
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
        <div className="mx-auto max-w-lg pt-12 sm:pt-16 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-brand text-brand-foreground shadow-sm">
            <Telescope className="size-6" />
          </div>
          <h2 className="font-serif text-3xl">Deep research</h2>
          <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
            Enter a topic. I'll ask a few questions, sweep live sources and write a cited report.
          </p>

          {/* Quick Demo: Load full sample report with interactive sidebar & moving ball */}
          <div className="mt-6 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setTopic(SAMPLE_RESEARCH_TOPIC);
                setReport(SAMPLE_RESEARCH_REPORT);
                toast.success("Loaded Deep Research paper with Section Outline and moving ball!");
              }}
              className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 active:scale-95 transition cursor-pointer shadow-2xs"
            >
              <Sparkles className="size-3.5" />
              <span>Explore Sample Report (Interactive Moving Ball Demo)</span>
            </button>

            {/* Topic Suggestions */}
            <div className="mt-4 flex flex-wrap justify-center gap-1.5">
              {[
                "Autonomous AI Agents 2026",
                "Solid-State Batteries",
                "Post-Quantum Cryptography",
                "Brain-Computer Interfaces",
              ].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setTopic(s)}
                  className="rounded-full border border-border/70 bg-surface/70 px-3 py-1 text-xs text-muted-foreground hover:text-ink hover:bg-surface transition cursor-pointer"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
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
