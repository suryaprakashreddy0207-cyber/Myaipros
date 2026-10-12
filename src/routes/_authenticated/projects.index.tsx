import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import {
  ArrowLeft,
  Plus,
  Folder,
  Search,
  Users,
  ChevronRight,
  Database,
  Calendar,
} from "lucide-react";
import {
  fetchProjects,
  getLocalProjects,
  getCurrentUserId,
  type ProjectItem,
} from "@/lib/projects-store";

export const Route = createFileRoute("/_authenticated/projects/")({
  component: ProjectsIndexPage,
});

type TabType = "all" | "created" | "shared";

function ProjectsIndexPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [projects, setProjects] = useState<ProjectItem[]>(() => getLocalProjects());
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Initial fetch and merge
    fetchProjects().then((res) => {
      setProjects(res);
      setLoading(false);
    });

    // Listen to immediate custom event when project is created
    const onUpdated = (e: any) => {
      if (Array.isArray(e.detail)) {
        setProjects(e.detail);
      } else {
        setProjects(getLocalProjects());
      }
    };

    window.addEventListener("myaipro_projects_updated", onUpdated);
    window.addEventListener("focus", () => setProjects(getLocalProjects()));

    return () => {
      window.removeEventListener("myaipro_projects_updated", onUpdated);
    };
  }, []);

  const currentUserId = getCurrentUserId();

  const filteredProjects = useMemo(() => {
    let list = projects;
    if (activeTab === "created") {
      list = list.filter((p) => !p.isShared || p.userId === currentUserId || (p.sharedWith && p.sharedWith.length === 0));
    } else if (activeTab === "shared") {
      list = list.filter((p) => p.isShared && p.userId !== currentUserId);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [projects, activeTab, searchQuery, currentUserId]);

  return (
    <div className="flex min-h-[100dvh] w-full flex-col bg-black text-white font-sans">
      {/* Top Header */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between px-4 bg-black/95 backdrop-blur-md border-b border-neutral-900">
        <button
          onClick={() => navigate({ to: "/chat" })}
          className="flex size-10 items-center justify-center rounded-full bg-neutral-900 text-white hover:bg-neutral-800 transition active:scale-95"
          aria-label="Back to chat"
        >
          <ArrowLeft className="size-5" />
        </button>

        <h1 className="text-base font-semibold text-white">Projects</h1>

        <button
          onClick={() => navigate({ to: "/projects/new" })}
          className="flex size-10 items-center justify-center rounded-full bg-neutral-900 text-white hover:bg-neutral-800 transition active:scale-95"
          aria-label="New Project"
        >
          <Plus className="size-5" />
        </button>
      </header>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab("all")}
          className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
            activeTab === "all"
              ? "bg-[#2c2c2e] text-white"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          All
        </button>
        <button
          onClick={() => setActiveTab("created")}
          className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
            activeTab === "created"
              ? "bg-[#2c2c2e] text-white"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          Created by you
        </button>
        <button
          onClick={() => setActiveTab("shared")}
          className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
            activeTab === "shared"
              ? "bg-[#2c2c2e] text-white"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          Shared with you
        </button>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col px-4 py-6">
        {filteredProjects.length === 0 ? (
          /* Empty State matching screenshots 1, 2, 3 */
          <div className="my-auto flex flex-col items-center justify-center text-center px-4">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-[#1c1c1e] text-neutral-300 mb-4 shadow-inner">
              <Folder className="size-7" />
            </div>

            <h2 className="text-lg font-semibold text-white mb-1.5">
              {activeTab === "all"
                ? "Start your first project"
                : activeTab === "created"
                ? "No projects yet"
                : "No shared projects yet"}
            </h2>

            <p className="max-w-xs text-xs text-neutral-400 leading-relaxed mb-6">
              {activeTab === "all"
                ? "Projects help you organize chats, files, and tools in one place"
                : activeTab === "created"
                ? "Create a project to organize chats around a topic or sources."
                : "Projects shared with you will appear here."}
            </p>

            {activeTab !== "shared" ? (
              <button
                onClick={() => navigate({ to: "/projects/new" })}
                className="rounded-full bg-white px-6 py-2.5 text-xs font-semibold text-black hover:bg-neutral-200 transition shadow-lg active:scale-95"
              >
                New project
              </button>
            ) : null}
          </div>
        ) : (
          /* Projects List */
          <div className="space-y-2.5 max-w-2xl mx-auto w-full">
            {filteredProjects.map((project) => (
              <Link
                key={project.id}
                to="/projects/$projectId"
                params={{ projectId: project.id }}
                className="flex items-center justify-between rounded-2xl bg-[#1c1c1e] p-4 hover:bg-[#252528] transition border border-neutral-800/60 group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-neutral-800 text-neutral-200 group-hover:text-white transition">
                    <Folder className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-semibold text-white">
                        {project.title}
                      </h3>
                      {project.category && project.category !== "General" && (
                        <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-[10px] text-neutral-300 font-medium">
                          {project.category}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-neutral-400 mt-0.5">
                      {project.description ||
                        `${project.sources?.length || 0} source(s) connected`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-neutral-500 shrink-0 ml-2">
                  {project.sources && project.sources.length > 0 && (
                    <span className="flex items-center gap-1 text-[11px] text-neutral-400">
                      <Database className="size-3 text-neutral-400" />
                      {project.sources.length}
                    </span>
                  )}
                  {project.isShared && (
                    <Users className="size-3.5 text-neutral-400" />
                  )}
                  <ChevronRight className="size-4 group-hover:translate-x-0.5 transition" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* Bottom Search Bar matching screenshot */}
      <footer className="sticky bottom-0 z-20 px-4 pb-6 pt-2 bg-gradient-to-t from-black via-black to-transparent">
        <div className="relative mx-auto max-w-xl">
          <Search className="absolute left-4 top-3.5 size-4 text-neutral-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search"
            className="w-full rounded-full bg-[#1c1c1e] py-3 pl-11 pr-4 text-sm text-white placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-600 transition"
          />
        </div>
      </footer>
    </div>
  );
}
