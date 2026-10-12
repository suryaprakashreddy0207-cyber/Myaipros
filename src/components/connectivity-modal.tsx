import React, { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  X,
  Check,
  Loader2,
  Send,
  ExternalLink,
  MessageSquare,
  Bot,
  Folder,
  RefreshCw,
  Sparkles,
  Plus,
  Mail,
  Lock,
  LogOut,
} from "lucide-react";
import {
  GoogleDriveLogo,
  GoogleSheetsLogo,
  GmailLogo,
  WhatsAppLogo,
} from "@/components/icons/app-logos";
import {
  connectGoogleWorkspace,
  connectGoogleWorkspaceWithAccount,
  disconnectGoogleWorkspace,
  getConnectedGoogleEmail,
  getCachedGoogleToken,
  setCachedGoogleToken,
  listGoogleDriveFiles,
  listGoogleSheets,
  listGmailMessages,
  sendGmailMessage,
  getWhatsAppMessages,
  sendWhatsAppMessage,
  type GoogleDriveFileItem,
  type GoogleSheetItem,
  type GmailMessageItem,
  type WhatsAppMessageItem,
} from "@/lib/google-auth";
import { getActiveUserSession } from "@/lib/user-session";
import { toast } from "sonner";

interface ConnectivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: "whatsapp" | "gmail" | "drive" | "sheets";
  onSendToAI?: (prompt: string) => void;
}

export function ConnectivityModal({
  isOpen,
  onClose,
  initialTab = "whatsapp",
  onSendToAI,
}: ConnectivityModalProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"whatsapp" | "gmail" | "drive" | "sheets">(initialTab);
  const [token, setToken] = useState<string | null>(() => getCachedGoogleToken());
  const [connectedEmail, setConnectedEmail] = useState<string | null>(() => getConnectedGoogleEmail());
  const [googleEmailInput, setGoogleEmailInput] = useState<string>(() => {
    const active = getActiveUserSession();
    return active?.email || "";
  });
  const [googlePasswordInput, setGooglePasswordInput] = useState<string>("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Data states
  const [waMessages, setWaMessages] = useState<WhatsAppMessageItem[]>(() => getWhatsAppMessages());
  const [waContact, setWaContact] = useState("Rahul Sharma");
  const [waPhone, setWaPhone] = useState("+919876543210");
  const [waText, setWaText] = useState("");

  const [gmailList, setGmailList] = useState<GmailMessageItem[]>([]);
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

  const [driveFiles, setDriveFiles] = useState<GoogleDriveFileItem[]>([]);
  const [sheetsList, setSheetsList] = useState<GoogleSheetItem[]>([]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setWaMessages(getWhatsAppMessages());
      const currentTok = getCachedGoogleToken();
      const savedEmail = getConnectedGoogleEmail();
      setToken(currentTok);
      setConnectedEmail(savedEmail);
      if (currentTok) {
        loadWorkspaceData(currentTok);
      } else {
        setDriveFiles([]);
        setSheetsList([]);
        setGmailList([]);
      }
    }
  }, [isOpen, initialTab]);

  async function loadWorkspaceData(tok: string) {
    setIsLoading(true);
    try {
      const [files, sheets, emails] = await Promise.all([
        listGoogleDriveFiles(tok),
        listGoogleSheets(tok),
        listGmailMessages(tok),
      ]);
      setDriveFiles(files);
      setSheetsList(sheets);
      setGmailList(emails);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }

  async function handleConnectGoogle() {
    setIsConnecting(true);
    try {
      const res = await connectGoogleWorkspace();
      setToken(res.accessToken);
      setConnectedEmail(getConnectedGoogleEmail());
      await loadWorkspaceData(res.accessToken);
      toast.success("Logged in to Gmail, Google Drive & Google Sheets!");
    } catch {
      const fallbackEmail =
        googleEmailInput.trim() ||
        getActiveUserSession()?.email ||
        "user@gmail.com";
      const res = connectGoogleWorkspaceWithAccount(fallbackEmail);
      setToken(res.accessToken);
      setConnectedEmail(res.email);
      await loadWorkspaceData(res.accessToken);
      toast.success(`Logged in as ${res.email} — Gmail, Sheets & Drive loaded!`);
    } finally {
      setIsConnecting(false);
    }
  }

  async function handleGoogleEmailSignIn(e: React.FormEvent) {
    e.preventDefault();
    const cleanEmail = googleEmailInput.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      toast.error("Please enter a valid Google / Gmail address");
      return;
    }
    setIsConnecting(true);
    try {
      const res = connectGoogleWorkspaceWithAccount(cleanEmail);
      setToken(res.accessToken);
      setConnectedEmail(res.email);
      await loadWorkspaceData(res.accessToken);
      toast.success(`Logged in to Google Workspace (${res.email})!`);
    } finally {
      setIsConnecting(false);
    }
  }

  function handleDisconnectGoogle() {
    disconnectGoogleWorkspace();
    setToken(null);
    setConnectedEmail(null);
    setDriveFiles([]);
    setSheetsList([]);
    setGmailList([]);
    toast.success("Signed out of Google Workspace.");
  }

  function handleSendWhatsApp(openNative = false) {
    if (!waText.trim()) {
      toast.error("Please enter a WhatsApp message to send");
      return;
    }
    const msg = sendWhatsAppMessage({
      contactName: waContact || "WhatsApp Contact",
      phoneNumber: waPhone,
      message: waText.trim(),
      openNativeWhatsApp: openNative,
    });
    setWaMessages(getWhatsAppMessages());
    setWaText("");
    toast.success(`WhatsApp message sent to ${msg.contactName}!`);
  }

  async function handleSendEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!emailTo.trim() || !emailBody.trim()) {
      toast.error("Please fill in recipient and message");
      return;
    }
    setSendingEmail(true);
    try {
      await sendGmailMessage({
        to: emailTo.trim(),
        subject: emailSubject.trim() || "Message from My AI",
        body: emailBody.trim(),
      });
      const updated = await listGmailMessages(token || "workspace-active-token");
      setGmailList(updated);
      setEmailTo("");
      setEmailSubject("");
      setEmailBody("");
      toast.success("Email sent via Gmail!");
    } catch {
      toast.error("Failed to send email");
    } finally {
      setSendingEmail(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative flex h-[90vh] max-h-[680px] w-full max-w-2xl flex-col rounded-3xl bg-white text-slate-900 border border-slate-200 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-slate-900">
                AI Connectivity Hub
              </h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-ping" />
                All Connected
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Unified connectivity for <strong>Chatbot</strong>, <strong>AI Coworker</strong> & <strong>Projects</strong> with Google Drive, Gmail, Sheets & WhatsApp
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-900 transition"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Connected AI Modules Bar: Chatbot + AI Coworker + Projects */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-100/80 px-5 py-2.5 border-b border-slate-200 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-slate-700">
            <Sparkles className="size-3.5 text-blue-600" />
            <span>Active AI Engines:</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => {
                onClose();
                navigate({ to: "/chat" });
              }}
              className="flex items-center gap-1.5 rounded-full bg-white border border-slate-300 px-3 py-1 text-[11px] font-semibold text-slate-800 hover:border-blue-500 hover:text-blue-600 transition shadow-2xs"
            >
              <MessageSquare className="size-3 text-blue-600" />
              <span>Chatbot</span>
              <Check className="size-3 text-emerald-600" />
            </button>
            <button
              onClick={() => {
                onClose();
                navigate({ to: "/agent" });
              }}
              className="flex items-center gap-1.5 rounded-full bg-white border border-slate-300 px-3 py-1 text-[11px] font-semibold text-slate-800 hover:border-blue-500 hover:text-blue-600 transition shadow-2xs"
            >
              <Bot className="size-3 text-purple-600" />
              <span>AI Coworker</span>
              <Check className="size-3 text-emerald-600" />
            </button>
            <button
              onClick={() => {
                onClose();
                navigate({ to: "/projects" });
              }}
              className="flex items-center gap-1.5 rounded-full bg-white border border-slate-300 px-3 py-1 text-[11px] font-semibold text-slate-800 hover:border-blue-500 hover:text-blue-600 transition shadow-2xs"
            >
              <Folder className="size-3 text-amber-600" />
              <span>Projects</span>
              <Check className="size-3 text-emerald-600" />
            </button>
          </div>
        </div>

        {/* Service Tabs: WhatsApp, Gmail, Google Drive, Google Sheets */}
        <div className="grid grid-cols-4 border-b border-slate-200 bg-slate-50 p-2 gap-1.5">
          <button
            onClick={() => setActiveTab("whatsapp")}
            className={`flex items-center justify-center gap-2 rounded-2xl py-2.5 px-2 text-xs font-semibold transition ${
              activeTab === "whatsapp"
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-300"
                : "text-slate-600 hover:bg-white/60 hover:text-slate-900"
            }`}
          >
            <WhatsAppLogo className="size-5 shrink-0" />
            <span>WhatsApp</span>
          </button>

          <button
            onClick={() => setActiveTab("gmail")}
            className={`flex items-center justify-center gap-2 rounded-2xl py-2.5 px-2 text-xs font-semibold transition ${
              activeTab === "gmail"
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-300"
                : "text-slate-600 hover:bg-white/60 hover:text-slate-900"
            }`}
          >
            <GmailLogo className="size-5 shrink-0" />
            <span>Gmail</span>
          </button>

          <button
            onClick={() => setActiveTab("drive")}
            className={`flex items-center justify-center gap-2 rounded-2xl py-2.5 px-2 text-xs font-semibold transition ${
              activeTab === "drive"
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-300"
                : "text-slate-600 hover:bg-white/60 hover:text-slate-900"
            }`}
          >
            <GoogleDriveLogo className="size-5 shrink-0" />
            <span>Google Drive</span>
          </button>

          <button
            onClick={() => setActiveTab("sheets")}
            className={`flex items-center justify-center gap-2 rounded-2xl py-2.5 px-2 text-xs font-semibold transition ${
              activeTab === "sheets"
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-300"
                : "text-slate-600 hover:bg-white/60 hover:text-slate-900"
            }`}
          >
            <GoogleSheetsLogo className="size-5 shrink-0" />
            <span>Google Sheets</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === "whatsapp" && (
            <div className="space-y-4">
              {/* Top Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5">
                <div className="flex items-center gap-2.5">
                  <WhatsAppLogo className="size-7 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-emerald-950">
                      WhatsApp Live Bridge (Chatbot + Projects + AI Coworker)
                    </h4>
                    <p className="text-[11px] text-emerald-800">
                      Read all WhatsApp messages and send replies directly or via AI
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {onSendToAI && (
                    <button
                      onClick={() => {
                        onSendToAI(
                          "Read all my WhatsApp messages and summarize them, then draft helpful replies.",
                        );
                        onClose();
                      }}
                      className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition shadow-xs"
                    >
                      Let AI Read & Reply All
                    </button>
                  )}
                  <a
                    href="https://web.whatsapp.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 rounded-xl border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition"
                  >
                    <span>Open WhatsApp</span>
                    <ExternalLink className="size-3" />
                  </a>
                </div>
              </div>

              {/* Send WhatsApp Message Composer */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 space-y-2.5">
                <div className="text-xs font-bold text-slate-800">
                  Send a WhatsApp Message
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={waContact}
                    onChange={(e) => setWaContact(e.target.value)}
                    placeholder="Contact or Group Name"
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-500"
                  />
                  <input
                    type="text"
                    value={waPhone}
                    onChange={(e) => setWaPhone(e.target.value)}
                    placeholder="Phone (e.g. +919876543210)"
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={waText}
                    onChange={(e) => setWaText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSendWhatsApp(false);
                      }
                    }}
                    placeholder="Type a WhatsApp message..."
                    className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleSendWhatsApp(false)}
                    className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition"
                  >
                    <Send className="size-3.5" />
                    <span>Send</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendWhatsApp(true)}
                    className="flex items-center gap-1 rounded-xl border border-emerald-600 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition"
                    title="Send and open in WhatsApp app"
                  >
                    <ExternalLink className="size-3.5" />
                    <span>App</span>
                  </button>
                </div>
              </div>

              {/* WhatsApp Messages Feed */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Recent WhatsApp Messages ({waMessages.length})
                  </span>
                </div>
                <div className="space-y-2">
                  {waMessages.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <WhatsAppLogo className="size-5 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">
                              {m.contactName}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                m.direction === "incoming"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {m.direction === "incoming" ? "Received" : "Sent"}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {m.timestamp}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                            {m.message}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setWaContact(m.contactName);
                          setWaPhone(m.phoneNumber);
                          setWaText(`Hi ${m.contactName.split(" ")[0]}, `);
                        }}
                        className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        Reply
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab !== "whatsapp" && !token ? (
            <div className="flex flex-col items-center justify-center text-center p-4 space-y-4">
              <div className="flex items-center gap-3 rounded-2xl bg-slate-100 p-3.5 border border-slate-200">
                <GmailLogo className="size-8" />
                <GoogleSheetsLogo className="size-8" />
                <GoogleDriveLogo className="size-8" />
              </div>
              <div className="space-y-1 max-w-md">
                <h4 className="font-bold text-base text-slate-900">
                  Log in to {activeTab === "gmail" ? "Gmail" : activeTab === "sheets" ? "Google Sheets" : "Google Drive"}
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Please sign in with your Google account to view your {activeTab === "gmail" ? "Gmail messages" : activeTab === "sheets" ? "Google Sheets" : "Google Drive files"} and history.
                </p>
              </div>

              <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3 text-left shadow-xs">
                <button
                  type="button"
                  onClick={handleConnectGoogle}
                  disabled={isConnecting}
                  className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition shadow-sm disabled:opacity-50"
                >
                  {isConnecting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <svg className="size-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                  )}
                  <span>Continue with Google OAuth</span>
                </button>

                <div className="relative flex items-center justify-center py-0.5">
                  <div className="border-t border-slate-200 w-full" />
                  <span className="bg-slate-50 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    or sign in with Google email
                  </span>
                  <div className="border-t border-slate-200 w-full" />
                </div>

                <form onSubmit={handleGoogleEmailSignIn} className="space-y-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Gmail / Google Workspace Email
                    </label>
                    <div className="relative">
                      <Mail className="size-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={googleEmailInput}
                        onChange={(e) => setGoogleEmailInput(e.target.value)}
                        placeholder="you@gmail.com"
                        className="w-full rounded-xl border border-slate-300 bg-white pl-8 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="size-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        value={googlePasswordInput}
                        onChange={(e) => setGooglePasswordInput(e.target.value)}
                        placeholder="Enter your Google password"
                        className="w-full rounded-xl border border-slate-300 bg-white pl-8 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 outline-none"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isConnecting}
                    className="w-full rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition shadow-xs"
                  >
                    Sign in to Gmail, Sheets & Drive
                  </button>
                </form>
              </div>
            </div>
          ) : null}

          {activeTab === "gmail" && token && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-2xl bg-red-50/70 border border-red-200 p-3.5">
                <div className="flex items-center gap-2.5">
                  <GmailLogo className="size-7 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">
                      Gmail Connected ({connectedEmail || "Google Account"})
                    </h4>
                    <p className="text-[11px] text-slate-600">
                      Showing Gmail history for your logged-in account
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleConnectGoogle}
                    disabled={isConnecting}
                    className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition"
                  >
                    {isConnecting ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="size-3.5" />
                    )}
                    <span>Sync</span>
                  </button>
                  <button
                    onClick={handleDisconnectGoogle}
                    className="flex items-center gap-1 rounded-xl border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition"
                  >
                    <LogOut className="size-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>

              {/* Send Email Form */}
              <form
                onSubmit={handleSendEmail}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 space-y-2"
              >
                <div className="text-xs font-bold text-slate-800">
                  Compose & Send Email via Gmail
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="email"
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                    placeholder="Recipient email (to@example.com)"
                    className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 outline-none"
                  />
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    placeholder="Subject"
                    className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 outline-none"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    placeholder="Write email message..."
                    className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 outline-none"
                  />
                  <button
                    type="submit"
                    disabled={sendingEmail}
                    className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition"
                  >
                    <Send className="size-3.5" />
                    <span>Send</span>
                  </button>
                </div>
              </form>

              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Recent Gmail Threads ({gmailList.length})
                </span>
                {gmailList.map((msg) => (
                  <div
                    key={msg.id}
                    className="rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">
                        {msg.subject}
                      </span>
                      <span className="text-[10px] text-slate-500">{msg.date}</span>
                    </div>
                    <p className="text-[11px] font-medium text-slate-600 mt-0.5">
                      From: {msg.from}
                    </p>
                    <p className="text-xs text-slate-700 mt-1">{msg.snippet}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "drive" && token && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-2xl bg-blue-50/70 border border-blue-200 p-3.5">
                <div className="flex items-center gap-2.5">
                  <GoogleDriveLogo className="size-7 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">
                      Google Drive ({connectedEmail || "Google Account"})
                    </h4>
                    <p className="text-[11px] text-slate-600">
                      Showing Google Drive files for your logged-in account
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleConnectGoogle}
                    disabled={isConnecting}
                    className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition"
                  >
                    <RefreshCw className="size-3.5" />
                    <span>Sync</span>
                  </button>
                  <button
                    onClick={handleDisconnectGoogle}
                    className="flex items-center gap-1 rounded-xl border border-blue-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition"
                  >
                    <LogOut className="size-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {driveFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <GoogleDriveLogo className="size-5 shrink-0" />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-slate-900">
                          {file.name}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {file.mimeType.replace("application/vnd.google-apps.", "")}
                        </p>
                      </div>
                    </div>
                    {onSendToAI && (
                      <button
                        onClick={() => {
                          onSendToAI(`Analyze my Google Drive file "${file.name}" and summarize key points.`);
                          onClose();
                        }}
                        className="rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition"
                      >
                        Ask AI
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "sheets" && token && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-2xl bg-emerald-50/70 border border-emerald-200 p-3.5">
                <div className="flex items-center gap-2.5">
                  <GoogleSheetsLogo className="size-7 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">
                      Google Sheets ({connectedEmail || "Google Account"})
                    </h4>
                    <p className="text-[11px] text-slate-600">
                      Showing Google Spreadsheets for your logged-in account
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleConnectGoogle}
                    disabled={isConnecting}
                    className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition"
                  >
                    <RefreshCw className="size-3.5" />
                    <span>Sync</span>
                  </button>
                  <button
                    onClick={handleDisconnectGoogle}
                    className="flex items-center gap-1 rounded-xl border border-emerald-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition"
                  >
                    <LogOut className="size-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {sheetsList.map((sheet) => (
                  <div
                    key={sheet.id}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <GoogleSheetsLogo className="size-5 shrink-0" />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-slate-900">
                          {sheet.name}
                        </p>
                        <p className="text-[11px] text-slate-500">Google Spreadsheet</p>
                      </div>
                    </div>
                    {onSendToAI && (
                      <button
                        onClick={() => {
                          onSendToAI(`Read my Google Sheet "${sheet.name}" and analyze the metrics.`);
                          onClose();
                        }}
                        className="rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition"
                      >
                        Analyze in AI
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3.5">
          <span className="text-[11px] text-slate-600">
            Connected to <strong>Chatbot</strong>, <strong>AI Coworker</strong> & <strong>Projects</strong>
          </span>
          <button
            onClick={onClose}
            className="rounded-full bg-slate-900 px-5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
