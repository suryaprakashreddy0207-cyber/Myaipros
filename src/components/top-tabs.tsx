import { Link } from "@tanstack/react-router";
import { MessageSquare, Folder, Mic, Blocks, Telescope, Presentation, Bot } from "lucide-react";

const TABS = [
  { to: "/chat", label: "AI chat", icon: MessageSquare },
  { to: "/projects", label: "Projects", icon: Folder },
  { to: "/voice", label: "Voice Assistant", icon: Mic },
  { to: "/build", label: "No-code", icon: Blocks },
  { to: "/research", label: "Research", icon: Telescope },
  { to: "/presentations", label: "Slides", icon: Presentation },
  { to: "/agent", label: "Agent", icon: Bot },
] as const;

export function TopTabs() {
  return (
    <nav className="scrollbar-none flex shrink-0 gap-1 overflow-x-auto border-b border-black/5 px-3 py-2">
      {TABS.map((t) => (
        <Link
          key={t.to}
          to={t.to}
          className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-surface"
          activeProps={{ className: "bg-ink !text-white hover:bg-ink" }}
        >
          <t.icon className="size-3.5" />
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
