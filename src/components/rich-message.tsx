import { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import {
  Check,
  Copy,
  Share2,
  Download,
  ShoppingBag,
  ExternalLink,
  Smartphone,
  PhoneCall,
  MessageSquare,
  MapPin,
  Camera,
  Play,
  Volume2,
  Battery,
  Zap,
  Settings,
  Calculator,
  Mail,
  Music,
  Compass,
  FileText,
  Table as TableIcon,
  Pencil,
  Plus,
  Trash2,
  Eye,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  generatePdfDataUrl,
  triggerPdfDownload,
  extractSpreadsheetFromContent,
  triggerSpreadsheetDownload,
} from "@/lib/pdf-generator";

function parseKeyValue(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([a-zA-Z_]+)\s*:\s*(.+)\s*$/);
    if (m) out[m[1].toLowerCase()] = m[2].trim();
  }
  return out;
}

function OrderCard({ raw }: { raw: string }) {
  const [confirmed, setConfirmed] = useState(false);
  const [address, setAddress] = useState("");
  const o = parseKeyValue(raw);
  return (
    <div className="my-3 rounded-2xl border border-brand/30 bg-brand/5 p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-brand">
        <ShoppingBag className="size-3.5" /> Draft order
      </div>
      <p className="text-sm font-medium text-ink">{o.item ?? "Item"}</p>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {o.qty && (
          <>
            <dt>Qty</dt>
            <dd className="text-ink">{o.qty}</dd>
          </>
        )}
        {o.price && (
          <>
            <dt>Price</dt>
            <dd className="text-ink">{o.price}</dd>
          </>
        )}
        {o.retailer && (
          <>
            <dt>Retailer</dt>
            <dd className="text-ink">{o.retailer}</dd>
          </>
        )}
        {o.notes && (
          <>
            <dt>Notes</dt>
            <dd className="text-ink">{o.notes}</dd>
          </>
        )}
      </dl>
      <div className="mt-3">
        <div className="flex items-center justify-between pb-1 text-[11px] text-muted-foreground">
          <span>Shipping Address</span>
          <button
            type="button"
            onClick={() => {
              if ("geolocation" in navigator) {
                toast.info("Retrieving device location for address...");
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    const addr = `Current Location (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`;
                    setAddress(addr);
                    toast.success("Address auto-filled from current location!");
                  },
                  () => {
                    setAddress("1600 Amphitheatre Pkwy, Mountain View, CA 94043");
                    toast.info("Default shipping address auto-filled.");
                  }
                );
              } else {
                setAddress("1600 Amphitheatre Pkwy, Mountain View, CA 94043");
                toast.info("Default shipping address auto-filled.");
              }
            }}
            className="text-brand hover:underline font-medium"
          >
            Auto-fill address
          </button>
        </div>
        <textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Shipping address (street, city, zip code)"
          rows={2}
          className="w-full resize-none rounded-xl border border-border/60 bg-canvas px-3 py-2 text-xs outline-none focus:border-brand"
        />
      </div>
      <div className="mt-3 flex gap-2">
        {o.url && (
          <a
            href={o.url}
            target="_blank"
            rel="noreferrer"
            className="flex flex-1 items-center justify-center gap-1 rounded-full border border-border/60 py-2 text-xs font-medium text-ink hover:bg-surface"
          >
            <ExternalLink className="size-3" /> Open on retailer
          </a>
        )}
        <button
          disabled={!address.trim() || confirmed}
          onClick={() => {
            setConfirmed(true);
            toast.success(
              "Order confirmed — complete checkout on the retailer's site.",
            );
          }}
          className="flex-1 rounded-full bg-ink py-2 text-xs font-semibold text-white disabled:opacity-40"
        >
          {confirmed ? "Confirmed ✓" : "Confirm order"}
        </button>
      </div>
    </div>
  );
}

function getDeviceIcon(action: string, app?: string) {
  const a = (app || action || "").toLowerCase();
  if (a.includes("youtube") || a.includes("video")) return Play;
  if (a.includes("call") || a.includes("phone") || a.includes("dial")) return PhoneCall;
  if (a.includes("message") || a.includes("sms") || a.includes("chat") || a.includes("whatsapp") || a.includes("telegram")) return MessageSquare;
  if (a.includes("map") || a.includes("geo") || a.includes("navigate") || a.includes("location")) return MapPin;
  if (a.includes("camera") || a.includes("photo")) return Camera;
  if (a.includes("music") || a.includes("spotify")) return Music;
  if (a.includes("mail") || a.includes("gmail")) return Mail;
  if (a.includes("calc")) return Calculator;
  if (a.includes("battery")) return Battery;
  if (a.includes("vibrate")) return Smartphone;
  if (a.includes("torch") || a.includes("flashlight")) return Zap;
  if (a.includes("setting")) return Settings;
  return Smartphone;
}

export function DeviceActionCard({ raw }: { raw: string }) {
  const d = parseKeyValue(raw);
  const [executed, setExecuted] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState<string | null>(null);

  const action = d.action || "open_app";
  const appName = d.app || d.name || "Mobile App";
  const title = d.title || `Open ${appName} on Mobile`;
  const scheme = d.scheme || "";
  const webFallback = d.web_fallback || d.url || "";
  const intent = d.intent || "";
  const details = d.details || `Control command for your device`;

  const Icon = getDeviceIcon(action, appName);

  const executeAction = useCallback(() => {
    try {
      if (action === "vibrate") {
        if ("vibrate" in navigator) {
          navigator.vibrate([200, 100, 200, 100, 300]);
          toast.success("Device vibrated!");
        } else {
          toast.info("Vibration is supported on mobile devices.");
        }
        setExecuted(true);
        return;
      }

      if (action === "battery") {
        if ("getBattery" in navigator) {
          (navigator as any).getBattery().then((b: any) => {
            const pct = Math.round(b.level * 100);
            const status = b.charging ? "Charging" : "Discharging";
            setBatteryLevel(`${pct}% (${status})`);
            toast.success(`Battery: ${pct}% - ${status}`);
          });
        } else {
          toast.info("Battery API not supported on this browser.");
        }
        setExecuted(true);
        return;
      }

      if (action === "call" && d.number) {
        window.location.href = `tel:${d.number.replace(/\s+/g, "")}`;
        setExecuted(true);
        return;
      }

      if (action === "sms") {
        const num = d.number || "";
        const body = encodeURIComponent(d.body || "");
        window.location.href = `sms:${num}?body=${body}`;
        setExecuted(true);
        return;
      }

      if (action === "maps") {
        const query = encodeURIComponent(d.query || d.destination || appName);
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (isMobile) {
          window.location.href = `geo:0,0?q=${query}`;
          setTimeout(() => {
            window.open(`https://maps.google.com/?q=${query}`, "_blank");
          }, 800);
        } else {
          window.open(`https://maps.google.com/?q=${query}`, "_blank");
        }
        setExecuted(true);
        return;
      }

      // Open App logic (Mobile Deep Link + Intent + Web Fallback)
      const targetUrl = scheme || intent || webFallback;
      if (!targetUrl) {
        toast.info(`Triggered ${appName}`);
        setExecuted(true);
        return;
      }

      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      if (isMobile) {
        // Try native app scheme first
        if (scheme) {
          window.location.href = scheme;
        } else if (intent) {
          window.location.href = intent;
        } else if (webFallback) {
          window.open(webFallback, "_blank");
        }

        // Fallback to web after 1.2s if app wasn't installed
        if (webFallback && scheme) {
          setTimeout(() => {
            window.location.href = webFallback;
          }, 1200);
        }
      } else {
        // On desktop, open web app or universal link
        window.open(webFallback || scheme, "_blank");
      }

      toast.success(`Opening ${appName} on your device...`);
      setExecuted(true);
    } catch (e) {
      toast.error(`Could not launch ${appName}`);
    }
  }, [action, appName, scheme, intent, webFallback, d.number, d.body, d.query, d.destination]);

  const executedRef = useRef(false);

  // Auto trigger once on mount for seamless device interaction
  useEffect(() => {
    if (executedRef.current) return;
    const isMobile = typeof navigator !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile && (action === "open_app" || action === "vibrate")) {
      executedRef.current = true;
      const t = setTimeout(() => {
        executeAction();
      }, 400);
      return () => clearTimeout(t);
    }
  }, [action, executeAction]);

  return (
    <div className="my-3 rounded-2xl border border-brand/30 bg-gradient-to-br from-brand/10 via-canvas to-surface p-4 shadow-sm ring-1 ring-black/5">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-brand text-brand-foreground shadow-sm">
          <Icon className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand">
              Device Action
            </span>
            {batteryLevel && (
              <span className="text-[11px] font-mono text-muted-foreground">{batteryLevel}</span>
            )}
          </div>
          <h4 className="truncate text-sm font-semibold text-ink mt-0.5">{title}</h4>
          <p className="truncate text-xs text-muted-foreground">{details}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 pt-2 border-t border-black/5">
        <button
          onClick={executeAction}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition shadow-sm",
            executed
              ? "bg-surface text-ink border border-border"
              : "bg-brand text-brand-foreground hover:opacity-90"
          )}
        >
          <Icon className="size-4" />
          <span>{executed ? `Launched ${appName}` : `Open on Device`}</span>
        </button>

        {webFallback && (
          <a
            href={webFallback}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1 rounded-xl border border-border bg-surface px-3 py-2.5 text-xs font-medium text-ink hover:bg-surface/80 transition"
          >
            <ExternalLink className="size-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}

function extractYouTubeId(url: string): string | null {
  try {
    const cleanUrl = url.trim().replace(/[>)\s]+$/, "");
    const u = new URL(cleanUrl);
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("?")[0];
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      if (u.pathname.startsWith("/embed/")) return u.pathname.split("/")[2]?.split("?")[0] || null;
      if (u.pathname.startsWith("/shorts/")) return u.pathname.split("/")[2]?.split("?")[0] || null;
      if (u.pathname.startsWith("/v/")) return u.pathname.split("/")[2]?.split("?")[0] || null;
    }
  } catch {
    // Check regex fallback for raw IDs
    const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
    if (m) return m[1];
  }
  return null;
}

export function YouTubePlayerCard({ id, title }: { id: string; title?: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [thumbError, setThumbError] = useState(false);

  const thumbUrl = thumbError
    ? `https://img.youtube.com/vi/${id}/0.jpg`
    : `https://img.youtube.com/vi/${id}/hqdefault.jpg`;

  return (
    <div className="my-3.5 overflow-hidden rounded-2xl border border-black/10 bg-surface shadow-md dark:border-white/10 max-w-lg transition hover:shadow-lg">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 px-3.5 py-2.5 bg-surface/80 backdrop-blur-sm">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex size-6 items-center justify-center rounded-full bg-red-600 text-white shadow-sm shrink-0">
            <Play className="size-3 fill-white ml-0.5" />
          </span>
          <div className="min-w-0">
            <span className="block truncate text-xs font-semibold text-ink">
              {title || "YouTube Video Player"}
            </span>
            <span className="block text-[10px] text-muted-foreground uppercase tracking-wider">
              Integrated Player
            </span>
          </div>
        </div>
        <a
          href={`https://www.youtube.com/watch?v=${id}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition hover:text-ink hover:bg-canvas shrink-0"
        >
          <span>Open on YouTube</span>
          <ExternalLink className="size-3" />
        </a>
      </div>

      {/* Video player / preview */}
      <div className="relative aspect-video w-full bg-black">
        {isPlaying ? (
          <iframe
            className="h-full w-full border-none"
            src={`https://www.youtube.com/embed/${id}?autoplay=1&rel=0&enablejsapi=1`}
            title={title || "YouTube video player"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : (
          <div
            onClick={() => setIsPlaying(true)}
            className="group relative h-full w-full cursor-pointer overflow-hidden"
          >
            <img
              src={thumbUrl}
              alt={title || "YouTube video thumbnail"}
              onError={() => setThumbError(true)}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 opacity-90 group-hover:opacity-100"
            />
            {/* Play Button Overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px] transition group-hover:bg-black/20">
              <div className="flex size-14 items-center justify-center rounded-full bg-red-600 text-white shadow-xl transition-transform duration-200 group-hover:scale-110 ring-4 ring-white/30">
                <Play className="size-6 fill-white ml-0.5" />
              </div>
            </div>
            <div className="absolute bottom-2 left-2 rounded-md bg-black/75 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
              Click to Play directly in Chat
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CodeBlock({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const lang = className?.replace("language-", "") || "code";
  const text = String(children ?? "");

  if (lang === "youtube") {
    const d = parseKeyValue(text);
    const id = d.id || d.videoid || text.trim();
    if (id) {
      return <YouTubePlayerCard id={id} title={d.title} />;
    }
  }

  if (lang === "google_images" || lang === "gallery") {
    const lines = text.split("\n").filter((l) => l.trim().length > 0);
    const items: { url: string; title: string }[] = [];
    for (const l of lines) {
      if (l.includes("http")) {
        const parts = l.split("|");
        const url = (parts[0] || "").trim();
        const title = (parts[1] || "").trim();
        items.push({ url, title });
      }
    }
    if (items.length > 0) {
      return (
        <div className="my-3 grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg">
          {items.map((it, idx) => (
            <SafeMarkdownImage key={idx} src={it.url} alt={it.title} />
          ))}
        </div>
      );
    }
  }

  return (
    <div className="group relative my-2 overflow-hidden rounded-xl bg-ink">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
        <span className="text-[10px] uppercase tracking-widest text-white/50">
          {lang}
        </span>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            toast.success("Code copied");
            setTimeout(() => setCopied(false), 1500);
          }}
          className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] text-white/80 hover:bg-white/10"
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-xs leading-relaxed text-white">
        <code>{text}</code>
      </pre>
    </div>
  );
}

export function RichMessage({
  content,
  variant = "default",
}: {
  content: string;
  variant?: "default" | "dark";
}) {
  const isDark = variant === "dark";
  // 1. Detect markdown links to YouTube: [title](https://youtube.com/...)
  const mdYtRe =
    /\[([^\]]*)\]\((https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)[^\s)]+)\)/gi;

  const ytCards: { id: string; title?: string }[] = [];
  const seenIds = new Set<string>();

  let mdMatch;
  while ((mdMatch = mdYtRe.exec(content)) !== null) {
    const id = extractYouTubeId(mdMatch[2]);
    if (id && !seenIds.has(id)) {
      seenIds.add(id);
      ytCards.push({ id, title: mdMatch[1]?.trim() });
    }
  }

  // 2. Detect standalone YouTube URLs
  const rawYtRe =
    /(https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)[a-zA-Z0-9_-]{11}[^\s)]*)/gi;

  let rawMatch;
  while ((rawMatch = rawYtRe.exec(content)) !== null) {
    const id = extractYouTubeId(rawMatch[1]);
    if (id && !seenIds.has(id)) {
      seenIds.add(id);
      ytCards.push({ id });
    }
  }

  // Clean out standalone YouTube URLs from markdown to avoid clutter (only when YouTube URLs were found)
  let cleaned = ytCards.length > 0 ? content.replace(rawYtRe, "") : content;
  if (ytCards.length > 0) {
    cleaned = cleaned.replace(/\[\s*\]\(\s*\)/g, "");
  }

  return (
    <div className="w-full max-w-full space-y-3">
      <div
        className={cn(
          "prose prose-sm max-w-none text-sm leading-relaxed prose-p:my-2 prose-pre:my-0 prose-pre:bg-transparent prose-pre:p-0 prose-code:before:hidden prose-code:after:hidden prose-img:my-2 prose-img:rounded-xl",
          isDark
            ? "prose-invert text-white prose-p:text-white prose-headings:text-white prose-strong:text-white prose-li:text-white prose-td:text-white prose-th:text-white prose-blockquote:text-zinc-200"
            : "text-ink",
        )}
      >
        <ReactMarkdown
          components={{
            p({ children }: any) {
              return (
                <div className={cn("my-2", isDark ? "text-white" : "")}>
                  {children}
                </div>
              );
            },
            h1({ children }: any) {
              return (
                <h1 className={cn("font-bold my-2", isDark ? "text-white" : "")}>
                  {children}
                </h1>
              );
            },
            h2({ children }: any) {
              return (
                <h2 className={cn("font-bold my-2", isDark ? "text-white" : "")}>
                  {children}
                </h2>
              );
            },
            h3({ children }: any) {
              return (
                <h3 className={cn("font-semibold my-1.5", isDark ? "text-white" : "")}>
                  {children}
                </h3>
              );
            },
            li({ children }: any) {
              return (
                <li className={cn("my-0.5", isDark ? "text-white marker:text-white/80" : "")}>
                  {children}
                </li>
              );
            },
            strong({ children }: any) {
              return (
                <strong className={cn("font-semibold", isDark ? "text-white" : "")}>
                  {children}
                </strong>
              );
            },
            code({ inline, className, children }: any) {
              const text = String(children ?? "");
              const isBlock =
                inline === false ||
                Boolean(className && /language-/.test(className)) ||
                text.includes("\n");
              if (!isBlock) {
                return (
                  <code
                    className={cn(
                      "rounded px-1.5 py-0.5 font-mono text-[0.85em]",
                      isDark ? "bg-white/15 text-white" : "bg-ink/10",
                    )}
                  >
                    {children}
                  </code>
                );
              }
              const lang = (className || "").replace("language-", "");
              if (lang === "order") return <OrderCard raw={text} />;
              if (lang === "device_action" || lang === "device") {
                return <DeviceActionCard raw={text} />;
              }
              return <CodeBlock className={className}>{children}</CodeBlock>;
            },
            pre({ children }: any) {
              return <>{children}</>;
            },
            img({ src, alt }: any) {
              if (!src) return null;
              return <SafeMarkdownImage src={src} alt={alt || "Image"} />;
            },
            a({ href, children }: any) {
              // If it's a YouTube link, check if it already has a player card
              const ytId = href ? extractYouTubeId(href) : null;
              if (ytId) {
                return (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-red-500 hover:underline"
                  >
                    <Play className="size-3 fill-red-500" />
                    <span>{children || "Watch on YouTube"}</span>
                  </a>
                );
              }
              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className={cn("underline", isDark ? "text-blue-400" : "text-brand")}
                >
                  {children}
                </a>
              );
            },
          }}
        >
          {cleaned}
        </ReactMarkdown>
      </div>

      {/* Render interactive playable YouTube player cards */}
      {ytCards.map(({ id, title }) => (
        <YouTubePlayerCard key={id} id={id} title={title} />
      ))}

      {/* Interactive Document & Spreadsheet Action Bar + Live Editors */}
      <DocumentAndSpreadsheetStudio content={content} />
    </div>
  );
}

function DocumentAndSpreadsheetStudio({ content }: { content: string }) {
  const initialSheet = extractSpreadsheetFromContent(content);
  const [sheetTitle, setSheetTitle] = useState(initialSheet?.title || "Data_Spreadsheet");
  const [headers, setHeaders] = useState<string[]>(
    initialSheet?.headers || ["Item", "Category", "Value", "Status"],
  );
  const [rows, setRows] = useState<string[][]>(
    initialSheet?.rows && initialSheet.rows.length > 0
      ? initialSheet.rows
      : [
          ["Row 1", "General", "100", "Active"],
          ["Row 2", "Operations", "250", "Completed"],
        ],
  );
  const [sheetOpen, setSheetOpen] = useState(Boolean(initialSheet));

  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfTitle, setPdfTitle] = useState(() => {
    const m = content.match(/^#{1,3}\s+(.+)$/m);
    return m ? m[1].replace(/\*\*/g, "").trim().slice(0, 60) : "AI_Document_Report";
  });
  const [pdfBody, setPdfBody] = useState(content);

  useEffect(() => {
    setPdfBody(content);
    const extracted = extractSpreadsheetFromContent(content);
    if (extracted) {
      setSheetTitle(extracted.title);
      setHeaders(extracted.headers);
      setRows(extracted.rows);
      setSheetOpen(true);
    }
  }, [content]);

  function updateCell(rIdx: number, cIdx: number, val: string) {
    setRows((prev) =>
      prev.map((r, i) =>
        i === rIdx ? r.map((c, j) => (j === cIdx ? val : c)) : r,
      ),
    );
  }

  function updateHeader(cIdx: number, val: string) {
    setHeaders((prev) => prev.map((h, j) => (j === cIdx ? val : h)));
  }

  function addRow() {
    setRows((prev) => [...prev, headers.map(() => "")]);
  }

  function deleteRow(rIdx: number) {
    setRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== rIdx) : prev));
  }

  function addColumn() {
    const newColName = `Column ${headers.length + 1}`;
    setHeaders((prev) => [...prev, newColName]);
    setRows((prev) => prev.map((r) => [...r, ""]));
  }

  function deleteColumn(cIdx: number) {
    if (headers.length <= 1) return;
    setHeaders((prev) => prev.filter((_, j) => j !== cIdx));
    setRows((prev) => prev.map((r) => r.filter((_, j) => j !== cIdx)));
  }

  function handleDownloadPdf(customBody?: string) {
    try {
      const dataUrl = generatePdfDataUrl({
        title: pdfTitle || "Document",
        subtitle: `Generated & Edited in My AI Pro • ${new Date().toLocaleDateString()}`,
        content: customBody ?? pdfBody,
      });
      const cleanFile =
        (pdfTitle || "document")
          .toLowerCase()
          .replace(/[^a-z0-9-]+/g, "-")
          .replace(/^-|-$/g, "") || "document";
      triggerPdfDownload(dataUrl, `${cleanFile}.pdf`);
      toast.success(`Downloaded "${cleanFile}.pdf"`);
    } catch {
      toast.error("Failed to generate PDF");
    }
  }

  function handleConvertTextToSheet() {
    const extracted = extractSpreadsheetFromContent(pdfBody);
    if (extracted) {
      setSheetTitle(extracted.title);
      setHeaders(extracted.headers);
      setRows(extracted.rows);
    } else {
      const bulletLines = pdfBody
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.startsWith("#"))
        .slice(0, 25);
      setHeaders(["#", "Section / Item", "Details", "Notes"]);
      setRows(
        bulletLines.map((line, idx) => {
          const clean = line.replace(/^[-*+\d.)]+\s*/, "").replace(/\*\*/g, "");
          const parts = clean.split(/[:—–-]\s+/);
          return [
            String(idx + 1),
            parts[0] || clean.slice(0, 40),
            parts.slice(1).join(" - ") || clean,
            "Editable",
          ];
        }),
      );
    }
    setSheetOpen(true);
  }

  return (
    <div className="pt-1 space-y-3">
      {/* Quick Action Toolbar for PDF & Spreadsheet */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => handleDownloadPdf()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-surface/90 px-2.5 py-1.5 text-[11px] font-medium text-ink hover:bg-surface transition shadow-2xs"
        >
          <FileText className="size-3.5 text-red-500" />
          <span>Download PDF</span>
        </button>

        <button
          type="button"
          onClick={() => setPdfOpen((v) => !v)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-medium transition shadow-2xs",
            pdfOpen
              ? "border-ink bg-ink text-white"
              : "border-border/80 bg-surface/90 text-ink hover:bg-surface",
          )}
        >
          <Pencil className="size-3.5" />
          <span>{pdfOpen ? "Close PDF Editor" : "Edit & Export PDF"}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (!sheetOpen && !initialSheet) {
              handleConvertTextToSheet();
            } else {
              setSheetOpen((v) => !v);
            }
          }}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-medium transition shadow-2xs",
            sheetOpen
              ? "border-emerald-700 bg-emerald-600 text-white"
              : "border-border/80 bg-surface/90 text-ink hover:bg-surface",
          )}
        >
          <TableIcon className="size-3.5 text-emerald-500" />
          <span>{sheetOpen ? "Hide Spreadsheet" : "Open / Edit Spreadsheet"}</span>
        </button>

        {initialSheet && (
          <>
            <button
              type="button"
              onClick={() => {
                triggerSpreadsheetDownload(headers, rows, sheetTitle, "csv");
                toast.success(`Downloaded ${sheetTitle}.csv`);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition"
            >
              <Download className="size-3.5" />
              <span>CSV</span>
            </button>
            <button
              type="button"
              onClick={() => {
                triggerSpreadsheetDownload(headers, rows, sheetTitle, "xls");
                toast.success(`Downloaded ${sheetTitle}.xls (Excel)`);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition"
            >
              <Download className="size-3.5" />
              <span>Excel (.xls)</span>
            </button>
          </>
        )}
      </div>

      {/* Interactive PDF Editor Card */}
      {pdfOpen && (
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-md space-y-3">
          <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2.5">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-red-500" />
              <span className="text-xs font-semibold text-ink">Interactive PDF Studio (Edit &amp; Export)</span>
            </div>
            <button
              type="button"
              onClick={() => setPdfOpen(false)}
              className="rounded-lg p-1 text-muted-foreground hover:text-ink"
            >
              <X className="size-3.5" />
            </button>
          </div>

          <div className="space-y-2">
            <label className="block text-[11px] font-medium text-muted-foreground">
              PDF Document Title
            </label>
            <input
              type="text"
              value={pdfTitle}
              onChange={(e) => setPdfTitle(e.target.value)}
              className="w-full rounded-xl border border-border bg-canvas px-3 py-1.5 text-xs font-semibold text-ink outline-none focus:ring-1 focus:ring-brand"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-[11px] font-medium text-muted-foreground">
              Document Content (Edit headings, paragraphs, bullet points, or tables before exporting)
            </label>
            <textarea
              value={pdfBody}
              onChange={(e) => setPdfBody(e.target.value)}
              rows={8}
              className="w-full rounded-xl border border-border bg-canvas p-3 text-xs font-mono leading-relaxed text-ink outline-none focus:ring-1 focus:ring-brand"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <span className="text-[11px] text-muted-foreground">
              Changes are immediately compiled into a multi-page formatted PDF.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleDownloadPdf(pdfBody)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-3.5 py-2 text-xs font-semibold text-white hover:opacity-90 transition"
              >
                <Download className="size-3.5" />
                <span>Download Edited PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Editable Spreadsheet Studio */}
      {sheetOpen && (
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-md space-y-3 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <TableIcon className="size-4 text-emerald-600 shrink-0" />
              <input
                type="text"
                value={sheetTitle}
                onChange={(e) => setSheetTitle(e.target.value)}
                className="bg-transparent text-xs font-bold text-ink outline-none border-b border-transparent focus:border-emerald-500 truncate"
                title="Click to rename spreadsheet"
              />
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                {rows.length} rows × {headers.length} cols
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={addRow}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-canvas px-2 py-1 text-[11px] font-medium text-ink hover:bg-surface"
              >
                <Plus className="size-3" /> Row
              </button>
              <button
                type="button"
                onClick={addColumn}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-canvas px-2 py-1 text-[11px] font-medium text-ink hover:bg-surface"
              >
                <Plus className="size-3" /> Column
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerSpreadsheetDownload(headers, rows, sheetTitle, "csv");
                  toast.success(`Exported ${sheetTitle}.csv`);
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-500 transition"
              >
                <Download className="size-3" /> CSV
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerSpreadsheetDownload(headers, rows, sheetTitle, "xls");
                  toast.success(`Exported ${sheetTitle}.xls (Excel)`);
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-zinc-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-zinc-800 transition"
              >
                <Download className="size-3" /> Excel (.xls)
              </button>
              <button
                type="button"
                onClick={() => {
                  const mdTable = [
                    `# ${sheetTitle}`,
                    "",
                    `| ${headers.join(" | ")} |`,
                    `| ${headers.map(() => "---").join(" | ")} |`,
                    ...rows.map((r) => `| ${headers.map((_, i) => r[i] ?? "").join(" | ")} |`),
                  ].join("\n");
                  handleDownloadPdf(mdTable);
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-canvas px-2.5 py-1 text-[11px] font-semibold text-ink hover:bg-surface transition"
              >
                <FileText className="size-3 text-red-500" /> PDF
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-auto rounded-xl border border-border">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-zinc-900 text-white">
                  <th className="w-8 border-r border-white/15 px-2 py-2 text-center text-[10px] font-mono text-white/60">
                    #
                  </th>
                  {headers.map((h, cIdx) => (
                    <th key={cIdx} className="border-r border-white/15 px-2.5 py-2 min-w-[120px]">
                      <div className="flex items-center justify-between gap-1">
                        <input
                          type="text"
                          value={h}
                          onChange={(e) => updateHeader(cIdx, e.target.value)}
                          className="w-full bg-transparent font-semibold text-white outline-none focus:underline"
                        />
                        {headers.length > 1 && (
                          <button
                            type="button"
                            onClick={() => deleteColumn(cIdx)}
                            className="text-white/40 hover:text-red-300 p-0.5"
                            title="Delete column"
                          >
                            <X className="size-3" />
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="w-8 px-2 py-2 text-center text-[10px] text-white/60">Del</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-canvas">
                {rows.map((r, rIdx) => (
                  <tr key={rIdx} className="hover:bg-surface/60">
                    <td className="border-r border-border px-2 py-1.5 text-center font-mono text-[10px] text-muted-foreground">
                      {rIdx + 1}
                    </td>
                    {headers.map((_, cIdx) => (
                      <td key={cIdx} className="border-r border-border px-2 py-1">
                        <input
                          type="text"
                          value={r[cIdx] ?? ""}
                          onChange={(e) => updateCell(rIdx, cIdx, e.target.value)}
                          className="w-full bg-transparent text-xs text-ink outline-none focus:bg-surface px-1 py-0.5 rounded"
                        />
                      </td>
                    ))}
                    <td className="px-2 py-1 text-center">
                      <button
                        type="button"
                        onClick={() => deleteRow(rIdx)}
                        className="text-muted-foreground hover:text-red-500 p-0.5"
                        title="Delete row"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Click any cell or column header to edit values in real time, then export as CSV, Excel (.xls), or PDF.
          </p>
        </div>
      )}
    </div>
  );
}

export function SafeMarkdownImage({ src, alt }: { src: string; alt?: string }) {
  const [imgSrc, setImgSrc] = useState(src);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  function handleError() {
    if (!failed) {
      const cleanKeyword = encodeURIComponent((alt || "image").slice(0, 40));
      setImgSrc(`https://image.pollinations.ai/prompt/${cleanKeyword}?width=800&height=500&nologo=true`);
      setFailed(true);
    }
  }

  function handleDownload(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      const a = document.createElement("a");
      a.href = imgSrc;
      a.download = `google-image-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("Image download started");
    } catch {
      window.open(imgSrc, "_blank");
    }
  }

  const cleanCaption = (alt || "").replace(/^image\s*\d*$/i, "").trim();

  return (
    <>
      <figure
        onClick={() => setFullscreen(true)}
        className="group relative my-3 block max-w-lg cursor-pointer overflow-hidden rounded-2xl border border-border/70 bg-surface/50 shadow-sm transition hover:shadow-md"
      >
        <div className="relative overflow-hidden bg-black/5">
          <img
            src={imgSrc}
            alt={alt || "Google Web Image"}
            referrerPolicy="no-referrer"
            loading="lazy"
            onLoad={() => setLoaded(true)}
            onError={handleError}
            className={cn(
              "w-full max-h-[380px] rounded-2xl object-cover transition-all duration-300 group-hover:scale-[1.015]",
              loaded ? "opacity-100" : "opacity-60"
            )}
          />

          {/* Top Google Image badge with Google colors */}
          <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm backdrop-blur-md">
            <span className="flex items-center gap-0.5">
              <span className="text-[#4285F4]">G</span>
              <span className="text-[#EA4335]">o</span>
              <span className="text-[#FBBC05]">o</span>
              <span className="text-[#4285F4]">g</span>
              <span className="text-[#34A853]">l</span>
              <span className="text-[#EA4335]">e</span>
            </span>
            <span className="text-white/80 font-normal">Image</span>
          </div>

          {/* Quick actions on hover */}
          <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              onClick={handleDownload}
              className="flex size-7 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur-md transition hover:bg-black"
              title="Download Image"
            >
              <Download className="size-3.5" />
            </button>
            <a
              href={imgSrc}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex size-7 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur-md transition hover:bg-black"
              title="Open Full Image"
            >
              <ExternalLink className="size-3.5" />
            </a>
          </div>
        </div>

        {cleanCaption && (
          <figcaption className="px-3.5 py-2 text-xs text-muted-foreground truncate border-t border-border/40 bg-surface/30">
            {cleanCaption}
          </figcaption>
        )}
      </figure>

      {/* Lightbox Modal */}
      {fullscreen && (
        <div
          onClick={() => setFullscreen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[90vh] max-w-4xl overflow-hidden rounded-2xl bg-black border border-white/10 shadow-2xl"
          >
            <img
              src={imgSrc}
              alt={cleanCaption || "Google Image"}
              className="max-h-[80vh] w-auto object-contain"
            />
            <div className="flex items-center justify-between border-t border-white/10 bg-neutral-900/90 px-4 py-3">
              <span className="truncate text-xs text-neutral-300 font-medium max-w-md">
                {cleanCaption || "Google Web Image"}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20"
                >
                  <Download className="size-3.5" /> Download
                </button>
                <button
                  onClick={() => setFullscreen(false)}
                  className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-white/90"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function AssistantImage({ url }: { url: string }) {
  return (
    <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-black/5 shadow-md">
      <img
        src={url}
        alt="Visual"
        className="w-full rounded-2xl object-cover"
      />
    </div>
  );
}
