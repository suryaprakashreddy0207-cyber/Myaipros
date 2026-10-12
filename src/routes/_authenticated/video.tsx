import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/video")({
  component: VideoRedirect,
});

function VideoRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate({ to: "/voice", replace: true });
  }, [navigate]);

  return (
    <div className="flex h-screen items-center justify-center bg-canvas text-xs text-muted-foreground">
      Redirecting to Voice Assistant…
    </div>
  );
}
