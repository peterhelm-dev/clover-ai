import { trpc } from "@/lib/trpc";
import { supabase } from "@/lib/supabaseClient";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { INVITE_CODE_STORAGE_KEY } from "./const";
import "./index.css";

// After a Supabase OAuth redirect, stash any pending invite code (passed
// through as a query param) so it can be sent as a header on the first
// authenticated request, then strip it from the visible URL.
(() => {
  const params = new URLSearchParams(window.location.search);
  const inviteCode = params.get("inviteCode");
  if (!inviteCode) return;

  localStorage.setItem(INVITE_CODE_STORAGE_KEY, inviteCode);
  params.delete("inviteCode");
  const newSearch = params.toString();
  window.history.replaceState(
    {},
    "",
    window.location.pathname + (newSearch ? `?${newSearch}` : "") + window.location.hash
  );
})();

const queryClient = new QueryClient();

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  // "/login" — the in-app sign-in screen, not a direct jump to GitHub.
  window.location.href = "/login";
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      async headers() {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        const inviteCode = localStorage.getItem(INVITE_CODE_STORAGE_KEY);

        const headers: Record<string, string> = {};
        if (token) headers.authorization = `Bearer ${token}`;
        if (inviteCode) headers["x-invite-code"] = inviteCode;
        return headers;
      },
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
