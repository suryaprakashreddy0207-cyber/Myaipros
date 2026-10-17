import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthProvider, useFirebaseAuth } from "@/lib/auth-context";
import { getActiveUserSession } from "@/lib/user-session";
import { auth } from "@/lib/firebase";
import { Loader2, Sparkles, Lock } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  component: ProtectedRouteLayout,
});

function ProtectedContent() {
  const { isAuthenticated, loading, session } = useFirebaseAuth();
  const navigate = useNavigate();
  const location = useRouterState({ select: (s) => s.location.pathname });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || loading) return;

    // Fast synchronous check
    const hasActiveSession = Boolean(getActiveUserSession() || auth.currentUser || session);

    if (!hasActiveSession && !isAuthenticated) {
      // User is not authenticated -> redirect to /auth
      navigate({
        to: "/auth",
      });
    }
  }, [mounted, loading, isAuthenticated, session, navigate, location]);

  // While checking auth on initial mount without local session, display clean loading state
  const hasLocalSession = mounted && typeof window !== "undefined" && Boolean(getActiveUserSession() || auth.currentUser);

  if (loading && !hasLocalSession) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-[#0c0906] font-sans text-stone-100 select-none">
        <div className="relative flex flex-col items-center space-y-4">
          <div className="relative flex size-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-600 to-orange-500 shadow-[0_0_35px_rgba(245,158,11,0.5)] animate-pulse">
            <Sparkles className="size-7 fill-white text-white" />
          </div>
          <div className="flex items-center space-x-2 text-stone-300">
            <Loader2 className="size-4 animate-spin text-amber-400" />
            <span className="text-sm font-medium tracking-wide">
              Authenticating with My AI…
            </span>
          </div>
        </div>
      </div>
    );
  }

  return <Outlet />;
}

function ProtectedRouteLayout() {
  return (
    <AuthProvider>
      <ProtectedContent />
    </AuthProvider>
  );
}
