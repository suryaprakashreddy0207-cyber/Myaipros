import { createStart, createMiddleware } from "@tanstack/react-start";
import { isRedirect, isNotFound } from "@tanstack/react-router";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error: any) {
    // Never intercept redirects, not-founds, HTTP responses, or aborts
    if (
      isRedirect(error) ||
      isNotFound(error) ||
      error instanceof Response ||
      (error != null &&
        typeof error === "object" &&
        ("statusCode" in error || "status" in error || "options" in error)) ||
      error?.name === "AbortError"
    ) {
      throw error;
    }
    console.error("Server request error:", error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware],
}));
