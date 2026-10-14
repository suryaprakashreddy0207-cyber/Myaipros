import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { auth } from "@/lib/firebase";
import { getActiveUserSession } from "@/lib/user-session";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: () => {
    if (typeof window !== "undefined") {
      // 1. Check active session from storage
      const activeSession = getActiveUserSession();
      if (activeSession) {
        return {
          user: {
            id: activeSession.uid,
            email: activeSession.email,
            isNewUser: activeSession.isNewUser,
            user_metadata: {
              full_name: activeSession.displayName,
              avatar_url: activeSession.photoURL || null,
            },
          },
        };
      }

      // 2. Check Firebase auth currentUser
      if (auth.currentUser) {
        return {
          user: {
            id: auth.currentUser.uid,
            email: auth.currentUser.email || "user@myaipro.app",
            isNewUser: false,
            user_metadata: {
              full_name:
                auth.currentUser.displayName ||
                auth.currentUser.email?.split("@")[0] ||
                "User",
              avatar_url: auth.currentUser.photoURL,
            },
          },
        };
      }
    }

    // Without logging in, they cannot chat with the user -> redirect to /auth
    throw redirect({ to: "/auth" });
  },
  component: () => <Outlet />,
});
