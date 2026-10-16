import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { getActiveUserSession } from "@/lib/user-session";
import { auth } from "@/lib/firebase";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

function IndexPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const hasSession = Boolean(getActiveUserSession() || auth.currentUser);
    if (hasSession) {
      navigate({
        to: "/chat/$threadId",
        params: { threadId: "default" },
      });
    } else {
      navigate({ to: "/auth" });
    }
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0c0906] text-stone-300">
      <Loader2 className="size-6 animate-spin text-amber-500" />
    </div>
  );
}
