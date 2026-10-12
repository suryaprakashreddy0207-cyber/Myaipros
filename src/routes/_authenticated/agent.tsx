import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import {
  Bot,
  Sparkles,
  Play,
  Send,
  Mic,
  MicOff,
  Paperclip,
  Copy,
  Check,
  ExternalLink,
  MapPin,
  Code2,
  Terminal,
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
  Layers,
  Globe,
  MessageSquare,
  Mail,
  Smartphone,
  Zap,
  ChevronRight,
  Download,
  Loader2,
  Monitor,
  Folder,
  FolderUp,
  Image as ImageIcon,
  Tag,
  Filter,
  X,
  Radio,
  ArrowUpRight,
  RefreshCw,
  Search,
  Code,
  Eye,
  Phone,
  Volume2,
  Share2,
  Laptop,
  MousePointer,
  Cpu,
  Activity,
  Maximize2,
  Pause,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { TopTabs } from "@/components/top-tabs";
import { SafeMarkdownImage } from "@/components/rich-message";
import { executeCoworkTask, type CoworkResponse, type CoworkAction } from "@/lib/cowork.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/agent")({
  head: () => ({
    meta: [
      { title: "My AI Cowork — Autonomous Device & Code Coworker" },
      { name: "description", content: "Your autonomous coworker running on your mobile or laptop. Multi-tasks at a time, writes code, moves its own cursor, and opens apps on user device." },
      { property: "og:title", content: "My AI Cowork — My AI 1.1" },
      { property: "og:description", content: "Autonomous device coworker for apps, code, multitasking, and laptop control." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AgentCoworkPage,
});

type TaskItem = {
  id: string;
  role: "user" | "coworker";
  content: string;
  timestamp: string;
  labels: string[];
  category: string;
  status: "pending" | "in_progress" | "completed";
  screenCapture?: string;
  folderSummary?: string;
  attachments?: string[];
  coworkData?: CoworkResponse;
};

const DEFAULT_CATEGORIES = [
  "All",
  "App Launch",
  "Coding",
  "Device Control",
  "Research",
  "Multi-Task",
  "Workflow",
  "General",
];

const KNOWN_DEVICE_APPS = [
  { id: "youtube", name: "YouTube", icon: "▶️", mobileScheme: "https://youtube.com", laptopUrl: "https://youtube.com", color: "bg-red-500" },
  { id: "whatsapp", name: "WhatsApp", icon: "💬", mobileScheme: "https://web.whatsapp.com", laptopUrl: "https://web.whatsapp.com", color: "bg-emerald-500" },
  { id: "spotify", name: "Spotify", icon: "🎵", mobileScheme: "https://open.spotify.com", laptopUrl: "https://open.spotify.com", color: "bg-green-500" },
  { id: "vscode", name: "VS Code", icon: "💻", mobileScheme: "https://vscode.dev", laptopUrl: "https://vscode.dev", color: "bg-blue-600" },
  { id: "terminal", name: "Terminal", icon: "⌨️", mobileScheme: "https://vscode.dev", laptopUrl: "https://vscode.dev", color: "bg-zinc-800" },
  { id: "maps", name: "Google Maps", icon: "📍", mobileScheme: "https://maps.google.com", laptopUrl: "https://maps.google.com", color: "bg-blue-500" },
  { id: "camera", name: "Camera", icon: "📷", mobileScheme: "https://webcamera.io", laptopUrl: "https://webcamera.io", color: "bg-indigo-500" },
  { id: "calculator", name: "Calculator", icon: "🔢", mobileScheme: "https://www.google.com/search?q=calculator", laptopUrl: "https://www.google.com/search?q=calculator", color: "bg-amber-500" },
  { id: "chrome", name: "Browser", icon: "🌐", mobileScheme: "https://google.com", laptopUrl: "https://google.com", color: "bg-blue-500" },
  { id: "github", name: "GitHub", icon: "🐙", mobileScheme: "https://github.com", laptopUrl: "https://github.com", color: "bg-zinc-900" },
  { id: "slack", name: "Slack", icon: "💼", mobileScheme: "https://slack.com", laptopUrl: "https://slack.com", color: "bg-purple-600" },
  { id: "settings", name: "Settings", icon: "⚙️", mobileScheme: "https://myaccount.google.com", laptopUrl: "https://myaccount.google.com", color: "bg-slate-600" },
];

export function AgentCoworkPage() {
  const coworkFn = useServerFn(executeCoworkTask);

  const [workName, setWorkName] = useState("My AI Cowork");
  const [isEditingWorkName, setIsEditingWorkName] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<"myai" | "opus" | "gpt" | "kimi">("myai");
  const [listening, setListening] = useState(false);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [copiedCodeIndex, setCopiedCodeIndex] = useState<string | null>(null);

  // Device target & View Modes
  const [deviceTarget, setDeviceTarget] = useState<"laptop" | "mobile">("laptop");
  const [viewMode, setViewMode] = useState<"tasks" | "laptop_screen">("tasks");

  // Autonomous Cursor Simulation State on Laptop
  const [cursorPos, setCursorPos] = useState({ x: 30, y: 70 });
  const [cursorTarget, setCursorTarget] = useState<string>("Ready");
  const [cursorClicking, setCursorClicking] = useState(false);
  const [cursorActive, setCursorActive] = useState(true);
  const [laptopCodeText, setLaptopCodeText] = useState(
    `# Autonomous AI Coworker Code Writer
def scrape_and_analyze(url):
    print(f"Connecting to user device...")
    response = requests.get(url)
    return {"status": "success", "multitask": True}
`
  );
  const [laptopTerminalLogs, setLaptopTerminalLogs] = useState<string[]>([
    "myai@laptop:~$ cowork --multitask active",
    "✔ Device Target: User Laptop (Active Connected)",
    "✔ Autonomous Cursor Controller initialized",
    "✔ Listening for instructions to open apps & write code...",
  ]);

  // Multitasking Engine Parallel Status
  const [activeThreads, setActiveThreads] = useState<
    { id: string; name: string; status: "running" | "completed"; progress: number; icon: string }[]
  >([
    { id: "app-thread", name: "Device App Controller", status: "completed", progress: 100, icon: "📱" },
    { id: "code-thread", name: "Autonomous Code Generator", status: "completed", progress: 100, icon: "💻" },
    { id: "web-thread", name: "Live Internet Grounding", status: "completed", progress: 100, icon: "🌐" },
    { id: "device-thread", name: "Hardware Action Controller", status: "completed", progress: 100, icon: "⚡" },
  ]);

  // Live code runner preview modal state
  const [previewCode, setPreviewCode] = useState<{ code: string; language: string; title: string } | null>(null);

  // User-defined task categories and filtering
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("All");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<"all" | "in_progress" | "completed">("all");
  const [customLabelInput, setCustomLabelInput] = useState("");
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);

  // Attached context for current prompt
  const [screenCaptureUrl, setScreenCaptureUrl] = useState<string | null>(null);
  const [folderContext, setFolderContext] = useState<string | null>(null);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; type: string }[]>([]);
  const [attachedImages, setAttachedImages] = useState<string[]>([]);

  // Conversation & Tasks Stream
  const [tasks, setTasks] = useState<TaskItem[]>([
    {
      id: "initial-task",
      role: "coworker",
      content: "Hello! I am your autonomous AI Coworker, powered by My AI 1.1. I run directly on your device (Laptop or Mobile), open your applications (YouTube, WhatsApp, Spotify, Settings, Camera, VS Code, and more), execute multi-task instructions simultaneously in parallel threads, and write production-grade code. On laptops, you can watch my autonomous cursor move and type code live on screen!",
      timestamp: "Just now",
      labels: ["Coworker", "Autonomous Device Controller"],
      category: "General",
      status: "completed",
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [tasks]);

  // Autonomous Cursor Animation Loop
  useEffect(() => {
    if (!cursorActive) return;

    const interval = setInterval(() => {
      // Pick random destination on virtual laptop
      const destinations = [
        { x: 25, y: 35, target: "VS Code Editor (Writing Code)" },
        { x: 75, y: 40, target: "Terminal (Executing Commands)" },
        { x: 45, y: 88, target: "App Dock (Launching Spotify)" },
        { x: 30, y: 88, target: "App Dock (Opening YouTube)" },
        { x: 55, y: 88, target: "App Dock (WhatsApp Native)" },
        { x: 28, y: 55, target: "Code Editor (Debugging Line 18)" },
      ];

      const dest = destinations[Math.floor(Math.random() * destinations.length)];
      setCursorPos({ x: dest.x, y: dest.y });
      setCursorTarget(dest.target);

      // Trigger click ripple
      setTimeout(() => {
        setCursorClicking(true);
        setTimeout(() => setCursorClicking(false), 300);
      }, 700);
    }, 2800);

    return () => clearInterval(interval);
  }, [cursorActive]);

  const coworkMutation = useMutation({
    mutationFn: async (text: string) => {
      // Set active threads for simultaneous multitasking
      setActiveThreads([
        { id: "app-thread", name: "Opening Apps on Device", status: "running", progress: 45, icon: "🚀" },
        { id: "code-thread", name: "Writing Production Code", status: "running", progress: 60, icon: "💻" },
        { id: "web-thread", name: "Gathering Live Intelligence", status: "running", progress: 80, icon: "🌐" },
        { id: "device-thread", name: "Running Laptop/Mobile Execution", status: "running", progress: 30, icon: "⚡" },
      ]);

      return coworkFn({
        data: {
          prompt: text,
          model,
          labels: selectedLabels,
          category: selectedCategoryFilter !== "All" ? selectedCategoryFilter : undefined,
          hasScreenCapture: Boolean(screenCaptureUrl),
          folderContext: folderContext || undefined,
          fileCount: attachedFiles.length,
          context: `Device target: ${deviceTarget}. Work name: ${workName}`,
        },
      });
    },
    onSuccess: (res) => {
      const coworkerMsg: TaskItem = {
        id: `cowork-${Date.now()}`,
        role: "coworker",
        content: res.summary,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        labels: selectedLabels.length > 0 ? [...selectedLabels] : [res.suggestedCategory || "General"],
        category: res.suggestedCategory || (selectedCategoryFilter !== "All" ? selectedCategoryFilter : "General"),
        status: "completed",
        coworkData: res,
      };

      if (res.suggestedCategory && !categories.includes(res.suggestedCategory)) {
        setCategories((prev) => [...prev, res.suggestedCategory!]);
      }

      setTasks((prev) => [...prev, coworkerMsg]);

      // Complete multitasking threads
      setActiveThreads([
        { id: "app-thread", name: "Device App Controller", status: "completed", progress: 100, icon: "📱" },
        { id: "code-thread", name: "Autonomous Code Generator", status: "completed", progress: 100, icon: "💻" },
        { id: "web-thread", name: "Live Internet Grounding", status: "completed", progress: 100, icon: "🌐" },
        { id: "device-thread", name: "Hardware Action Controller", status: "completed", progress: 100, icon: "⚡" },
      ]);

      // Update laptop terminal logs with real output
      setLaptopTerminalLogs((prev) => [
        ...prev.slice(-8),
        `[${new Date().toLocaleTimeString()}] Executing multi-task: "${prompt.slice(0, 30)}..."`,
        `✔ Generated ${res.actions.length} action(s)`,
        ...res.actions.map((a) => `✔ [${a.type}]: ${a.title}`),
      ]);

      // If code was generated, update laptop code editor
      const codeAct = res.actions.find((a) => a.codeSnippet);
      if (codeAct?.codeSnippet) {
        setLaptopCodeText(codeAct.codeSnippet.code);
        setCursorTarget(`Typing ${codeAct.codeSnippet.filename}`);
      }

      // Auto-trigger device actions
      res.actions.forEach((act) => {
        if (act.type === "device_action" && act.deviceCommand === "vibrate") {
          if ("vibrate" in navigator) {
            navigator.vibrate([200, 100, 200]);
            toast.success("Device vibrated!");
          }
        } else if (act.type === "app_launcher" && act.appUrl) {
          // Attempt on-device app launch
          handleActionClick(act, false);
        }
      });

      setScreenCaptureUrl(null);
      setFolderContext(null);
      setFolderName(null);
      setAttachedFiles([]);
      setAttachedImages([]);
      setSelectedLabels([]);
    },
    onError: () => {
      const errorMsg: TaskItem = {
        id: `err-${Date.now()}`,
        role: "coworker",
        content: "I encountered an issue processing that instruction. I am ready for your next command.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        labels: ["Error"],
        category: "General",
        status: "completed",
      };
      setTasks((prev) => [...prev, errorMsg]);
    },
  });

  // Voice recording & live speech-to-text
  function toggleVoiceRecording() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error("Speech recognition is not supported in this browser.");
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";
      const basePrompt = prompt;

      rec.onresult = (event: any) => {
        let fullTranscript = "";
        for (let i = 0; i < event.results.length; i++) {
          fullTranscript += event.results[i][0]?.transcript || "";
        }
        const spoken = fullTranscript.trim();
        if (spoken) {
          setPrompt(basePrompt ? `${basePrompt} ${spoken}` : spoken);
        }
      };

      rec.onerror = () => {
        setListening(false);
        toast.info("Voice input stopped.");
      };

      rec.onend = () => {
        setListening(false);
      };

      recognitionRef.current = rec;
      rec.start();
      setListening(true);
      toast.info("Recording voice... Speak your instructions clearly.");
    } catch {
      setListening(false);
      toast.error("Could not access microphone.");
    }
  }

  // Screen Sharing Capture
  async function handleShareScreen() {
    setShowPlusMenu(false);
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        toast.error("Screen capture is not supported in this browser.");
        return;
      }

      toast.info("Select screen or window to share with My AI Cowork...");
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" } as any,
      });

      const video = document.createElement("video");
      video.srcObject = stream;
      video.play();

      video.onloadedmetadata = () => {
        setTimeout(() => {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth || 1280;
          canvas.height = video.videoHeight || 720;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
            setScreenCaptureUrl(dataUrl);
            toast.success("Screen captured! Ready to analyze with My AI Cowork.");
          }
          stream.getTracks().forEach((track) => track.stop());
        }, 500);
      };
    } catch {
      toast.info("Screen sharing cancelled or permission denied.");
    }
  }

  // Folder Upload
  function handleFolderSelect(e: React.ChangeEvent<HTMLInputElement>) {
    setShowPlusMenu(false);
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    const folderRoot = fileList[0]?.webkitRelativePath.split("/")[0] || "project-folder";
    setFolderName(folderRoot);

    const paths = fileList.map((f) => f.webkitRelativePath || f.name).slice(0, 50);
    const summary = `Folder: ${folderRoot}\nFiles (${fileList.length}):\n${paths.join("\n")}`;
    setFolderContext(summary);
    toast.success(`Uploaded folder: ${folderRoot} (${fileList.length} files)`);
  }

  // Image attachments
  function handleImagesSelect(e: React.ChangeEvent<HTMLInputElement>) {
    setShowPlusMenu(false);
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const readers = Array.from(files).slice(0, 6).map((file) => {
      return new Promise<string>((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.readAsDataURL(file);
      });
    });

    Promise.all(readers).then((urls) => {
      setAttachedImages((prev) => [...prev, ...urls]);
      toast.success(`Attached ${urls.length} image(s)!`);
    });
  }

  // Files Upload
  function handleFilesSelect(e: React.ChangeEvent<HTMLInputElement>) {
    setShowPlusMenu(false);
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles = Array.from(files).map((f) => ({
      name: f.name,
      type: f.type || "file",
    }));

    setAttachedFiles((prev) => [...prev, ...newFiles]);
    toast.success(`Attached ${files.length} file(s).`);
  }

  function handleAddCustomLabel() {
    const label = customLabelInput.trim().replace(/^#/, "");
    if (!label) return;
    if (!selectedLabels.includes(label)) {
      setSelectedLabels((prev) => [...prev, label]);
    }
    if (!categories.includes(label)) {
      setCategories((prev) => [...prev, label]);
    }
    setCustomLabelInput("");
    setShowPlusMenu(false);
    toast.success(`Added label: #${label}`);
  }

  function handleSend() {
    const text = prompt.trim();
    if (!text && !screenCaptureUrl && !folderContext && attachedFiles.length === 0 && attachedImages.length === 0) {
      toast.error("Please provide an instruction, voice command, or attachment.");
      return;
    }

    const userMsg: TaskItem = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      labels: selectedLabels,
      category: selectedCategoryFilter !== "All" ? selectedCategoryFilter : "General",
      status: "completed",
      screenCapture: screenCaptureUrl || undefined,
      folderSummary: folderName ? `Folder: ${folderName}` : undefined,
      attachments: [
        ...attachedFiles.map((f) => f.name),
        ...attachedImages.map((_, i) => `Image attachment ${i + 1}`),
      ],
    };

    setTasks((prev) => [...prev, userMsg]);
    setPrompt("");
    coworkMutation.mutate(text);
  }

  const filteredTasks = tasks.filter((t) => {
    const matchesCategory =
      selectedCategoryFilter === "All" ||
      t.category.toLowerCase() === selectedCategoryFilter.toLowerCase() ||
      t.labels.some((l) => l.toLowerCase() === selectedCategoryFilter.toLowerCase());

    const matchesStatus =
      selectedStatusFilter === "all" ||
      (selectedStatusFilter === "in_progress" && t.status === "in_progress") ||
      (selectedStatusFilter === "completed" && t.status === "completed");

    return matchesCategory && matchesStatus;
  });

  function copyCode(code: string, id: string) {
    navigator.clipboard.writeText(code);
    setCopiedCodeIndex(id);
    toast.success("Code copied to clipboard!");
    setTimeout(() => setCopiedCodeIndex(null), 2000);
  }

  // State for active launched app banner & opened device folder
  const [activeLaunchedApp, setActiveLaunchedApp] = useState<{ name: string; url: string } | null>(null);
  const [deviceFolderDetails, setDeviceFolderDetails] = useState<{
    name: string;
    files: { name: string; kind: string }[];
    path: string;
  } | null>(null);
  const [appLauncherModalOpen, setAppLauncherModalOpen] = useState(false);

  // Bulletproof function to launch ANY application on user device (laptop or mobile)
  function openAppOnDevice(act: { app?: string; title?: string; appUrl?: string; appScheme?: string; mapUrl?: string; deviceCommand?: string; commandParam?: string }, showToast = true) {
    const appName = act.app || act.title || "App";

    // 1. Resolve primary and secondary URL/scheme
    let targetUrl = act.appUrl || "";
    const scheme = act.appScheme || "";

    // If mobile target and scheme exists, prefer native scheme
    if (deviceTarget === "mobile" && scheme) {
      targetUrl = scheme;
    } else if (!targetUrl && scheme) {
      targetUrl = scheme;
    } else if (!targetUrl && act.mapUrl) {
      targetUrl = act.mapUrl;
    }

    // Fallback to verified URLs if empty
    if (!targetUrl) {
      const lower = appName.toLowerCase();
      if (lower.includes("youtube")) targetUrl = "https://youtube.com";
      else if (lower.includes("whatsapp")) targetUrl = "https://web.whatsapp.com";
      else if (lower.includes("spotify")) targetUrl = "https://open.spotify.com";
      else if (lower.includes("vscode") || lower.includes("vs code") || lower.includes("code")) targetUrl = "https://vscode.dev";
      else if (lower.includes("terminal")) targetUrl = "https://google.com/search?q=web+terminal";
      else if (lower.includes("map")) targetUrl = "https://maps.google.com";
      else if (lower.includes("calc")) targetUrl = "https://www.google.com/search?q=calculator";
      else if (lower.includes("camera")) targetUrl = "https://webcamera.io";
      else if (lower.includes("slack")) targetUrl = "https://slack.com";
      else if (lower.includes("github")) targetUrl = "https://github.com";
      else if (lower.includes("settings")) targetUrl = "https://myaccount.google.com";
      else targetUrl = `https://www.google.com/search?q=${encodeURIComponent(appName)}`;
    }

    // 2. Hardware vibration
    if (act.deviceCommand === "vibrate") {
      if ("vibrate" in navigator) {
        navigator.vibrate([200, 100, 200]);
        if (showToast) toast.success("Device vibrated!");
      } else {
        if (showToast) toast.info("Vibrate triggered on device.");
      }
      return;
    }

    if (showToast) {
      toast.success(`Opening ${appName} on your ${deviceTarget === "laptop" ? "Laptop" : "Mobile device"}…`);
    }

    // 3. Reliable window opening via anchor tag (bypasses iframe sandbox pop-up restrictions)
    try {
      const a = document.createElement("a");
      a.href = targetUrl;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      window.open(targetUrl, "_blank", "noopener,noreferrer");
    }

    // 4. Update laptop terminal logs
    setLaptopTerminalLogs((prev) => [
      ...prev.slice(-6),
      `✔ [${new Date().toLocaleTimeString()}] Opened app on ${deviceTarget}: "${appName}"`,
      `✔ URI: ${targetUrl}`,
    ]);

    // 5. Set banner so user has guaranteed instant 1-click launch button in case popup was blocked
    setActiveLaunchedApp({ name: appName, url: targetUrl });
  }

  // Handle action click from Coworker response cards
  function handleActionClick(act: CoworkAction, showToast = true) {
    if (act.deviceCommand === "vibrate") {
      if ("vibrate" in navigator) {
        navigator.vibrate([200, 100, 200]);
        if (showToast) toast.success("Device vibrated!");
      }
      return;
    }

    openAppOnDevice(act, showToast);
  }

  // 1-Click Launch from Quick Apps Dock
  function launchQuickApp(app: typeof KNOWN_DEVICE_APPS[0]) {
    const targetUrl = deviceTarget === "mobile" && app.mobileScheme ? app.mobileScheme : app.laptopUrl;
    openAppOnDevice({ app: app.name, appUrl: targetUrl, appScheme: app.mobileScheme }, true);
  }

  // Open & Inspect Folders directly on User Device using File System Access API
  async function handleOpenDeviceFolder() {
    setShowPlusMenu(false);
    try {
      if ("showDirectoryPicker" in window) {
        toast.info("Select any folder on your device to open with My AI Cowork...");
        const dirHandle = await (window as any).showDirectoryPicker();
        const files: { name: string; kind: string }[] = [];
        for await (const [name, handle] of (dirHandle as any).entries()) {
          files.push({ name, kind: handle.kind });
          if (files.length >= 60) break;
        }
        const fName = dirHandle.name || "device-folder";
        setFolderName(fName);
        const summary = `Folder: ${fName}\nFiles (${files.length}):\n${files.map((f) => `${f.kind === "directory" ? "📁" : "📄"} ${f.name}`).join("\n")}`;
        setFolderContext(summary);
        setDeviceFolderDetails({ name: fName, files, path: `~/${fName}` });
        toast.success(`Opened device folder: ${fName} (${files.length} items)!`);

        setLaptopTerminalLogs((prev) => [
          ...prev.slice(-6),
          `✔ Opened device folder: "${fName}"`,
          `✔ Loaded ${files.length} files into autonomous coworker memory`,
        ]);
      } else {
        folderInputRef.current?.click();
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        folderInputRef.current?.click();
      }
    }
  }

  return (
    <div className="flex h-screen flex-col bg-canvas text-ink">
      <TopTabs />

      {/* Header: Work Name, Device Target & Mode Switchers */}
      <header className="flex shrink-0 items-center justify-between border-b border-black/5 bg-surface/50 px-4 py-2">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-lg bg-brand text-brand-foreground shadow-xs">
            <Bot className="size-4" />
          </div>

          {isEditingWorkName ? (
            <input
              type="text"
              value={workName}
              autoFocus
              onChange={(e) => setWorkName(e.target.value)}
              onBlur={() => setIsEditingWorkName(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setIsEditingWorkName(false);
              }}
              className="rounded border border-brand bg-canvas px-1.5 py-0.5 text-sm font-semibold text-ink outline-none"
            />
          ) : (
            <button
              onClick={() => setIsEditingWorkName(true)}
              className="group flex items-center gap-1.5 text-sm font-semibold tracking-tight text-ink hover:text-brand"
              title="Click to rename work"
            >
              <span>{workName}</span>
              <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100">
                (edit)
              </span>
            </button>
          )}

          {/* Device Target Selector (Laptop vs Mobile) */}
          <div className="flex items-center rounded-full bg-canvas p-0.5 border border-border/60 text-xs">
            <button
              onClick={() => setDeviceTarget("laptop")}
              className={cn(
                "flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition",
                deviceTarget === "laptop" ? "bg-ink text-white shadow-xs" : "text-muted-foreground hover:text-ink"
              )}
            >
              <Laptop className="size-3" /> <span>Laptop</span>
            </button>
            <button
              onClick={() => setDeviceTarget("mobile")}
              className={cn(
                "flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition",
                deviceTarget === "mobile" ? "bg-ink text-white shadow-xs" : "text-muted-foreground hover:text-ink"
              )}
            >
              <Smartphone className="size-3" /> <span>Mobile</span>
            </button>
          </div>
        </div>

        {/* View Mode Toggle: Tasks Stream vs Autonomous Laptop Screen */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-full bg-surface p-1 border border-border/80 text-xs">
            <button
              onClick={() => setViewMode("tasks")}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition",
                viewMode === "tasks" ? "bg-brand text-brand-foreground shadow-xs" : "text-muted-foreground hover:text-ink"
              )}
            >
              <Activity className="size-3.5" /> <span>Tasks & Chat</span>
            </button>
            <button
              onClick={() => setViewMode("laptop_screen")}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition",
                viewMode === "laptop_screen" ? "bg-brand text-brand-foreground shadow-xs" : "text-muted-foreground hover:text-ink"
              )}
            >
              <Monitor className="size-3.5" /> <span>Autonomous Laptop Screen (AI Cursor)</span>
            </button>
          </div>
        </div>
      </header>

      {/* Concurrent Multitasking Status Strip */}
      <div className="flex items-center justify-between border-b border-border/40 bg-zinc-900 text-zinc-300 px-4 py-1.5 text-[11px] font-mono overflow-x-auto">
        <div className="flex items-center gap-3 shrink-0">
          <span className="flex items-center gap-1 text-emerald-400 font-bold">
            <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
            MULTITASK ENGINE: ACTIVE
          </span>
          <span className="text-zinc-500">|</span>
          <div className="flex items-center gap-2">
            {activeThreads.map((th) => (
              <span key={th.id} className="flex items-center gap-1 text-[10px] bg-zinc-800 px-2 py-0.5 rounded">
                <span>{th.icon}</span>
                <span>{th.name}:</span>
                <span className={cn("font-bold", th.status === "running" ? "text-amber-400 animate-pulse" : "text-emerald-400")}>
                  {th.status === "running" ? `${th.progress}%` : "Ready ✓"}
                </span>
              </span>
            ))}
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-zinc-400 text-[10px] shrink-0">
          <span>Target: <strong className="text-white capitalize">{deviceTarget}</strong></span>
          <span>•</span>
          <span>Autonomous Cursor: <strong className="text-emerald-400">Running</strong></span>
        </div>
      </div>

      {/* Main Body: Switchable between Tasks Stream and Autonomous Laptop Mockup */}
      {viewMode === "laptop_screen" ? (
        <div className="flex-1 overflow-hidden bg-zinc-950 p-4 flex flex-col items-center justify-center">
          {/* Virtual Laptop Frame */}
          <div className="relative w-full max-w-4xl h-[78vh] rounded-[24px] bg-zinc-900 border-4 border-zinc-700 shadow-2xl flex flex-col overflow-hidden">
            {/* Laptop Camera Notch & Bezel */}
            <div className="h-6 shrink-0 bg-zinc-900 flex items-center justify-center relative border-b border-white/5">
              <div className="size-2 rounded-full bg-zinc-800 ring-1 ring-white/10" />
            </div>

            {/* Laptop Display (Desktop Screen) */}
            <div className="relative flex-1 bg-gradient-to-br from-indigo-950 via-slate-900 to-zinc-950 overflow-hidden flex flex-col">
              {/* Virtual Desktop Top Bar (macOS / Linux style) */}
              <div className="h-6 bg-black/60 backdrop-blur-md px-3 flex items-center justify-between text-[11px] text-white/80 border-b border-white/10 select-none">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-white"> My AI Cowork OS 1.1</span>
                  <span>File</span>
                  <span>Edit</span>
                  <span>Code</span>
                  <span>Terminal</span>
                  <span className="text-emerald-400 font-semibold">● Connected to User Device ({deviceTarget})</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] bg-brand/30 text-brand-foreground px-2 py-0.2 rounded-full">
                    AI Multitasking: 4 Threads
                  </span>
                  <span>Wi-Fi 6</span>
                  <span>100% 🔋</span>
                  <span>{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              </div>

              {/* Virtual Desktop Windows (Code Editor + Terminal) */}
              <div className="flex-1 p-3 grid grid-cols-1 md:grid-cols-2 gap-3 overflow-hidden">
                {/* Window 1: Live Code Editor (VS Code Style) */}
                <div className="rounded-xl border border-white/10 bg-zinc-950 flex flex-col overflow-hidden shadow-lg">
                  <div className="h-7 bg-zinc-900 px-3 flex items-center justify-between text-[11px] border-b border-white/10">
                    <div className="flex items-center gap-1.5">
                      <div className="size-2.5 rounded-full bg-red-500/80" />
                      <div className="size-2.5 rounded-full bg-yellow-500/80" />
                      <div className="size-2.5 rounded-full bg-green-500/80" />
                      <span className="ml-2 font-mono text-zinc-300 font-semibold flex items-center gap-1">
                        <Code2 className="size-3 text-blue-400" /> main.py — Code Editor
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-400 font-mono">Python 3.12</span>
                  </div>

                  <div className="flex-1 p-3 font-mono text-xs overflow-auto text-emerald-400 bg-zinc-950/90 leading-relaxed">
                    <pre className="whitespace-pre-wrap">{laptopCodeText}</pre>
                    <span className="inline-block size-2 bg-emerald-400 animate-ping ml-1" />
                  </div>
                </div>

                {/* Window 2: Virtual Terminal & App Executions */}
                <div className="rounded-xl border border-white/10 bg-zinc-950 flex flex-col overflow-hidden shadow-lg">
                  <div className="h-7 bg-zinc-900 px-3 flex items-center justify-between text-[11px] border-b border-white/10">
                    <div className="flex items-center gap-1.5">
                      <div className="size-2.5 rounded-full bg-red-500/80" />
                      <div className="size-2.5 rounded-full bg-yellow-500/80" />
                      <div className="size-2.5 rounded-full bg-green-500/80" />
                      <span className="ml-2 font-mono text-zinc-300 font-semibold flex items-center gap-1">
                        <Terminal className="size-3 text-emerald-400" /> zsh — Autonomous Shell
                      </span>
                    </div>
                    <span className="text-[10px] text-emerald-400">Live Running</span>
                  </div>

                  <div className="flex-1 p-3 font-mono text-xs overflow-auto text-zinc-300 bg-black/90 space-y-1">
                    {laptopTerminalLogs.map((log, lIdx) => (
                      <div key={lIdx} className="leading-snug">
                        {log.startsWith("✔") ? (
                          <span className="text-emerald-400">{log}</span>
                        ) : log.startsWith("myai@") ? (
                          <span className="text-brand font-bold">{log}</span>
                        ) : (
                          <span className="text-zinc-300">{log}</span>
                        )}
                      </div>
                    ))}
                    <div className="flex items-center gap-1 text-emerald-400">
                      <span>myai@laptop:~$</span>
                      <span className="size-2 bg-emerald-400 animate-pulse" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom App Dock on Virtual Laptop */}
              <div className="h-14 flex items-center justify-center pb-2">
                <div className="flex items-center gap-2 rounded-2xl bg-white/10 backdrop-blur-xl px-4 py-2 border border-white/20 shadow-2xl">
                  {KNOWN_DEVICE_APPS.map((app) => (
                    <button
                      key={app.id}
                      onClick={() => launchQuickApp(app)}
                      className="group relative flex size-9 items-center justify-center rounded-xl bg-white/10 hover:bg-white/30 hover:scale-115 transition text-base shadow-xs"
                      title={`Launch ${app.name} on ${deviceTarget}`}
                    >
                      <span>{app.icon}</span>
                      <span className="absolute -top-7 rounded-md bg-black/90 px-1.5 py-0.5 text-[9px] font-semibold text-white opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                        {app.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ANIMATED AUTONOMOUS AI CURSOR (Moving, Hovering & Clicking on Laptop Screen) */}
              <div
                className="pointer-events-none absolute z-50 transition-all duration-700 ease-out"
                style={{ left: `${cursorPos.x}%`, top: `${cursorPos.y}%` }}
              >
                <div className="relative">
                  {/* Glowing Cursor Arrow SVG */}
                  <svg
                    viewBox="0 0 24 24"
                    className="size-7 text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]"
                    fill="currentColor"
                  >
                    <path d="M4 2v18l5.5-4.5 4 8 3.5-1.5-4-8H20L4 2z" />
                  </svg>

                  {/* Ripple Click Effect */}
                  {cursorClicking && (
                    <span className="absolute -inset-2 rounded-full border-2 border-cyan-400 animate-ping" />
                  )}

                  {/* AI Autonomous Badge */}
                  <div className="absolute left-6 -top-2 rounded-full bg-cyan-500/90 text-zinc-950 font-bold px-2 py-0.5 text-[9px] shadow-lg whitespace-nowrap flex items-center gap-1 border border-cyan-300">
                    <Sparkles className="size-2.5" />
                    <span>AI Cursor: {cursorTarget}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Cursor & Laptop Controls */}
          <div className="mt-3 flex items-center justify-between w-full max-w-4xl text-xs text-zinc-400">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCursorActive((v) => !v)}
                className="flex items-center gap-1.5 rounded-full bg-zinc-800 px-3 py-1.5 text-zinc-200 hover:bg-zinc-700"
              >
                {cursorActive ? <Pause className="size-3 text-amber-400" /> : <Play className="size-3 text-emerald-400" />}
                <span>{cursorActive ? "Pause Autonomous Cursor" : "Resume Autonomous Cursor"}</span>
              </button>
              <button
                onClick={() => {
                  toast.success("Triggering simultaneous multi-tasking test on device...");
                  coworkMutation.mutate("Open YouTube and Spotify, and write a web scraper in Python");
                }}
                className="flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 font-bold text-brand-foreground hover:opacity-90"
              >
                <Zap className="size-3" />
                <span>Run Multitask Demo (Code + Apps)</span>
              </button>
            </div>

            <span>Watching Autonomous AI Cursor execute tasks on user device.</span>
          </div>
        </div>
      ) : (
        /* Tasks & Chat View */
        <main className="flex flex-1 flex-col overflow-y-auto px-4 py-4 md:px-8">
          <div className="mx-auto w-full max-w-3xl flex-1 space-y-4">
            {/* Active Launched App Banner if recently opened */}
            {activeLaunchedApp && (
              <div className="flex items-center justify-between rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 p-3 shadow-xs text-xs text-emerald-900 dark:text-emerald-200">
                <div className="flex items-center gap-2">
                  <span className="flex size-2 rounded-full bg-emerald-500 animate-ping" />
                  <span>
                    Successfully opened <strong>{activeLaunchedApp.name}</strong> on your {deviceTarget}!
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={activeLaunchedApp.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 rounded-xl bg-emerald-600 text-white font-bold px-3 py-1 text-xs hover:bg-emerald-700 transition shadow-2xs"
                  >
                    <ExternalLink className="size-3" /> Direct Open
                  </a>
                  <button
                    onClick={() => setActiveLaunchedApp(null)}
                    className="rounded-full p-1 text-muted-foreground hover:text-ink"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Active Opened Device Folder Card */}
            {deviceFolderDetails && (
              <div className="flex items-center justify-between rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/60 p-3 shadow-xs text-xs text-blue-900 dark:text-blue-200">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-8 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
                    <Folder className="size-4" />
                  </div>
                  <div>
                    <div className="font-bold">Device Folder: {deviceFolderDetails.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {deviceFolderDetails.files.length} files loaded into Coworker context
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      openAppOnDevice({
                        app: "VS Code",
                        appUrl: "https://vscode.dev",
                        appScheme: `vscode://file/${deviceFolderDetails.name}`,
                      })
                    }
                    className="flex items-center gap-1 rounded-xl bg-blue-600 text-white font-semibold px-3 py-1 text-xs hover:bg-blue-700 transition shadow-2xs"
                  >
                    <Laptop className="size-3" /> Open in VS Code
                  </button>
                  <button
                    onClick={() => {
                      setDeviceFolderDetails(null);
                      setFolderName(null);
                      setFolderContext(null);
                    }}
                    className="rounded-full p-1 text-muted-foreground hover:text-ink"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Quick App Launcher Bar on Device */}
            <div className="rounded-2xl border border-border/80 bg-surface/60 p-3 shadow-2xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Smartphone className="size-3.5 text-brand" /> Launch Apps on your {deviceTarget === "laptop" ? "Laptop" : "Mobile"}:
                </span>
                <button
                  type="button"
                  onClick={() => setAppLauncherModalOpen(true)}
                  className="text-[10px] text-brand hover:underline font-semibold"
                >
                  View All Apps
                </button>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
                {KNOWN_DEVICE_APPS.map((app) => (
                  <button
                    key={app.id}
                    onClick={() => launchQuickApp(app)}
                    className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border/80 bg-canvas px-3 py-1.5 text-xs font-semibold text-ink hover:border-brand hover:shadow-xs transition"
                  >
                    <span>{app.icon}</span>
                    <span>{app.name}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleOpenDeviceFolder}
                  className="flex shrink-0 items-center gap-1.5 rounded-xl border border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/60 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:border-blue-500 hover:shadow-xs transition"
                >
                  <span>📁</span>
                  <span>Open Folder</span>
                </button>
              </div>
            </div>

            {filteredTasks.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center text-center">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-surface text-muted-foreground">
                  <Filter className="size-5" />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  No tasks matching category "{selectedCategoryFilter}".
                </p>
                <button
                  onClick={() => setSelectedCategoryFilter("All")}
                  className="mt-2 text-xs font-semibold text-brand hover:underline"
                >
                  Reset Filter
                </button>
              </div>
            ) : (
              filteredTasks.map((t) => (
                <div
                  key={t.id}
                  className={cn(
                    "flex flex-col gap-1.5 transition",
                    t.role === "user" ? "items-end" : "items-start",
                  )}
                >
                  {/* Message Header Labels */}
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="font-semibold">{t.role === "user" ? "You" : "My AI Cowork"}</span>
                    <span>•</span>
                    <span suppressHydrationWarning>{t.timestamp}</span>
                    {t.labels && t.labels.length > 0 && (
                      <>
                        <span>•</span>
                        {t.labels.map((l, i) => (
                          <span
                            key={i}
                            className="rounded-md bg-surface px-1.5 py-0.2 text-[9px] font-medium text-muted-foreground border border-border/40"
                          >
                            {l}
                          </span>
                        ))}
                      </>
                    )}
                  </div>

                  {/* Message Bubble */}
                  {t.role === "user" ? (
                    <div className="max-w-[85%] rounded-2xl rounded-tr-xs bg-brand px-4 py-2.5 text-sm text-brand-foreground shadow-xs">
                      {t.screenCapture && (
                        <div className="mb-2 overflow-hidden rounded-xl border border-white/20">
                          <img
                            src={t.screenCapture}
                            alt="Screen capture"
                            className="max-h-48 w-full object-cover"
                          />
                          <div className="bg-black/60 px-2 py-1 text-[10px] font-mono text-zinc-300">
                            🖥️ Screen Share Captured
                          </div>
                        </div>
                      )}

                      {t.folderSummary && (
                        <div className="mb-1.5 flex items-center gap-1.5 rounded-lg bg-white/10 px-2 py-1 text-[11px] font-mono">
                          <FolderUp className="size-3 text-brand-foreground" /> {t.folderSummary}
                        </div>
                      )}

                      {t.attachments && t.attachments.length > 0 && (
                        <div className="mb-1.5 flex flex-wrap gap-1">
                          {t.attachments.map((att, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 rounded bg-white/15 px-2 py-0.5 text-[10px]"
                            >
                              <Paperclip className="size-2.5" /> {att}
                            </span>
                          ))}
                        </div>
                      )}

                      <p className="whitespace-pre-wrap leading-relaxed">{t.content}</p>
                    </div>
                  ) : (
                    /* Coworker AI Message with rich actions & app opening */
                    <div className="w-full max-w-[95%] space-y-3 rounded-2xl border border-border/80 bg-surface/50 p-4 text-sm shadow-xs">
                      <div className="prose prose-sm max-w-none text-ink leading-relaxed">
                        <ReactMarkdown
                          components={{
                            img({ src, alt }: any) {
                              if (!src) return null;
                              return <SafeMarkdownImage src={src} alt={alt || "Image"} />;
                            },
                          }}
                        >
                          {t.content}
                        </ReactMarkdown>
                      </div>

                      {/* Rich Action Cards generated by Coworker (Multi-task layout) */}
                      {t.coworkData?.actions && t.coworkData.actions.length > 0 && (
                        <div className="grid grid-cols-1 gap-2.5 pt-1 sm:grid-cols-2">
                          {t.coworkData.actions.map((act, actIdx) => (
                            <div
                              key={actIdx}
                              className={cn(
                                "rounded-xl border border-border/80 bg-canvas p-3 shadow-2xs transition hover:border-brand/30",
                                act.type === "code_execution" ? "sm:col-span-2" : "",
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="flex size-7 items-center justify-center rounded-lg bg-brand/10 text-brand">
                                    {act.type === "app_launcher" && <Play className="size-3.5" />}
                                    {act.type === "browser_nav" && <Globe className="size-3.5" />}
                                    {act.type === "device_action" && <Smartphone className="size-3.5" />}
                                    {act.type === "code_execution" && <Code2 className="size-3.5" />}
                                    {act.type === "map_location" && <MapPin className="size-3.5" />}
                                    {act.type === "suggestion" && <Sparkles className="size-3.5" />}
                                    {act.type === "workflow_step" && <CheckCircle2 className="size-3.5" />}
                                  </div>
                                  <div>
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                      {act.app || act.type.replace(/_/g, " ")}
                                    </div>
                                    <div className="text-xs font-semibold text-ink">{act.title}</div>
                                  </div>
                                </div>

                                {(act.appUrl || act.mapUrl || act.deviceCommand) && (
                                  act.deviceCommand ? (
                                    <button
                                      onClick={() => handleActionClick(act)}
                                      className="flex items-center gap-1 rounded-full bg-brand px-3 py-1 text-xs font-semibold text-brand-foreground shadow-xs hover:opacity-90 transition"
                                    >
                                      <ExternalLink className="size-3" />
                                      Launch
                                    </button>
                                  ) : (
                                    <a
                                      href={act.appUrl || act.mapUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={() => handleActionClick(act, false)}
                                      className="flex items-center gap-1 rounded-full bg-brand px-3 py-1 text-xs font-semibold text-brand-foreground shadow-xs hover:opacity-90 transition"
                                    >
                                      <ExternalLink className="size-3" />
                                      {act.type === "app_launcher" ? `Open ${act.app || "App"}` : act.type === "map_location" ? "Directions" : "Launch"}
                                    </a>
                                  )
                                )}
                              </div>

                              <p className="mt-1.5 text-xs text-muted-foreground">{act.description}</p>

                              {act.type === "app_launcher" && (
                                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                                  <a
                                    href={act.appUrl || `https://www.google.com/search?q=${encodeURIComponent(act.app || act.title)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => handleActionClick(act, false)}
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-1.5 text-xs font-bold text-brand-foreground shadow-xs hover:opacity-90 transition"
                                  >
                                    <Play className="size-3.5 fill-current" />
                                    <span>Open {act.app || "App"} on Device</span>
                                    <ExternalLink className="size-3 ml-0.5 opacity-80" />
                                  </a>
                                  {act.appScheme && (
                                    <a
                                      href={act.appScheme}
                                      onClick={() => handleActionClick({ ...act, appUrl: act.appScheme }, false)}
                                      className="inline-flex items-center gap-1 rounded-xl border border-border bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-ink hover:bg-surface/80 transition"
                                    >
                                      <Smartphone className="size-3" />
                                      <span>Native Client ({act.appScheme.split(":")[0]}://)</span>
                                    </a>
                                  )}
                                </div>
                              )}

                              {/* Enhanced Code Sandbox block */}
                              {act.codeSnippet && (
                                <div className="mt-2 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-100">
                                  <div className="flex items-center justify-between bg-zinc-900 px-3 py-1.5 text-[11px] text-zinc-400">
                                    <span className="font-mono flex items-center gap-1.5">
                                      <Terminal className="size-3 text-emerald-400" />
                                      {act.codeSnippet.filename} ({act.codeSnippet.language})
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                      {(act.codeSnippet.language === "html" || act.codeSnippet.language === "javascript" || act.codeSnippet.language === "typescript") && (
                                        <button
                                          onClick={() => setPreviewCode({
                                            code: act.codeSnippet!.code,
                                            language: act.codeSnippet!.language,
                                            title: act.codeSnippet!.filename,
                                          })}
                                          className="flex items-center gap-1 rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-emerald-400 hover:bg-zinc-700"
                                        >
                                          <Eye className="size-3" /> Run Preview
                                        </button>
                                      )}
                                      <button
                                        onClick={() => copyCode(act.codeSnippet!.code, `${t.id}-${actIdx}`)}
                                        className="flex items-center gap-1 rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-200 hover:bg-zinc-700"
                                      >
                                        {copiedCodeIndex === `${t.id}-${actIdx}` ? (
                                          <Check className="size-3 text-emerald-400" />
                                        ) : (
                                          <Copy className="size-3" />
                                        )}
                                        {copiedCodeIndex === `${t.id}-${actIdx}` ? "Copied" : "Copy"}
                                      </button>
                                      <button
                                        onClick={() => {
                                          const blob = new Blob([act.codeSnippet!.code], { type: "text/plain" });
                                          const url = URL.createObjectURL(blob);
                                          const a = document.createElement("a");
                                          a.href = url;
                                          a.download = act.codeSnippet!.filename;
                                          a.click();
                                          toast.success(`Exported ${act.codeSnippet!.filename}`);
                                        }}
                                        className="flex items-center gap-1 rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-200 hover:bg-zinc-700"
                                      >
                                        <Download className="size-3" />
                                      </button>
                                    </div>
                                  </div>
                                  <pre className="p-3 text-xs font-mono overflow-x-auto text-emerald-400">
                                    <code>{act.codeSnippet.code}</code>
                                  </pre>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}

            {coworkMutation.isPending && (
              <div className="flex items-center gap-2 rounded-2xl border border-brand/20 bg-brand/5 p-3 text-xs font-medium text-brand">
                <Loader2 className="size-4 animate-spin text-brand" />
                <span>My AI Cowork is opening apps, reasoning, and executing multi-task instructions simultaneously...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </main>
      )}

      {/* Live Code Runner Modal */}
      {previewCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="flex h-[80vh] w-full max-w-3xl flex-col rounded-3xl border border-border/80 bg-canvas shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-border/60 bg-surface px-4 py-3">
              <div className="flex items-center gap-2">
                <Code className="size-4 text-brand" />
                <h3 className="text-sm font-semibold text-ink">Live Runner: {previewCode.title}</h3>
              </div>
              <button
                onClick={() => setPreviewCode(null)}
                className="rounded-full p-1 text-muted-foreground hover:bg-surface hover:text-ink"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="flex-1 bg-white p-4 overflow-auto">
              <iframe
                title="Code Runner"
                srcDoc={previewCode.code.includes("<html") ? previewCode.code : `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:20px;"><h3>Live Output</h3><pre id="out"></pre><script>try { ${previewCode.code} } catch(e) { document.getElementById('out').innerText = e.message; }</script></body></html>`}
                className="h-full w-full border-0"
                sandbox="allow-scripts"
              />
            </div>
          </div>
        </div>
      )}

      {/* Bottom Docked Prompt Input Bar */}
      <footer className="border-t border-black/5 bg-surface/50 p-3 md:p-4">
        <div className="mx-auto max-w-3xl">
          {/* Context Badges & Image Previews */}
          {(screenCaptureUrl || folderName || attachedImages.length > 0 || attachedFiles.length > 0 || selectedLabels.length > 0) && (
            <div className="mb-2 space-y-2">
              {/* Attached Images Thumbnail Grid */}
              {attachedImages.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {attachedImages.map((img, i) => (
                    <div
                      key={i}
                      className="group relative size-14 shrink-0 rounded-xl overflow-hidden border border-border shadow-xs bg-surface"
                    >
                      <img src={img} alt={`Attached ${i + 1}`} className="size-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setAttachedImages((prev) => prev.filter((_, idx) => idx !== i))}
                        className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-black/75 text-white hover:bg-red-500 transition shadow-xs"
                        title="Remove image"
                      >
                        <X className="size-2.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="flex size-14 shrink-0 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface/50 text-[10px] font-medium text-muted-foreground hover:bg-surface hover:text-ink transition"
                  >
                    <Plus className="size-4 mb-0.5" />
                    <span>More</span>
                  </button>
                </div>
              )}

              {/* Status Tags */}
              <div className="flex flex-wrap items-center gap-1.5">
                {screenCaptureUrl && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand/15 px-2.5 py-0.5 text-[11px] font-medium text-brand border border-brand/30">
                    <Monitor className="size-3" /> Screen Captured
                    <button
                      onClick={() => setScreenCaptureUrl(null)}
                      className="ml-1 hover:text-red-500"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                )}

                {folderName && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2.5 py-0.5 text-[11px] font-medium text-blue-600 dark:text-blue-400 border border-blue-500/30">
                    <Folder className="size-3" /> Folder: {folderName}
                    <button
                      onClick={() => {
                        setFolderName(null);
                        setFolderContext(null);
                        setDeviceFolderDetails(null);
                      }}
                      className="ml-1 hover:text-red-500"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                )}

                {attachedFiles.map((file, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground border border-border/60"
                  >
                    <Paperclip className="size-3" /> {file.name}
                    <button
                      onClick={() => setAttachedFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      className="ml-1 hover:text-red-500"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}

                {selectedLabels.map((lbl, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-full bg-indigo-500/15 px-2.5 py-0.5 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 border border-indigo-500/30"
                  >
                    <Tag className="size-3" /> #{lbl}
                    <button
                      onClick={() => setSelectedLabels((prev) => prev.filter((_, idx) => idx !== i))}
                      className="ml-1 hover:text-red-500"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Prompt Box */}
          <div className="relative flex items-end gap-2 rounded-2xl border border-border/80 bg-canvas p-2 shadow-xs transition focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/10">
            {/* Side Plus Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowPlusMenu((v) => !v)}
                className="flex size-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-surface hover:text-ink transition"
                title="Attach Folders, Images, Screen & Project Labels"
              >
                <Plus className={cn("size-5 transition", showPlusMenu ? "rotate-45 text-brand" : "")} />
              </button>

              {/* Plus Popup Menu */}
              {showPlusMenu && (
                <div className="absolute bottom-11 left-0 z-50 w-72 rounded-2xl border border-border/80 bg-canvas p-2.5 shadow-2xl animate-in fade-in-0 zoom-in-95 space-y-1">
                  <div className="pb-1 mb-1 border-b border-black/5 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Share & Device Options
                    </span>
                    <button
                      onClick={() => setShowPlusMenu(false)}
                      className="rounded-full p-0.5 text-muted-foreground hover:text-ink"
                    >
                      <X className="size-3" />
                    </button>
                  </div>

                  <div className="space-y-1">
                    {/* 1. Open / Share Folder on Device */}
                    <button
                      type="button"
                      onClick={handleOpenDeviceFolder}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-ink hover:bg-surface transition text-left"
                    >
                      <div className="flex size-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                        <Folder className="size-4" />
                      </div>
                      <div>
                        <div className="font-semibold">Open Folder on Device</div>
                        <div className="text-[10px] text-muted-foreground">Select local project folder or directory</div>
                      </div>
                    </button>

                    {/* 2. Share Images */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowPlusMenu(false);
                        imageInputRef.current?.click();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-ink hover:bg-surface transition text-left"
                    >
                      <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                        <ImageIcon className="size-4" />
                      </div>
                      <div>
                        <div className="font-semibold">Share Images / Mockups</div>
                        <div className="text-[10px] text-muted-foreground">Attach screenshots, designs & diagrams</div>
                      </div>
                    </button>

                    {/* 3. Share Screen */}
                    <button
                      type="button"
                      onClick={handleShareScreen}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-ink hover:bg-surface transition text-left"
                    >
                      <div className="flex size-7 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600">
                        <Monitor className="size-4" />
                      </div>
                      <div>
                        <div className="font-semibold">Share Screen / Window</div>
                        <div className="text-[10px] text-muted-foreground">Capture live desktop monitor or tab</div>
                      </div>
                    </button>

                    {/* 4. Upload Files */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowPlusMenu(false);
                        fileInputRef.current?.click();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-ink hover:bg-surface transition text-left"
                    >
                      <div className="flex size-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                        <Paperclip className="size-4" />
                      </div>
                      <div>
                        <div className="font-semibold">Upload Documents</div>
                        <div className="text-[10px] text-muted-foreground">CSVs, JSON, configs, docs</div>
                      </div>
                    </button>
                  </div>

                  <div className="mt-2 border-t border-border/40 pt-2 px-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                      <Tag className="size-3 text-indigo-500" /> Add Project Label
                    </div>
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={customLabelInput}
                        onChange={(e) => setCustomLabelInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddCustomLabel();
                          }
                        }}
                        placeholder="e.g. Frontend, API"
                        className="w-full rounded-lg border border-border/60 bg-surface px-2 py-1 text-xs outline-none focus:border-brand"
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomLabel}
                        className="rounded-lg bg-ink px-2 py-1 text-xs font-semibold text-white hover:opacity-90"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Hidden Inputs for Folder, Images and Files */}
            <input
              type="file"
              ref={folderInputRef}
              onChange={handleFolderSelect}
              {...({ webkitdirectory: "", directory: "", multiple: true } as any)}
              className="hidden"
            />
            <input
              type="file"
              ref={imageInputRef}
              onChange={handleImagesSelect}
              accept="image/*"
              multiple
              className="hidden"
            />
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFilesSelect}
              multiple
              className="hidden"
            />

            {/* Textarea Input */}
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask coworker, open apps, write code, run multiple tasks..."
              rows={1}
              className="max-h-32 min-h-[38px] flex-1 resize-none bg-transparent py-2 text-sm text-ink outline-none"
            />

            {/* Voice Recorder Button */}
            <button
              type="button"
              onClick={toggleVoiceRecording}
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-xl transition",
                listening
                  ? "bg-red-500 text-white animate-pulse shadow-md"
                  : "text-muted-foreground hover:bg-surface hover:text-ink",
              )}
              title={listening ? "Stop voice recording" : "Record voice & convert to text"}
            >
              {listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
            </button>

            {/* Send Button */}
            <button
              type="button"
              onClick={handleSend}
              disabled={
                coworkMutation.isPending ||
                (!prompt.trim() &&
                  !screenCaptureUrl &&
                  !folderContext &&
                  attachedFiles.length === 0 &&
                  attachedImages.length === 0)
              }
              className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-ink text-white shadow-xs transition hover:opacity-90 disabled:opacity-30"
              title="Send to My AI Cowork"
            >
              {coworkMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
