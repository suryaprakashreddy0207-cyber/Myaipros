import {
  createFileRoute,
  Outlet,
  useNavigate,
  useRouterState,
  Link,
  useParams,
} from "@tanstack/react-router";
import { useEffect, useRef, useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import {
  listThreads,
  createThread,
  deleteThread,
  clearThread,
} from "@/lib/chat.functions";
import {
  getLocalThreads,
  saveLocalThreads,
  deleteLocalThread,
  saveLocalMessages,
  formatHistoryDate,
  type LocalThread,
} from "@/lib/chat-store";
import {
  getActiveUserSession,
  clearActiveUserSession,
  type AppUserSession,
} from "@/lib/user-session";
import { disconnectGoogleWorkspace } from "@/lib/google-auth";
import {
  Plus,
  Menu,
  LogOut,
  Trash2,
  X,
  Mic,
  Presentation,
  Blocks,
  Telescope,
  Bot,
  MoreVertical,
  History,
  RotateCcw,
  Search,
  MessageSquare,
  Sparkles,
  Share2,
  Folder,
  FolderPlus,
  Home,
  LogIn,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/chat")({
  component: ChatLayout,
});

function ChatLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const location = useRouterState({ select: (s) => s.location.pathname });

  // Extract active threadId from path (e.g. /chat/abc-123 -> abc-123)
  const activeThreadId = useMemo(() => {
    const parts = location.split("/");
    const idx = parts.indexOf("chat");
    return idx !== -1 && parts[idx + 1] ? parts[idx + 1] : "default";
  }, [location]);

  const listFn = useServerFn(listThreads);
  const createFn = useServerFn(createThread);
  const deleteFn = useServerFn(deleteThread);
  const clearFn = useServerFn(clearThread);

  const { data: serverThreads = [] } = useQuery({
    queryKey: ["threads"],
    queryFn: async () => {
      try {
        return (await listFn()) || [];
      } catch {
        return [];
      }
    },
    retry: false,
  });

  const [localThreadsState, setLocalThreadsState] = useState<LocalThread[]>([]);
  const [activeUser, setActiveUser] = useState<AppUserSession | null>(null);
  const [mounted, setMounted] = useState(false);

  // Load and sync local threads after mount and when user logs in/out
  useEffect(() => {
    setMounted(true);
    function syncForUser() {
      const sess = getActiveUserSession();
      setActiveUser(sess);
      const stored = getLocalThreads();
      setLocalThreadsState(stored);
    }
    syncForUser();
    window.addEventListener("myaipro_auth_changed", syncForUser);
    return () => window.removeEventListener("myaipro_auth_changed", syncForUser);
  }, [location]);

  // Merge server and local threads into a deduplicated list (only merge server threads for returning users)
  const allThreads = useMemo(() => {
    const map = new Map<string, LocalThread>();

    // Add user-scoped local threads first
    for (const lt of localThreadsState) {
      if (lt.id && lt.id !== "default") {
        map.set(lt.id, lt);
      }
    }

    // Only merge server threads if the user is NOT a brand-new user with empty history
    if (!activeUser?.isNewUser) {
      const safeServerThreads = Array.isArray(serverThreads) ? serverThreads : [];
      for (const st of safeServerThreads) {
        if (st.id && st.id !== "default") {
          const existing = map.get(st.id);
          if (existing || !activeUser) {
            map.set(st.id, {
              id: st.id,
              title:
                existing?.title && existing.title !== "New conversation"
                  ? existing.title
                  : st.title || "New conversation",
              first_prompt: existing?.first_prompt || "",
              last_message: st.last_message || existing?.last_message || "",
              updated_at:
                st.updated_at || existing?.updated_at || new Date().toISOString(),
              created_at:
                st.created_at || existing?.created_at || new Date().toISOString(),
              message_count: existing?.message_count || 0,
            });
          }
        }
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );
  }, [serverThreads, localThreadsState, activeUser]);

  // Save merged threads
  useEffect(() => {
    if (allThreads.length > 0) {
      saveLocalThreads(allThreads);
    }
  }, [allThreads]);

  // Close 3-dots menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  const createMut = useMutation({
    mutationFn: (customTitle?: string) =>
      createFn({ data: { title: customTitle || "New conversation" } }),
    onSuccess: (t: any) => {
      qc.invalidateQueries({ queryKey: ["threads"] });
      setDrawerOpen(false);
      setMenuOpen(false);
      toast.success("New chat started");
      navigate({ to: "/chat/$threadId", params: { threadId: t.id } });
    },
    onError: () => {
      // Fallback local creation
      const newId = `local-${Date.now()}`;
      const newTh: LocalThread = {
        id: newId,
        title: "New conversation",
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      setLocalThreadsState((prev) => [newTh, ...prev]);
      saveLocalThreads([newTh, ...localThreadsState]);
      setDrawerOpen(false);
      setMenuOpen(false);
      navigate({ to: "/chat/$threadId", params: { threadId: newId } });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: (_r, id) => {
      deleteLocalThread(id);
      setLocalThreadsState((prev) => prev.filter((t) => t.id !== id));
      qc.invalidateQueries({ queryKey: ["threads"] });
      toast.success("Conversation deleted");
      if (activeThreadId === id) {
        navigate({ to: "/chat/$threadId", params: { threadId: "default" } });
      }
    },
    onError: (_e, id) => {
      deleteLocalThread(id);
      setLocalThreadsState((prev) => prev.filter((t) => t.id !== id));
      if (activeThreadId === id) {
        navigate({ to: "/chat/$threadId", params: { threadId: "default" } });
      }
    },
  });

  const clearMut = useMutation({
    mutationFn: async (id: string) => {
      saveLocalMessages(id, []);
      try {
        await clearFn({ data: { id } });
      } catch {
        // local clear still succeeds
      }
      return id;
    },
    onSuccess: (_r, id) => {
      qc.invalidateQueries({ queryKey: ["messages", id] });
      window.dispatchEvent(new CustomEvent("myaipro_chat_cleared", { detail: id }));
      toast.success("Chat messages cleared");
      setMenuOpen(false);
    },
    onError: (_e, id) => {
      saveLocalMessages(id, []);
      window.dispatchEvent(new CustomEvent("myaipro_chat_cleared", { detail: id }));
      toast.success("Chat messages cleared");
      setMenuOpen(false);
    },
  });

  // Group threads for History: Today, Yesterday, Previous 7 Days, Older
  const groupedThreads = useMemo(() => {
    const filtered = allThreads.filter((t) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        t.title.toLowerCase().includes(q) ||
        (t.last_message && t.last_message.toLowerCase().includes(q))
      );
    });

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - 86400000;
    const sevenDaysAgo = today - 7 * 86400000;

    const groups: {
      today: LocalThread[];
      yesterday: LocalThread[];
      pastWeek: LocalThread[];
      older: LocalThread[];
    } = {
      today: [],
      yesterday: [],
      pastWeek: [],
      older: [],
    };

    for (const t of filtered) {
      const time = new Date(t.updated_at).getTime();
      if (time >= today) {
        groups.today.push(t);
      } else if (time >= yesterday) {
        groups.yesterday.push(t);
      } else if (time >= sevenDaysAgo) {
        groups.pastWeek.push(t);
      } else {
        groups.older.push(t);
      }
    }

    return groups;
  }, [allThreads, searchQuery]);

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    clearActiveUserSession();
    disconnectGoogleWorkspace();
    try {
      await signOut(auth);
    } catch {
      // ignore
    }
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    toast.success("Signed out of your account");
    navigate({ to: "/auth", replace: true });
  }

  function handleShareCurrent() {
    setMenuOpen(false);
    if (typeof window !== "undefined") {
      navigator.clipboard?.writeText(window.location.href);
      toast.success("Chat link copied to clipboard");
    }
  }

  const currentThread = allThreads.find((t) => t.id === activeThreadId);

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-canvas font-sans text-ink">
      {/* Drawer backdrop */}
      <div
        onClick={() => setDrawerOpen(false)}
        className={cn(
          "fixed inset-0 z-40 bg-ink/25 backdrop-blur-sm transition-opacity duration-300",
          drawerOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      {/* History & Navigation Drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[88%] max-w-[340px] flex-col bg-surface border-r border-border/70 shadow-2xl transition-transform duration-300 ease-out",
          drawerOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-foreground font-serif font-bold text-base shadow-sm">
              M
            </div>
            <div className="min-w-0">
              <h2 className="font-serif text-lg font-semibold text-ink leading-tight">My AI Pro</h2>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                <History className="size-3 shrink-0" />
                <span className="truncate">
                  {activeUser ? activeUser.email : "Chat History"}
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-ink hover:bg-canvas transition"
            aria-label="Close drawer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* New Chat Primary Button */}
        <div className="p-3">
          <button
            onClick={() => createMut.mutate()}
            disabled={createMut.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-2.5 px-4 text-sm font-medium text-brand-foreground shadow-sm hover:opacity-95 active:scale-[0.98] transition disabled:opacity-60"
          >
            <Plus className="size-4 stroke-[2.5]" /> Start New Chat
          </button>
        </div>

        {/* Search History */}
        <div className="px-3 pb-2">
          <div className="relative flex items-center">
            <Search className="absolute left-3 size-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chat history..."
              className="w-full rounded-lg bg-canvas py-1.5 pl-8 pr-3 text-xs text-ink placeholder:text-muted-foreground/80 border border-border/60 focus:border-brand focus:outline-none transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 text-muted-foreground hover:text-ink p-0.5"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        </div>

        {/* History Feed organized by Time */}
        <nav className="flex-1 overflow-y-auto px-2 py-1 space-y-4">
          {allThreads.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <MessageSquare className="size-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-xs font-medium text-ink">No conversations saved yet</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Every chat you start and finish is preserved here automatically.
              </p>
            </div>
          ) : null}

          {/* Today */}
          {groupedThreads.today.length > 0 && (
            <div>
              <div className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Today
              </div>
              <ul className="space-y-1">
                {groupedThreads.today.map((t) => (
                  <ThreadItem
                    key={t.id}
                    thread={t}
                    mounted={mounted}
                    active={location.includes(t.id)}
                    onSelect={() => setDrawerOpen(false)}
                    onDelete={() => deleteMut.mutate(t.id)}
                  />
                ))}
              </ul>
            </div>
          )}

          {/* Yesterday */}
          {groupedThreads.yesterday.length > 0 && (
            <div>
              <div className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Yesterday
              </div>
              <ul className="space-y-1">
                {groupedThreads.yesterday.map((t) => (
                  <ThreadItem
                    key={t.id}
                    thread={t}
                    mounted={mounted}
                    active={location.includes(t.id)}
                    onSelect={() => setDrawerOpen(false)}
                    onDelete={() => deleteMut.mutate(t.id)}
                  />
                ))}
              </ul>
            </div>
          )}

          {/* Past 7 Days */}
          {groupedThreads.pastWeek.length > 0 && (
            <div>
              <div className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Previous 7 Days
              </div>
              <ul className="space-y-1">
                {groupedThreads.pastWeek.map((t) => (
                  <ThreadItem
                    key={t.id}
                    thread={t}
                    mounted={mounted}
                    active={location.includes(t.id)}
                    onSelect={() => setDrawerOpen(false)}
                    onDelete={() => deleteMut.mutate(t.id)}
                  />
                ))}
              </ul>
            </div>
          )}

          {/* Older */}
          {groupedThreads.older.length > 0 && (
            <div>
              <div className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Older History
              </div>
              <ul className="space-y-1">
                {groupedThreads.older.map((t) => (
                  <ThreadItem
                    key={t.id}
                    thread={t}
                    mounted={mounted}
                    active={location.includes(t.id)}
                    onSelect={() => setDrawerOpen(false)}
                    onDelete={() => deleteMut.mutate(t.id)}
                  />
                ))}
              </ul>
            </div>
          )}
        </nav>

        {/* App Switcher & Sign Out */}
        <div className="border-t border-border/60 p-2.5 space-y-0.5 bg-canvas/40">
          <button
            onClick={() => {
              setDrawerOpen(false);
              navigate({ to: "/chat/$threadId", params: { threadId: "default" } });
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-canvas transition text-left"
          >
            <Home className="size-3.5 text-brand" /> Home
          </button>

          <Link
            to="/presentations"
            onClick={() => setDrawerOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs text-ink hover:bg-canvas transition"
          >
            <Presentation className="size-3.5 text-muted-foreground" /> Presentations
          </Link>
          <Link
            to="/build"
            onClick={() => setDrawerOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs text-ink hover:bg-canvas transition"
          >
            <Blocks className="size-3.5 text-muted-foreground" /> No-code platform
          </Link>
          <Link
            to="/research"
            onClick={() => setDrawerOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs text-ink hover:bg-canvas transition"
          >
            <Telescope className="size-3.5 text-muted-foreground" /> Deep Research
          </Link>
          <Link
            to="/agent"
            onClick={() => setDrawerOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs text-ink hover:bg-canvas transition"
          >
            <Bot className="size-3.5 text-muted-foreground" /> My AI Cowork
          </Link>
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition"
          >
            <LogOut className="size-3.5" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main Top Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/60 bg-canvas/90 backdrop-blur-md px-3 sm:px-4 z-30">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-1.5 rounded-lg p-2 text-muted-foreground hover:bg-surface hover:text-ink transition active:scale-95"
            aria-label="Open History Menu"
            title="Chat History"
          >
            <Menu className="size-5" />
            <span className="hidden sm:inline text-xs font-medium text-muted-foreground">History</span>
          </button>

          <button
            onClick={() => {
              navigate({ to: "/chat/$threadId", params: { threadId: "default" } });
            }}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition active:scale-95",
              activeThreadId === "default"
                ? "bg-brand/10 text-brand font-semibold"
                : "text-muted-foreground hover:bg-surface hover:text-ink"
            )}
            aria-label="Home Screen"
            title="Home Screen"
          >
            <Home className="size-4" />
            <span className="hidden sm:inline">Home</span>
          </button>

          <Link
            to="/chat/$threadId"
            params={{ threadId: "default" }}
            className="flex items-center gap-2 pl-1 hover:opacity-85 transition"
            title="Go to Home Screen"
          >
            <h1 className="font-serif text-lg font-bold tracking-tight text-ink flex items-center gap-1.5 cursor-pointer">
              <span>My AI</span>
              <span className="inline-flex items-center rounded-full bg-brand/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand">
                1.1
              </span>
            </h1>
          </Link>
          {currentThread && currentThread.title && currentThread.title !== "New conversation" ? (
            <span className="hidden md:inline-block max-w-[240px] truncate text-xs text-muted-foreground/80 border-l border-border/80 pl-2">
              {currentThread.title}
            </span>
          ) : null}
        </div>

        {/* Header Right Actions: New Chat + Sign In / Account + Three Dots Menu */}
        <div className="flex items-center gap-1.5">
          {/* Quick New Chat button */}
          <button
            onClick={() => createMut.mutate()}
            disabled={createMut.isPending}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium bg-brand/10 text-brand hover:bg-brand/20 active:scale-95 transition disabled:opacity-60 cursor-pointer"
            title="Start New Chat (saves current)"
          >
            <Plus className="size-4" />
            <span className="hidden xs:inline">New chat</span>
          </button>

          {/* User Sign In / Account Badge */}
          {activeUser ? (
            <Link
              to="/auth"
              className="flex items-center gap-1.5 rounded-lg border border-border/80 bg-surface/80 px-2 py-1 text-xs text-ink hover:bg-surface transition"
              title={`Signed in as ${activeUser.displayName || activeUser.email}`}
            >
              <div className="flex size-5 items-center justify-center rounded-full bg-brand text-brand-foreground text-[10px] font-bold">
                {activeUser.displayName ? activeUser.displayName.charAt(0).toUpperCase() : activeUser.email.charAt(0).toUpperCase()}
              </div>
              <span className="hidden md:inline max-w-[80px] truncate font-medium">
                {activeUser.displayName || activeUser.email.split("@")[0]}
              </span>
            </Link>
          ) : (
            <Link
              to="/auth"
              className="flex items-center gap-1.5 rounded-lg border border-brand/40 bg-brand/10 px-2.5 py-1.5 text-xs font-semibold text-brand hover:bg-brand/20 active:scale-95 transition"
              title="Sign in or register to sync your chats"
            >
              <LogIn className="size-3.5" />
              <span>Sign in</span>
            </Link>
          )}

          {/* Three Dots Menu Button */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className={cn(
                "rounded-lg p-2 text-muted-foreground hover:bg-surface hover:text-ink active:scale-95 transition",
                menuOpen && "bg-surface text-ink",
              )}
              aria-label="More options"
              title="More options"
            >
              <MoreVertical className="size-5" />
            </button>

            {/* Three Dots Dropdown Menu */}
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-60 rounded-xl border border-border/80 bg-surface p-1.5 shadow-xl ring-1 ring-black/5 z-50 animate-in fade-in zoom-in-95 duration-150">
                {activeUser ? (
                  <div className="px-3 py-2 text-xs border-b border-border/60 mb-1">
                    <div className="font-semibold text-ink truncate">{activeUser.displayName || "My AI User"}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{activeUser.email}</div>
                  </div>
                ) : (
                  <>
                    <Link
                      to="/auth"
                      onClick={() => setMenuOpen(false)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-brand hover:bg-brand/10 transition text-left"
                    >
                      <LogIn className="size-4 text-brand" />
                      <div>
                        <div>Sign In / Register</div>
                        <div className="text-[10px] text-muted-foreground font-normal">
                          Sync chats & history across devices
                        </div>
                      </div>
                    </Link>
                    <div className="my-1 border-t border-border/60" />
                  </>
                )}

                <button
                  onClick={() => {
                    setMenuOpen(false);
                    navigate({ to: "/projects/new" });
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-ink hover:bg-brand/10 hover:text-brand transition text-left"
                >
                  <FolderPlus className="size-4 text-brand" />
                  <div>
                    <div className="font-semibold">Create a project</div>
                    <div className="text-[10px] text-muted-foreground font-normal">
                      Organize chats, files & sources
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setMenuOpen(false);
                    navigate({ to: "/voice" });
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-ink hover:bg-brand/10 hover:text-brand transition text-left"
                >
                  <Mic className="size-4 text-brand" />
                  <div>
                    <div className="font-semibold">Voice assistant</div>
                    <div className="text-[10px] text-muted-foreground font-normal">
                      Voice recording & live assistant
                    </div>
                  </div>
                </button>

                <div className="my-1 border-t border-border/60" />

                <button
                  onClick={() => {
                    setMenuOpen(false);
                    navigate({ to: "/projects" });
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-ink hover:bg-canvas transition text-left"
                >
                  <Folder className="size-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">Projects</div>
                    <div className="text-[10px] text-muted-foreground font-normal">
                      All, created & shared projects
                    </div>
                  </div>
                </button>

                <div className="my-1 border-t border-border/60" />

                <button
                  onClick={() => {
                    setMenuOpen(false);
                    createMut.mutate();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-ink hover:bg-brand/10 hover:text-brand transition text-left"
                >
                  <Plus className="size-4 text-brand" />
                  <div>
                    <div className="font-semibold">New chat</div>
                    <div className="text-[10px] text-muted-foreground font-normal">
                      Saves old chat in history
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setDrawerOpen(true);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-ink hover:bg-canvas transition text-left"
                >
                  <History className="size-4 text-muted-foreground" />
                  <div>
                    <div>Chat history</div>
                    <div className="text-[10px] text-muted-foreground font-normal">
                      View all saved conversations
                    </div>
                  </div>
                </button>

                <button
                  onClick={handleShareCurrent}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-ink hover:bg-canvas transition text-left"
                >
                  <Share2 className="size-4 text-muted-foreground" />
                  <span>Share conversation</span>
                </button>

                <div className="my-1 border-t border-border/60" />

                <button
                  onClick={() => {
                    if (confirm("Clear all messages in this conversation?")) {
                      clearMut.mutate(activeThreadId);
                    }
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-ink hover:bg-canvas transition text-left cursor-pointer"
                >
                  <RotateCcw className="size-4 text-muted-foreground" />
                  <span>Clear messages</span>
                </button>

                {activeThreadId && activeThreadId !== "default" && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      if (confirm("Delete this conversation from history?")) {
                        deleteMut.mutate(activeThreadId);
                      }
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 transition text-left cursor-pointer"
                  >
                    <Trash2 className="size-4" />
                    <span>Delete conversation</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Chat Screen Outlet */}
      <Outlet />


    </div>
  );
}

/** Individual thread item in the History drawer with start name & end preview */
function ThreadItem({
  thread,
  active,
  mounted,
  onSelect,
  onDelete,
}: {
  thread: LocalThread;
  active: boolean;
  mounted: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="group relative flex items-center rounded-xl transition">
      <Link
        to="/chat/$threadId"
        params={{ threadId: thread.id }}
        onClick={onSelect}
        className={cn(
          "flex-1 min-w-0 rounded-xl px-3 py-2 text-left transition",
          active
            ? "bg-brand/10 text-ink ring-1 ring-brand/30"
            : "text-muted-foreground hover:bg-canvas hover:text-ink",
        )}
      >
        <div className="flex items-center justify-between gap-1 mb-0.5">
          {/* What they started with at first (Title) */}
          <span className="truncate text-xs font-semibold text-ink">
            {thread.title || "Conversation"}
          </span>
          <span className="shrink-0 text-[10px] text-muted-foreground/75">
            {mounted ? formatHistoryDate(thread.updated_at) : ""}
          </span>
        </div>

        {/* What they ended full today (Ending preview) */}
        {thread.last_message ? (
          <p className="truncate text-[11px] text-muted-foreground/85 font-normal">
            {thread.last_message.replace(/^[#\s*]+/, "")}
          </p>
        ) : (
          <p className="text-[11px] text-muted-foreground/50 italic">Empty chat</p>
        )}
      </Link>

      {/* Quick delete on hover */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (confirm("Delete this conversation from history?")) {
            onDelete();
          }
        }}
        className="absolute right-2 opacity-0 group-hover:opacity-100 p-1 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition"
        title="Delete"
        aria-label="Delete chat"
      >
        <Trash2 className="size-3.5" />
      </button>
    </li>
  );
}
