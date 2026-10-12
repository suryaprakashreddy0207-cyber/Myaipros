import { createFileRoute, Outlet } from "@tanstack/react-router";
import { auth } from "@/lib/firebase";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: () => {
    // Check if user is logged into Firebase
    if (typeof window !== "undefined" && auth.currentUser) {
      return {
        user: {
          id: auth.currentUser.uid,
          email: auth.currentUser.email,
          user_metadata: {
            full_name: auth.currentUser.displayName,
            avatar_url: auth.currentUser.photoURL,
          },
        },
      };
    }

    // Immediate fallback so page always renders without blocking
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
        user_metadata: {
          full_name: "Guest",
          avatar_url: null,
        },
      },
    };
  },
  component: () => <Outlet />,
});
