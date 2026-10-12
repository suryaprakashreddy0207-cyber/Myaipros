import { createFileRoute } from "@tanstack/react-router";
import { AgentCoworkPage } from "./agent";

export const Route = createFileRoute("/_authenticated/cowork")({
  head: () => ({
    meta: [
      { title: "My AI Cowork — Autonomous Device & Code Coworker" },
      { name: "description", content: "Autonomous coworker running on your mobile or laptop with autonomous cursor and multitasking." },
    ],
  }),
  component: AgentCoworkPage,
});
