import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Search,
  Copy,
  FileCode2,
  FileJson,
  FileText,
  Braces,
  Eye,
  X,
  Download,
  Github,
  Archive,
  Check,
  Loader2,
  ExternalLink,
  Folder,
  FolderOpen,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import JSZip from "jszip";

export type CodeFile = { path: string; language: string; content: string };

type Node = { name: string; path: string; file?: CodeFile; children: Node[] };

function buildTree(files: CodeFile[]): Node[] {
  const root: Node = { name: "", path: "", children: [] };
  for (const f of files) {
    const parts = f.path.split("/").filter(Boolean);
    let cur = root;
    parts.forEach((part, i) => {
      const isLeaf = i === parts.length - 1;
      let next = cur.children.find((c) => c.name === part && !!c.file === isLeaf);
      if (!next) {
        next = { name: part, path: parts.slice(0, i + 1).join("/"), children: [], ...(isLeaf ? { file: f } : {}) };
        cur.children.push(next);
      }
      cur = next;
    });
  }
  const sort = (n: Node[]) => {
    n.sort((a, b) => (!!a.file === !!b.file ? a.name.localeCompare(b.name) : a.file ? 1 : -1));
    n.forEach((c) => sort(c.children));
  };
  sort(root.children);
  return root.children;
}

function iconFor(name: string) {
  if (name.endsWith(".json")) return FileJson;
  if (name.endsWith(".md") || name.endsWith(".txt")) return FileText;
  if (name.endsWith(".css") || name.endsWith(".html")) return Braces;
  return FileCode2;
}

/* ---------------- syntax highlighting ---------------- */

const KEYWORDS =
  "abstract|as|async|await|break|case|catch|class|const|continue|def|default|delete|do|elif|else|enum|except|export|extends|finally|for|from|function|if|implements|import|in|instanceof|interface|is|lambda|let|new|none|not|null|or|and|pass|print|private|public|raise|return|self|static|super|switch|this|throw|true|false|try|type|typeof|undefined|var|void|while|with|yield|struct|func|package|use|fn|impl|match|pub|mut";

const RULES: { cls: string; re: RegExp }[] = [
  { cls: "text-emerald-300", re: new RegExp(`("""[\\s\\S]*?"""|'''[\\s\\S]*?'''|"(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*'|\`(?:\\\\.|[^\`\\\\])*\`)`, "g") },
  { cls: "text-white/40 italic", re: /(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/)/g },
  { cls: "text-sky-300", re: new RegExp(`\\b(${KEYWORDS})\\b`, "g") },
  { cls: "text-amber-300", re: /\b(\d+(?:\.\d+)?)\b/g },
  { cls: "text-violet-300", re: /\b([A-Z][A-Za-z0-9_]+)\b/g },
  { cls: "text-yellow-200", re: /\b([a-zA-Z_][\w]*)(?=\()/g },
];

type Tok = { text: string; cls?: string };

function tokenize(code: string): Tok[] {
  let toks: Tok[] = [{ text: code }];
  for (const rule of RULES) {
    const next: Tok[] = [];
    for (const t of toks) {
      if (t.cls) {
        next.push(t);
        continue;
      }
      let last = 0;
      const re = new RegExp(rule.re.source, rule.re.flags);
      let m: RegExpExecArray | null;
      while ((m = re.exec(t.text))) {
        if (m.index > last) next.push({ text: t.text.slice(last, m.index) });
        next.push({ text: m[0], cls: rule.cls });
        last = m.index + m[0].length;
        if (m[0].length === 0) re.lastIndex++;
      }
      if (last < t.text.length) next.push({ text: t.text.slice(last) });
    }
    toks = next;
  }
  return toks;
}

function Highlighted({ code }: { code: string }) {
  const lines = useMemo(() => code.split("\n"), [code]);
  return (
    <pre className="min-w-full font-mono text-[12px] leading-relaxed text-white/85">
      {lines.map((line, i) => (
        <div key={i} className="flex">
          <span className="w-10 shrink-0 select-none pr-3 text-right text-white/25">{i + 1}</span>
          <code className="whitespace-pre">
            {tokenize(line).map((t, j) => (
              <span key={j} className={t.cls}>
                {t.text}
              </span>
            ))}
          </code>
        </div>
      ))}
    </pre>
  );
}

/* ---------------- tree rows ---------------- */

function Row({
  node,
  depth,
  open,
  toggle,
  active,
  onPick,
}: {
  node: Node;
  depth: number;
  open: Record<string, boolean>;
  toggle: (p: string) => void;
  active?: string;
  onPick: (f: CodeFile) => void;
}) {
  const isOpen = open[node.path] ?? true;
  if (node.file) {
    const Icon = iconFor(node.name);
    return (
      <button
        onClick={() => onPick(node.file!)}
        style={{ paddingLeft: 12 + depth * 18 }}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg py-2.5 pr-3 text-left text-[15px]",
          active === node.path ? "bg-surface font-medium text-ink" : "text-ink/80 hover:bg-surface/70",
        )}
      >
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{node.name}</span>
      </button>
    );
  }
  return (
    <div>
      <button
        onClick={() => toggle(node.path)}
        style={{ paddingLeft: 12 + depth * 18 }}
        className="flex w-full items-center gap-2 rounded-lg py-2.5 pr-3 text-left text-[15px] font-medium text-ink hover:bg-surface/70"
      >
        {isOpen ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
        {isOpen ? (
          <FolderOpen className="size-4 shrink-0 text-amber-500" />
        ) : (
          <Folder className="size-4 shrink-0 text-amber-500/80" />
        )}
        <span className="truncate">{node.name}</span>
        <span className="ml-auto text-[11px] font-normal text-muted-foreground">
          {node.children.length}
        </span>
      </button>
      {isOpen &&
        node.children.map((c) => (
          <Row key={c.path} node={c} depth={depth + 1} open={open} toggle={toggle} active={active} onPick={onPick} />
        ))}
    </div>
  );
}

/* ---------------- content search ---------------- */

type Hit = { file: CodeFile; line: number; text: string };

function searchFiles(files: CodeFile[], q: string): Hit[] {
  const needle = q.toLowerCase();
  const hits: Hit[] = [];
  for (const f of files) {
    f.content.split("\n").forEach((line, i) => {
      if (line.toLowerCase().includes(needle)) hits.push({ file: f, line: i + 1, text: line.trim().slice(0, 160) });
    });
    if (hits.length > 200) return hits;
  }
  return hits;
}

export function CodeExplorer({
  files,
  appName = "my-app",
  onUpdateFiles,
}: {
  files: CodeFile[];
  appName?: string;
  onUpdateFiles?: (updated: CodeFile[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<CodeFile | null>(null);
  const [preview, setPreview] = useState<CodeFile | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [githubOpen, setGithubOpen] = useState(false);
  const [repoName, setRepoName] = useState(appName.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "my-app");
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderPath, setNewFolderPath] = useState("");

  const { folderCount, totalLines } = useMemo(() => {
    const folders = new Set<string>();
    let lines = 0;
    for (const f of files) {
      lines += (f.content || "").split("\n").length;
      const parts = f.path.split("/").filter(Boolean);
      for (let i = 0; i < parts.length - 1; i++) {
        folders.add(parts.slice(0, i + 1).join("/"));
      }
    }
    return { folderCount: folders.size, totalLines: lines };
  }, [files]);

  function handleAddFolderOrFile() {
    const cleaned = newFolderPath.trim().replace(/^\/+/, "");
    if (!cleaned) return;
    const finalPath = cleaned.endsWith("/")
      ? `${cleaned}index.tsx`
      : cleaned.includes(".")
        ? cleaned
        : `${cleaned}/index.tsx`;
    const ext = finalPath.split(".").pop()?.toLowerCase() || "tsx";
    const langMap: Record<string, string> = {
      tsx: "typescript",
      ts: "typescript",
      jsx: "javascript",
      js: "javascript",
      css: "css",
      html: "html",
      json: "json",
      py: "python",
      md: "markdown",
    };
    const createdFile: CodeFile = {
      path: finalPath,
      language: langMap[ext] || "typescript",
      content: `// ${finalPath}\n// Module created in ${appName}\n\nexport default function Module() {\n  return null;\n}\n`,
    };
    const next = files.some((f) => f.path === finalPath)
      ? files.map((f) => (f.path === finalPath ? createdFile : f))
      : [...files, createdFile];
    onUpdateFiles?.(next);
    setNewFolderPath("");
    setShowNewFolderInput(false);
    toast.success(`Created ${finalPath}`);
  }

  const q = query.trim();
  const nameMatches = useMemo(
    () => (q ? files.filter((f) => f.path.toLowerCase().includes(q.toLowerCase())) : files),
    [files, q],
  );
  const contentHits = useMemo(() => (q.length >= 2 ? searchFiles(files, q) : []), [files, q]);
  const tree = useMemo(() => buildTree(nameMatches), [nameMatches]);

  function copy(f: CodeFile) {
    navigator.clipboard.writeText(f.content);
    toast.success(`Copied ${f.path}`);
  }

  async function handleDownloadZip() {
    try {
      setDownloadingZip(true);
      const zip = new JSZip();

      files.forEach((f) => {
        const cleanPath = f.path.startsWith("/") ? f.path.slice(1) : f.path;
        zip.file(cleanPath, f.content);
      });

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${repoName || "project"}-codebase.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Codebase downloaded as ZIP file!");
      setExportOpen(false);
    } catch {
      toast.error("Failed to generate ZIP");
    } finally {
      setDownloadingZip(false);
    }
  }

  if (selected) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center gap-2 border-b border-black/5 px-3 py-2">
          <button onClick={() => setSelected(null)} className="text-sm text-muted-foreground hover:text-ink">
            ‹ Files
          </button>
          <span className="flex-1 truncate font-mono text-xs text-ink">{selected.path}</span>
          <button
            onClick={() => copy(selected)}
            className="flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-[11px] text-muted-foreground"
          >
            <Copy className="size-3" /> Copy
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-[#0f1115]">
          <div className="px-4 py-2 text-[11px] uppercase tracking-widest text-white/40">{selected.language}</div>
          <div className="px-4 pb-10">
            <Highlighted code={selected.content} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col relative">
      {/* Search and Export Code Action Bar */}
      <div className="shrink-0 px-4 py-3 flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-2xl bg-surface px-4 py-2.5 ring-1 ring-black/10">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search files and code"
            className="w-full bg-transparent text-[14px] outline-none placeholder:text-muted-foreground"
          />
          {q && (
            <button onClick={() => setQuery("")} className="text-muted-foreground">
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Export Code Button */}
        {onUpdateFiles && (
          <button
            type="button"
            onClick={() => setShowNewFolderInput((v) => !v)}
            className="flex items-center gap-1 rounded-2xl bg-surface hover:bg-surface/80 px-3 py-2.5 text-xs font-semibold text-ink ring-1 ring-black/10 shadow-sm transition"
            title="Create new folder or file"
          >
            <Plus className="size-3.5" />
            <span>Folder / File</span>
          </button>
        )}
        <button
          onClick={() => setExportOpen(true)}
          className="flex items-center gap-1.5 rounded-2xl bg-surface hover:bg-surface/80 px-3.5 py-2.5 text-xs font-semibold text-ink ring-1 ring-black/10 shadow-sm transition"
        >
          <Download className="size-3.5 text-brand" />
          <span>Export code</span>
        </button>
      </div>

      {/* Multi-Folder & Code Stats Strip */}
      <div className="shrink-0 px-4 pb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-lg bg-surface px-2.5 py-1 font-medium text-ink ring-1 ring-black/5">
            <Folder className="size-3.5 text-amber-500" />
            {folderCount} {folderCount === 1 ? "folder" : "folders"}
          </span>
          <span className="inline-flex items-center gap-1 rounded-lg bg-surface px-2.5 py-1 font-medium text-ink ring-1 ring-black/5">
            <FileCode2 className="size-3.5 text-brand" />
            {files.length} {files.length === 1 ? "file" : "files"}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {totalLines.toLocaleString()} lines written
          </span>
        </div>
      </div>

      {showNewFolderInput && (
        <div className="shrink-0 mx-4 mb-2 flex items-center gap-2 rounded-2xl bg-surface p-2 ring-1 ring-black/10">
          <Folder className="size-4 text-amber-500 ml-2 shrink-0" />
          <input
            value={newFolderPath}
            onChange={(e) => setNewFolderPath(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddFolderOrFile();
              }
            }}
            placeholder="e.g. src/features/billing/InvoiceView.tsx or server/controllers/"
            className="flex-1 bg-transparent text-xs font-mono text-ink outline-none"
          />
          <button
            type="button"
            onClick={handleAddFolderOrFile}
            className="rounded-xl bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800"
          >
            Create
          </button>
        </div>
      )}

      {contentHits.length > 0 && (
        <p className="px-5 pb-2 text-[11px] text-muted-foreground">
          {contentHits.length} match{contentHits.length === 1 ? "" : "es"} inside code
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto pb-8">
        {contentHits.slice(0, 40).map((h, i) => (
          <button
            key={`${h.file.path}-${h.line}-${i}`}
            onClick={() => setPreview(h.file)}
            className="block w-full border-b border-black/5 px-4 py-2.5 text-left hover:bg-surface/70"
          >
            <p className="truncate font-mono text-[11px] text-brand">
              {h.file.path}:{h.line}
            </p>
            <p className="truncate font-mono text-[12px] text-ink/80">{h.text}</p>
          </button>
        ))}

        {tree.map((n) => (
          <Row
            key={n.path}
            node={n}
            depth={0}
            open={open}
            toggle={(p) => setOpen((o) => ({ ...o, [p]: !(o[p] ?? true) }))}
            active={undefined}
            onPick={setPreview}
          />
        ))}
        {tree.length === 0 && contentHits.length === 0 && (
          <p className="px-5 py-6 text-sm text-muted-foreground">No files or code match “{query}”.</p>
        )}
      </div>

      {/* Export Code Options Modal */}
      {exportOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setExportOpen(false)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 mx-auto max-w-md rounded-3xl bg-canvas p-6 shadow-2xl ring-1 ring-black/10">
            <div className="flex items-center justify-between pb-4 border-b border-black/5">
              <div className="flex items-center gap-2">
                <Download className="size-5 text-brand" />
                <h3 className="font-serif text-lg font-bold text-ink">Export Code</h3>
              </div>
              <button onClick={() => setExportOpen(false)} className="rounded p-1 text-muted-foreground hover:text-ink">
                <X className="size-4" />
              </button>
            </div>

            <p className="py-3 text-xs text-muted-foreground leading-relaxed">
              Export your full generated codebase ({files.length} files) to GitHub or download as a standalone ZIP archive.
            </p>

            <div className="space-y-3 pt-2">
              {/* Option 1: GitHub */}
              <button
                onClick={() => {
                  setExportOpen(false);
                  setGithubOpen(true);
                }}
                className="flex w-full items-center gap-3.5 rounded-2xl border border-border/80 bg-surface p-4 text-left transition hover:border-brand hover:shadow-sm"
              >
                <div className="flex size-10 items-center justify-center rounded-xl bg-zinc-900 text-white">
                  <Github className="size-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-ink">Push to GitHub</p>
                  <p className="text-[11px] text-muted-foreground">Export as a new repository or sync changes</p>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </button>

              {/* Option 2: Download ZIP */}
              <button
                onClick={handleDownloadZip}
                disabled={downloadingZip}
                className="flex w-full items-center gap-3.5 rounded-2xl border border-border/80 bg-surface p-4 text-left transition hover:border-brand hover:shadow-sm"
              >
                <div className="flex size-10 items-center justify-center rounded-xl bg-brand text-brand-foreground">
                  {downloadingZip ? <Loader2 className="size-5 animate-spin" /> : <Archive className="size-5" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-ink">Download in a ZIP file</p>
                  <p className="text-[11px] text-muted-foreground">Complete project archive ready to run locally (npm install & dev)</p>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* GitHub Export Modal */}
      {githubOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setGithubOpen(false)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 mx-auto max-w-md rounded-3xl bg-canvas p-6 shadow-2xl ring-1 ring-black/10">
            <div className="flex items-center justify-between pb-3 border-b border-black/5">
              <div className="flex items-center gap-2">
                <Github className="size-5" />
                <h3 className="font-serif text-lg font-bold text-ink">GitHub Repository Export</h3>
              </div>
              <button onClick={() => setGithubOpen(false)} className="rounded p-1 text-muted-foreground hover:text-ink">
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-4 pt-3">
              <div>
                <label className="text-xs font-medium text-ink block mb-1">Repository Name</label>
                <input
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs font-mono text-ink outline-none focus:ring-1 focus:ring-brand"
                />
              </div>

              <div className="rounded-2xl bg-surface p-3 text-xs border border-border/60">
                <p className="font-semibold text-ink mb-1">Quick Clone & Push</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Download the ZIP and run:
                </p>
                <div className="mt-2 rounded-lg bg-[#0f1115] p-2.5 font-mono text-[10px] text-white/90">
                  <code>
                    git init<br />
                    git add .<br />
                    git commit -m "Initial commit from My AI"<br />
                    git branch -M main<br />
                    git remote add origin https://github.com/your-username/{repoName}.git<br />
                    git push -u origin main
                  </code>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => {
                    handleDownloadZip();
                    setGithubOpen(false);
                  }}
                  className="flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-xs font-bold text-brand-foreground shadow hover:opacity-90"
                >
                  <Download className="size-3.5" /> Download & Setup Git
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Preview panel — look before you copy */}
      {preview && (
        <>
          <div className="fixed inset-0 z-40 bg-ink/30" onClick={() => setPreview(null)} />
          <div className="fixed inset-x-0 bottom-0 z-50 flex max-h-[75vh] flex-col overflow-hidden rounded-t-3xl bg-[#0f1115] ring-1 ring-white/10">
            <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-4 py-3">
              <Eye className="size-4 text-white/50" />
              <span className="flex-1 truncate font-mono text-xs text-white/80">{preview.path}</span>
              <button
                onClick={() => copy(preview)}
                className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-white/80"
              >
                <Copy className="size-3" /> Copy
              </button>
              <button onClick={() => setPreview(null)} className="p-1 text-white/60">
                <X className="size-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
              <Highlighted code={preview.content} />
            </div>
            <button
              onClick={() => {
                setSelected(preview);
                setPreview(null);
              }}
              className="shrink-0 border-t border-white/10 py-3 text-center text-xs text-white/70"
            >
              Open full file
            </button>
          </div>
        </>
      )}
    </div>
  );
}
