import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  nitro: {
    preset: "node-server",
  },
  vite: {
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@google/genai",
        "@supabase/supabase-js",
        "@tanstack/react-query",
        "@tanstack/react-router",
        "@tanstack/react-store",
        "clsx",
        "firebase/app",
        "firebase/auth",
        "firebase/firestore",
        "jszip",
        "lucide-react",
        "pptxgenjs",
        "react-markdown",
        "sonner",
        "tailwind-merge",
        "zod",
      ],
      ignoreOutdatedRequests: true,
    },
    server: {
      host: "0.0.0.0",
      port: 3000,
      hmr: process.env.DISABLE_HMR !== "true",
      watch: process.env.DISABLE_HMR === "true" ? null : {},
    },
    build: {
      rollupOptions: {
        onwarn(warning, warn) {
          if (
            warning.code === "MODULE_LEVEL_DIRECTIVE" ||
            warning.message?.includes("use client")
          ) {
            return;
          }
          warn(warning);
        },
      },
    },
  },
});
