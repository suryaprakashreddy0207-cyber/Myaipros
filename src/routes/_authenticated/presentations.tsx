import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/presentations")({
  component: () => <Outlet />,
});
