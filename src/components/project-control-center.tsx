import { useState } from "react";
import {
  X,
  Pencil,
  Cloud,
  Database,
  Users,
  HardDrive,
  Sparkles,
  CreditCard,
  Mail,
  History,
  Settings,
  ChevronRight,
  ArrowLeft,
  Check,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Copy,
  ExternalLink,
  RefreshCw,
  Shield,
  Zap,
  Globe,
  FileCode2,
  Rocket,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { BuiltFile } from "@/lib/builder.functions";

export type ProjectControlView =
  | "menu"
  | "cloud_overview"
  | "database"
  | "users"
  | "storage"
  | "ai"
  | "payments"
  | "email"
  | "history"
  | "settings";

export interface ProjectControlCenterProps {
  open: boolean;
  onClose: () => void;
  projectName: string;
  projectDescription: string;
  onRenameProject: (newName: string, newDesc?: string) => void;
  files: BuiltFile[];
  history: any[];
  currentProjectId: string | null;
  onSelectHistoryProject: (item: any) => void;
  onDeleteHistoryProject: (item: any, e?: React.MouseEvent) => void;
  onOpenPublish: () => void;
  onSwitchSlide: (slide: "chat" | "preview") => void;
}

const PAYMENT_PROVIDERS = [
  {
    id: "stripe",
    name: "Stripe",
    desc: "Cards, Apple Pay, Google Pay & subscriptions",
    badge: "Popular",
    color: "bg-indigo-600",
    keyPrefix: "sk_live_...",
  },
  {
    id: "razorpay",
    name: "Razorpay",
    desc: "UPI, Netbanking, Cards & Wallets (India & Global)",
    badge: "UPI Ready",
    color: "bg-blue-600",
    keyPrefix: "rzp_live_...",
  },
  {
    id: "paypal",
    name: "PayPal",
    desc: "PayPal Express Checkout & global merchant payments",
    badge: "Global",
    color: "bg-sky-700",
    keyPrefix: "client_id_...",
  },
  {
    id: "apple_google_pay",
    name: "Apple Pay & Google Pay",
    desc: "One-tap mobile wallet checkout integration",
    badge: "1-Tap",
    color: "bg-zinc-900",
    keyPrefix: "merchant_id_...",
  },
  {
    id: "lemonsqueezy",
    name: "Lemon Squeezy",
    desc: "Merchant of record for SaaS & digital products",
    badge: "Tax Handled",
    color: "bg-amber-500",
    keyPrefix: "lsq_live_...",
  },
];

const EMAIL_PROVIDERS = [
  { id: "resend", name: "Resend", domain: "mail.myaipro.app", status: "Ready" },
  { id: "sendgrid", name: "SendGrid", domain: "smtp.sendgrid.net", status: "Available" },
  { id: "postmark", name: "Postmark", domain: "api.postmarkapp.com", status: "Available" },
  { id: "gmail", name: "Gmail / Google Workspace", domain: "smtp.gmail.com", status: "Available" },
];

export function ProjectControlCenter({
  open,
  onClose,
  projectName,
  projectDescription,
  onRenameProject,
  files,
  history,
  currentProjectId,
  onSelectHistoryProject,
  onDeleteHistoryProject,
  onOpenPublish,
}: ProjectControlCenterProps) {
  const [view, setView] = useState<ProjectControlView>("menu");
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState(projectName);
  const [tempDesc, setTempDesc] = useState(projectDescription);

  // Credits & Cloud state
  const [creditsTotal] = useState(500);
  const [creditsLeft, setCreditsLeft] = useState(485);
  const [aiGatewayEnabled, setAiGatewayEnabled] = useState(true);

  // Database state
  const [dbTables, setDbTables] = useState([
    { name: "users", rows: 14, rls: "Enabled", updated: "Just now" },
    { name: "tasks", rows: 38, rls: "Enabled", updated: "2m ago" },
    { name: "sessions", rows: 19, rls: "Enabled", updated: "5m ago" },
    { name: "payments", rows: 6, rls: "Enabled", updated: "12m ago" },
  ]);
  const [newTableName, setNewTableName] = useState("");

  // Users / Auth state
  const [authUsers, setAuthUsers] = useState([
    { id: "usr_1", email: "founder@myaipro.app", role: "Admin", provider: "Email / Supabase", created: "Today" },
    { id: "usr_2", email: "alex.dev@example.com", role: "Member", provider: "GitHub OAuth", created: "Today" },
    { id: "usr_3", email: "sarah@company.io", role: "Member", provider: "Google OAuth", created: "Yesterday" },
  ]);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [requireEmailConfirm, setRequireEmailConfirm] = useState(false);

  // Storage Buckets state
  const [buckets, setBuckets] = useState([
    { name: "avatars", access: "Public", files: 24, size: "4.2 MB" },
    { name: "project-assets", access: "Public", files: 18, size: "12.8 MB" },
    { name: "private-documents", access: "Private (RLS)", files: 7, size: "3.1 MB" },
  ]);
  const [newBucketName, setNewBucketName] = useState("");

  // Payments state
  const [connectedPayments, setConnectedPayments] = useState<Record<string, boolean>>({
    stripe: true,
  });
  const [paymentKeys, setPaymentKeys] = useState<Record<string, string>>({});
  const [activePaymentConfig, setActivePaymentConfig] = useState<string | null>(null);

  // Email state
  const [connectedEmail, setConnectedEmail] = useState<string>("resend");
  const [emailApiKey, setEmailApiKey] = useState("");
  const [testRecipient, setTestRecipient] = useState("");

  // Settings state
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [envVars, setEnvVars] = useState<{ key: string; value: string }[]>([
    { key: "VITE_SUPABASE_URL", value: "https://project.supabase.co" },
    { key: "VITE_APP_NAME", value: projectName },
  ]);
  const [newEnvKey, setNewEnvKey] = useState("");
  const [newEnvVal, setNewEnvVal] = useState("");
  const [showSecrets, setShowSecrets] = useState(false);

  if (!open) return null;

  function handleSaveRename() {
    if (!tempName.trim()) return;
    onRenameProject(tempName.trim(), tempDesc.trim());
    setEditingName(false);
    toast.success("Project details updated");
  }

  function resetToMenu() {
    setView("menu");
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#f7f7f6] text-zinc-900 animate-in fade-in duration-150 overflow-hidden">
      {/* Top Bar matching Screenshot 1 */}
      <header className="flex h-16 shrink-0 items-center justify-between px-4 bg-[#f7f7f6] border-b border-black/5">
        <div className="flex items-center gap-2">
          {view !== "menu" ? (
            <button
              type="button"
              onClick={resetToMenu}
              className="flex size-11 items-center justify-center rounded-full bg-white border border-black/8 text-zinc-800 shadow-2xs hover:bg-zinc-50 active:scale-95 transition"
              title="Back to Project Menu"
            >
              <ArrowLeft className="size-5 stroke-[1.75]" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="flex size-11 items-center justify-center rounded-full bg-white border border-black/8 text-zinc-800 shadow-2xs hover:bg-zinc-50 active:scale-95 transition"
              title="Close menu"
            >
              <X className="size-5 stroke-[1.75]" />
            </button>
          )}
        </div>

        {/* Center Pill */}
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-2 rounded-full bg-white border border-black/8 px-4 py-2.5 shadow-2xs hover:bg-zinc-50 transition max-w-[240px] sm:max-w-xs"
        >
          <span className="truncate text-[15px] font-medium text-zinc-900">
            {projectName}
          </span>
        </button>

        {/* Right Button */}
        <button
          type="button"
          onClick={onClose}
          className="flex size-11 items-center justify-center rounded-full bg-white border border-black/8 text-zinc-800 shadow-2xs hover:bg-zinc-50 active:scale-95 transition"
          title="Back to Workspace"
        >
          <ChevronRight className="size-5 stroke-[1.75]" />
        </button>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-lg space-y-6 pb-12">
          {view === "menu" && (
            <>
              {/* Project Header Title + Edit Pencil */}
              <div className="px-1">
                {editingName ? (
                  <div className="rounded-2xl bg-white p-4 border border-black/10 shadow-xs space-y-3">
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                        Project Name
                      </label>
                      <input
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-900 outline-none focus:border-zinc-900"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                        Description
                      </label>
                      <input
                        value={tempDesc}
                        onChange={(e) => setTempDesc(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-xs text-zinc-700 outline-none focus:border-zinc-900"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingName(false)}
                        className="rounded-xl px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveRename}
                        className="rounded-xl bg-zinc-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-zinc-900 truncate">
                      {projectName}
                    </h2>
                    <button
                      type="button"
                      onClick={() => {
                        setTempName(projectName);
                        setTempDesc(projectDescription);
                        setEditingName(true);
                      }}
                      className="p-2 text-zinc-600 hover:text-zinc-900 rounded-full hover:bg-black/5 transition"
                      title="Rename project"
                    >
                      <Pencil className="size-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Section 1: Cloud */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 px-1 pb-2 text-zinc-500">
                  <Cloud className="size-4" />
                  <span className="text-[15px] font-medium">Cloud</span>
                </div>

                <div className="divide-y divide-zinc-200/70 rounded-2xl bg-transparent">
                  {[
                    { id: "cloud_overview", label: "Overview", icon: Cloud },
                    { id: "database", label: "Database", icon: Database, badge: `${dbTables.length} tables` },
                    { id: "users", label: "Users", icon: Users, badge: `${authUsers.length} users` },
                    { id: "storage", label: "Storage", icon: HardDrive, badge: `${buckets.length} buckets` },
                    { id: "ai", label: "AI", icon: Sparkles, badge: "Active" },
                    {
                      id: "payments",
                      label: "Payments",
                      icon: CreditCard,
                      badge: `${Object.values(connectedPayments).filter(Boolean).length} connected`,
                    },
                    { id: "email", label: "Email", icon: Mail, badge: "Configured" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setView(item.id as ProjectControlView)}
                      className="flex w-full items-center justify-between py-3.5 px-2 text-left hover:bg-black/[0.03] rounded-xl transition group"
                    >
                      <span className="text-[16px] font-normal text-zinc-900">
                        {item.label}
                      </span>
                      <div className="flex items-center gap-2">
                        {item.badge && (
                          <span className="text-xs text-zinc-400 group-hover:text-zinc-600">
                            {item.badge}
                          </span>
                        )}
                        <ChevronRight className="size-4 text-zinc-400 group-hover:text-zinc-800 transition" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Section 2: History & Settings */}
              <div className="space-y-1 border-t border-zinc-200/80 pt-3">
                <button
                  type="button"
                  onClick={() => setView("history")}
                  className="flex w-full items-center justify-between py-3.5 px-2 text-left hover:bg-black/[0.03] rounded-xl transition group"
                >
                  <div className="flex items-center gap-3">
                    <History className="size-5 text-zinc-700" />
                    <span className="text-[16px] font-normal text-zinc-900">History</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-400">{history.length} builds</span>
                    <ChevronRight className="size-4 text-zinc-400 group-hover:text-zinc-800" />
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setView("settings")}
                  className="flex w-full items-center justify-between py-3.5 px-2 text-left hover:bg-black/[0.03] rounded-xl transition group"
                >
                  <div className="flex items-center gap-3">
                    <Settings className="size-5 text-zinc-700" />
                    <span className="text-[16px] font-normal text-zinc-900">Settings</span>
                  </div>
                  <ChevronRight className="size-4 text-zinc-400 group-hover:text-zinc-800" />
                </button>
              </div>

              {/* Bottom Credits Left Card matching Screenshot 1 */}
              <div className="pt-6">
                <div className="rounded-3xl bg-white border border-black/8 p-5 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[16px] font-semibold text-zinc-900">
                      {creditsLeft} credits left
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setCreditsLeft((c) => c + 100);
                        toast.success("Added +100 AI Cloud Credits to your workspace!");
                      }}
                      className="rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50 transition shadow-2xs"
                    >
                      Add credits
                    </button>
                  </div>

                  {/* Progress Bar */}
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-100">
                    <div
                      className="h-full rounded-full bg-blue-600 transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.round((creditsLeft / creditsTotal) * 100))}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-zinc-500">
                    <span>Cloud AI & Full-Stack Build Engine</span>
                    <span>{files.length} active project files</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ==================== SUBVIEW: CLOUD OVERVIEW ==================== */}
          {view === "cloud_overview" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-zinc-900">Cloud Overview</h3>
                  <p className="text-xs text-zinc-500">
                    Full-stack backend services provisioned for {projectName}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-700">
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse" /> Healthy
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white p-4 border border-black/8 shadow-2xs">
                  <span className="text-xs text-zinc-500">Database Tables</span>
                  <p className="text-2xl font-bold text-zinc-900 mt-1">{dbTables.length}</p>
                  <span className="text-[11px] text-emerald-600 font-medium">PostgreSQL + RLS</span>
                </div>
                <div className="rounded-2xl bg-white p-4 border border-black/8 shadow-2xs">
                  <span className="text-xs text-zinc-500">Registered Users</span>
                  <p className="text-2xl font-bold text-zinc-900 mt-1">{authUsers.length}</p>
                  <span className="text-[11px] text-blue-600 font-medium">Supabase Auth Active</span>
                </div>
                <div className="rounded-2xl bg-white p-4 border border-black/8 shadow-2xs">
                  <span className="text-xs text-zinc-500">Storage Buckets</span>
                  <p className="text-2xl font-bold text-zinc-900 mt-1">{buckets.length}</p>
                  <span className="text-[11px] text-zinc-600 font-medium">20.1 MB used</span>
                </div>
                <div className="rounded-2xl bg-white p-4 border border-black/8 shadow-2xs">
                  <span className="text-xs text-zinc-500">Credits Remaining</span>
                  <p className="text-2xl font-bold text-zinc-900 mt-1">{creditsLeft}</p>
                  <span className="text-[11px] text-indigo-600 font-medium">Auto-scaling enabled</span>
                </div>
              </div>

              <div className="rounded-2xl bg-white p-4 border border-black/8 space-y-3">
                <h4 className="text-sm font-semibold text-zinc-900">Quick Cloud Actions</h4>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setView("database")}
                    className="flex items-center gap-2 rounded-xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
                  >
                    <Database className="size-4 text-blue-600" /> Manage Tables
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("payments")}
                    className="flex items-center gap-2 rounded-xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
                  >
                    <CreditCard className="size-4 text-indigo-600" /> Connect Payments
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenPublish();
                    }}
                    className="flex items-center gap-2 rounded-xl border border-zinc-200 p-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                  >
                    <Rocket className="size-4" /> Publish App
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("settings")}
                    className="flex items-center gap-2 rounded-xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
                  >
                    <Settings className="size-4 text-zinc-600" /> Project Settings
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ==================== SUBVIEW: DATABASE ==================== */}
          {view === "database" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-zinc-900">Cloud Database</h3>
                <p className="text-xs text-zinc-500">
                  Manage tables, schemas, and Row-Level Security (RLS) for {projectName}
                </p>
              </div>

              <div className="flex gap-2">
                <input
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                  placeholder="New table name (e.g. orders, comments)..."
                  className="flex-1 rounded-2xl border border-zinc-200 bg-white px-3.5 py-2.5 text-xs outline-none focus:border-zinc-900"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newTableName.trim()) return;
                    setDbTables((prev) => [
                      ...prev,
                      {
                        name: newTableName.trim().toLowerCase().replace(/\s+/g, "_"),
                        rows: 0,
                        rls: "Enabled",
                        updated: "Just now",
                      },
                    ]);
                    setNewTableName("");
                    toast.success("Created new database table!");
                  }}
                  className="flex items-center gap-1.5 rounded-2xl bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-zinc-800"
                >
                  <Plus className="size-3.5" /> Create Table
                </button>
              </div>

              <div className="divide-y divide-zinc-100 rounded-2xl bg-white border border-black/8 overflow-hidden">
                {dbTables.map((t, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <Database className="size-3.5 text-blue-600" />
                        <span className="text-sm font-semibold text-zinc-900 font-mono">{t.name}</span>
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                          RLS {t.rls}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        {t.rows} records · Updated {t.updated}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDbTables((prev) =>
                          prev.map((item, idx) => (idx === i ? { ...item, rows: item.rows + 1 } : item)),
                        );
                        toast.success(`Inserted sample row into "${t.name}"`);
                      }}
                      className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                    >
                      + Insert Row
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ==================== SUBVIEW: USERS & AUTH ==================== */}
          {view === "users" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-zinc-900">Users & Authentication</h3>
                <p className="text-xs text-zinc-500">
                  Manage user accounts, login providers, and access roles for {projectName}
                </p>
              </div>

              <div className="rounded-2xl bg-white p-4 border border-black/8 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-zinc-900">Email & Password Sign-Up</p>
                    <p className="text-[11px] text-zinc-500">Allow users to register and sign in</p>
                  </div>
                  <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                    Enabled
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-zinc-100 pt-3">
                  <div>
                    <p className="text-xs font-semibold text-zinc-900">Auto-Confirm User Emails</p>
                    <p className="text-[11px] text-zinc-500">Let users log in immediately without waiting</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRequireEmailConfirm((v) => !v)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold transition",
                      !requireEmailConfirm ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600",
                    )}
                  >
                    {!requireEmailConfirm ? "Auto-Confirm ON" : "Verification Required"}
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="Invite or add user email..."
                  className="flex-1 rounded-2xl border border-zinc-200 bg-white px-3.5 py-2.5 text-xs outline-none focus:border-zinc-900"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newUserEmail.trim()) return;
                    setAuthUsers((prev) => [
                      {
                        id: `usr_${Date.now()}`,
                        email: newUserEmail.trim(),
                        role: "Member",
                        provider: "Invited",
                        created: "Just now",
                      },
                      ...prev,
                    ]);
                    setNewUserEmail("");
                    toast.success("User added to project!");
                  }}
                  className="flex items-center gap-1.5 rounded-2xl bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-zinc-800"
                >
                  <Plus className="size-3.5" /> Add User
                </button>
              </div>

              <div className="divide-y divide-zinc-100 rounded-2xl bg-white border border-black/8 overflow-hidden">
                {authUsers.map((u) => (
                  <div key={u.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-xs font-semibold text-zinc-900">{u.email}</p>
                      <p className="text-[11px] text-zinc-500">
                        {u.provider} · Joined {u.created}
                      </p>
                    </div>
                    <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-semibold text-zinc-700">
                      {u.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ==================== SUBVIEW: STORAGE ==================== */}
          {view === "storage" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-zinc-900">Cloud Storage Buckets</h3>
                <p className="text-xs text-zinc-500">
                  Store user uploads, images, PDFs, and media assets
                </p>
              </div>

              <div className="flex gap-2">
                <input
                  value={newBucketName}
                  onChange={(e) => setNewBucketName(e.target.value)}
                  placeholder="New bucket name (e.g. invoices, uploads)..."
                  className="flex-1 rounded-2xl border border-zinc-200 bg-white px-3.5 py-2.5 text-xs outline-none focus:border-zinc-900"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newBucketName.trim()) return;
                    setBuckets((prev) => [
                      ...prev,
                      {
                        name: newBucketName.trim().toLowerCase().replace(/\s+/g, "-"),
                        access: "Public",
                        files: 0,
                        size: "0 KB",
                      },
                    ]);
                    setNewBucketName("");
                    toast.success("Created cloud storage bucket!");
                  }}
                  className="flex items-center gap-1.5 rounded-2xl bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-zinc-800"
                >
                  <Plus className="size-3.5" /> New Bucket
                </button>
              </div>

              <div className="divide-y divide-zinc-100 rounded-2xl bg-white border border-black/8 overflow-hidden">
                {buckets.map((b, idx) => (
                  <div key={idx} className="flex items-center justify-between px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <HardDrive className="size-4 text-zinc-700" />
                      <div>
                        <p className="text-sm font-semibold text-zinc-900">{b.name}</p>
                        <p className="text-[11px] text-zinc-500">
                          {b.files} files · {b.size}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-700">
                      {b.access}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ==================== SUBVIEW: AI ==================== */}
          {view === "ai" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-zinc-900">AI Models & Gateway</h3>
                <p className="text-xs text-zinc-500">
                  Configure AI capabilities, multimodal vision, and code generation for {projectName}
                </p>
              </div>

              <div className="rounded-2xl bg-white p-4 border border-black/8 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">My AI 1.1 Cloud Gateway</p>
                    <p className="text-xs text-zinc-500">
                      Zero-config LLM, Vision UI Replication & Unlimited Folder Architect
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAiGatewayEnabled((v) => !v)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold transition",
                      aiGatewayEnabled ? "bg-emerald-600 text-white" : "bg-zinc-200 text-zinc-700",
                    )}
                  >
                    {aiGatewayEnabled ? "Active" : "Paused"}
                  </button>
                </div>

                <div className="border-t border-zinc-100 pt-3 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Screenshot-to-Exact-UI Engine</span>
                    <span className="font-semibold text-emerald-700">Enabled (1:1 Match)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Multi-Folder Generation Authority</span>
                    <span className="font-semibold text-zinc-900">Unlimited Folders & Files</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">In-Place Code Editing</span>
                    <span className="font-semibold text-zinc-900">Active</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== SUBVIEW: PAYMENTS ==================== */}
          {view === "payments" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-zinc-900">Payment Gateways & Checkout</h3>
                <p className="text-xs text-zinc-500">
                  Connect Stripe, Razorpay, PayPal, or Apple/Google Pay to accept payments in {projectName}
                </p>
              </div>

              <div className="space-y-2.5">
                {PAYMENT_PROVIDERS.map((p) => {
                  const isConnected = Boolean(connectedPayments[p.id]);
                  const isConfiguring = activePaymentConfig === p.id;
                  return (
                    <div
                      key={p.id}
                      className="rounded-2xl bg-white border border-black/8 p-4 shadow-2xs space-y-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "flex size-10 shrink-0 items-center justify-center rounded-xl text-white font-bold text-sm",
                              p.color,
                            )}
                          >
                            {p.name.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-semibold text-zinc-900">{p.name}</h4>
                              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
                                {p.badge}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-500">{p.desc}</p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setActivePaymentConfig(isConfiguring ? null : p.id)
                          }
                          className={cn(
                            "shrink-0 rounded-xl px-3.5 py-2 text-xs font-semibold transition",
                            isConnected
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-zinc-900 text-white hover:bg-zinc-800",
                          )}
                        >
                          {isConnected ? "Connected ✓" : "Connect"}
                        </button>
                      </div>

                      {isConfiguring && (
                        <div className="border-t border-zinc-100 pt-3 space-y-2.5">
                          <label className="block text-[11px] font-semibold text-zinc-600">
                            {p.name} API / Secret Key ({p.keyPrefix})
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="password"
                              value={paymentKeys[p.id] || ""}
                              onChange={(e) =>
                                setPaymentKeys((prev) => ({ ...prev, [p.id]: e.target.value }))
                              }
                              placeholder={`Paste ${p.name} key (${p.keyPrefix})`}
                              className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-mono outline-none focus:border-zinc-900"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setConnectedPayments((prev) => ({ ...prev, [p.id]: true }));
                                setActivePaymentConfig(null);
                                toast.success(`${p.name} payment gateway connected to ${projectName}!`);
                              }}
                              className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                            >
                              Save & Enable
                            </button>
                          </div>
                          {isConnected && (
                            <button
                              type="button"
                              onClick={() => {
                                setConnectedPayments((prev) => ({ ...prev, [p.id]: false }));
                                setActivePaymentConfig(null);
                                toast.info(`Disconnected ${p.name}`);
                              }}
                              className="text-[11px] text-red-600 hover:underline"
                            >
                              Disconnect {p.name}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ==================== SUBVIEW: EMAIL ==================== */}
          {view === "email" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-zinc-900">Transactional Emails & SMTP</h3>
                <p className="text-xs text-zinc-500">
                  Configure welcome emails, OTP verification, receipts, and notifications
                </p>
              </div>

              <div className="space-y-2">
                {EMAIL_PROVIDERS.map((ep) => {
                  const active = connectedEmail === ep.id;
                  return (
                    <button
                      key={ep.id}
                      type="button"
                      onClick={() => {
                        setConnectedEmail(ep.id);
                        toast.success(`Switched email provider to ${ep.name}`);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between rounded-2xl border p-4 text-left transition",
                        active
                          ? "border-zinc-900 bg-white shadow-2xs"
                          : "border-black/8 bg-white/70 hover:bg-white",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Mail className="size-4 text-zinc-800" />
                        <div>
                          <p className="text-sm font-semibold text-zinc-900">{ep.name}</p>
                          <p className="text-xs text-zinc-500">{ep.domain}</p>
                        </div>
                      </div>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                          active ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600",
                        )}
                      >
                        {active ? "Active" : ep.status}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-2xl bg-white p-4 border border-black/8 space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Send Test Email
                </h4>
                <div className="flex gap-2">
                  <input
                    value={testRecipient}
                    onChange={(e) => setTestRecipient(e.target.value)}
                    placeholder="Enter recipient email address..."
                    className="flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-xs outline-none focus:border-zinc-900"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!testRecipient.trim()) {
                        toast.error("Enter an email address first");
                        return;
                      }
                      toast.success(`Test email dispatched to ${testRecipient.trim()}!`);
                      setTestRecipient("");
                    }}
                    className="rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
                  >
                    Send Test
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ==================== SUBVIEW: HISTORY (Code & Build History) ==================== */}
          {view === "history" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-zinc-900">Code & Build History</h3>
                <p className="text-xs text-zinc-500">
                  Switch between projects or delete projects from history
                </p>
              </div>

              <div className="space-y-2">
                {history.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-6 text-center">No project history yet.</p>
                ) : (
                  history.map((h) => {
                    const isCurrent = h.id === currentProjectId || h.name === projectName;
                    return (
                      <div
                        key={h.id}
                        className={cn(
                          "flex items-center justify-between gap-3 rounded-2xl border p-4 transition",
                          isCurrent ? "border-zinc-900 bg-white shadow-xs" : "border-black/8 bg-white",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            onSelectHistoryProject(h);
                            onClose();
                          }}
                          className="flex-1 text-left min-w-0"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-zinc-900 truncate">
                              {h.name}
                            </span>
                            {isCurrent && (
                              <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                                Current
                              </span>
                            )}
                            <span className="text-xs text-zinc-400">
                              · {h.files?.length || 0} files
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500 truncate mt-0.5">{h.idea}</p>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => onDeleteHistoryProject(h, e)}
                          className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-red-100 bg-red-50 text-red-600 hover:bg-red-100 transition"
                          title="Delete project"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ==================== SUBVIEW: SETTINGS ==================== */}
          {view === "settings" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-zinc-900">Project Settings</h3>
                <p className="text-xs text-zinc-500">
                  General metadata, visibility, environment secrets, and custom domain settings
                </p>
              </div>

              {/* General Info */}
              <div className="rounded-2xl bg-white p-4 border border-black/8 space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  General Information
                </h4>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Project Name
                  </label>
                  <input
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-900 outline-none focus:border-zinc-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Project Visibility
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setVisibility("public")}
                      className={cn(
                        "flex items-center justify-center gap-2 rounded-xl border py-2 text-xs font-semibold transition",
                        visibility === "public"
                          ? "border-zinc-900 bg-zinc-900 text-white"
                          : "border-zinc-200 text-zinc-700",
                      )}
                    >
                      <Globe className="size-3.5" /> Public App
                    </button>
                    <button
                      type="button"
                      onClick={() => setVisibility("private")}
                      className={cn(
                        "flex items-center justify-center gap-2 rounded-xl border py-2 text-xs font-semibold transition",
                        visibility === "private"
                          ? "border-zinc-900 bg-zinc-900 text-white"
                          : "border-zinc-200 text-zinc-700",
                      )}
                    >
                      <Lock className="size-3.5" /> Private Workspace
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSaveRename}
                  className="rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
                >
                  Save Project Settings
                </button>
              </div>

              {/* Environment Variables */}
              <div className="rounded-2xl bg-white p-4 border border-black/8 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Environment Variables & Secrets
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowSecrets((v) => !v)}
                    className="text-xs text-zinc-500 hover:text-zinc-900 flex items-center gap-1"
                  >
                    {showSecrets ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    <span>{showSecrets ? "Hide" : "Reveal"}</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {envVars.map((ev, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-2 rounded-xl bg-zinc-50 px-3 py-2 text-xs font-mono border border-zinc-200"
                    >
                      <span className="font-semibold text-zinc-900">{ev.key}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-500">
                          {showSecrets ? ev.value : "••••••••••••"}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setEnvVars((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="text-zinc-400 hover:text-red-600"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <input
                    value={newEnvKey}
                    onChange={(e) => setNewEnvKey(e.target.value)}
                    placeholder="KEY_NAME (e.g. STRIPE_KEY)"
                    className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-mono outline-none focus:border-zinc-900"
                  />
                  <div className="flex gap-2">
                    <input
                      value={newEnvVal}
                      onChange={(e) => setNewEnvVal(e.target.value)}
                      placeholder="Secret value..."
                      className="flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-xs font-mono outline-none focus:border-zinc-900"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!newEnvKey.trim()) return;
                        setEnvVars((prev) => [
                          ...prev,
                          { key: newEnvKey.trim().toUpperCase(), value: newEnvVal.trim() || "configured" },
                        ]);
                        setNewEnvKey("");
                        setNewEnvVal("");
                        toast.success("Added environment secret");
                      }}
                      className="rounded-xl bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
