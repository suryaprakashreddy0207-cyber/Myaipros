import { createFileRoute, redirect, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({
      to: "/chat/$threadId",
      params: { threadId: "default" },
    });
  },
  component: () => <Navigate to="/chat/$threadId" params={{ threadId: "default" }} replace />,
});
