import { createFileRoute, redirect } from "@tanstack/react-router";
import { getActiveUserSession } from "@/lib/user-session";
import { auth } from "@/lib/firebase";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    const hasSession = (typeof window !== "undefined") && (getActiveUserSession() || auth.currentUser);
    if (!hasSession) {
      throw redirect({ to: "/auth" });
    }
    throw redirect({
      to: "/chat/$threadId",
      params: { threadId: "default" },
    });
  },
  component: () => null,
});
