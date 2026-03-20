import { trpc } from "@/lib/trpc";
import { AuthProvider } from "@/contexts/AuthContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import App from "../App";
import { getImpersonationToken } from "../impersonation";

const queryClient = new QueryClient();

// 401 redirect is handled by AuthRefreshHandler (tries session refresh first, then redirects)
queryClient.getQueryCache().subscribe((event) => {
  if (event.type === "updated" && event.action.type === "error" && "query" in event) {
    console.error("[API Query Error]", event.query.state.error);
  }
});

queryClient.getMutationCache().subscribe((event) => {
  if (event.type === "updated" && event.action.type === "error" && "mutation" in event) {
    console.error("[API Mutation Error]", event.mutation.state.error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      headers() {
        const token = getImpersonationToken();
        return token ? { "x-impersonation": token } : {};
      },
      async fetch(input, init) {
        const headers = new Headers(init?.headers ?? {});
        const res = await globalThis.fetch(input, {
          ...(init ?? {}),
          headers,
          credentials: "include",
        });
        if (!res.ok) {
          const text = await res.clone().text();
          const looksLikeHtml =
            text.trim().startsWith("<") ||
            text.includes("A server error") ||
            (!text.trim().startsWith("{") && !text.trim().startsWith("["));
          if (looksLikeHtml) {
            throw new Error("We're having trouble signing you in. Please try again.");
          }
        }
        return res;
      },
    }),
  ],
});

/**
 * Root providers + App. Lazy-loaded so the main bundle stays minimal (Sentry, analytics, root only).
 */
export default function AppProviders() {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
