import { createFileRoute, Outlet } from "@tanstack/react-router";
import { auth } from "@/lib/firebase";
import { getActiveUserSession } from "@/lib/user-session";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: () => {
    // 1. Check active user session from our unified auth store
    if (typeof window !== "undefined") {
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

      // 2. Check if user is logged into Firebase
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

    // 3. Fallback guest session when browsing before explicit login
    let guestId = "guest-user";
    if (typeof window !== "undefined") {
      guestId =
        localStorage.getItem("myaipro_guest_id") ||
        `guest-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem("myaipro_guest_id", guestId);
    }
    return {
      user: {
        id: guestId,
        email: "guest@myaipro.app",
        isNewUser: false,
        user_metadata: {
          full_name: "Guest",
          avatar_url: null,
        },
      },
    };
  },
  component: () => <Outlet />,
});
