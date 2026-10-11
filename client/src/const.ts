export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/** Where a pending beta-invite code is stashed between the OAuth redirect and the first authenticated request. */
export const INVITE_CODE_STORAGE_KEY = "clover-farm-invite-code";

/** Only same-site paths ("/beta/abc"), never "//evil.com" or absolute URLs. */
export const safeReturnPath = (path: string | null | undefined): string =>
  path && path.startsWith("/") && !path.startsWith("//") ? path : "/";

/** Where Supabase sends the user back after OAuth or an emailed sign-in link. */
export const getAuthRedirectUrl = (returnPath?: string, inviteCode?: string | null) => {
  const redirectTarget = new URL(safeReturnPath(returnPath), window.location.origin);
  if (inviteCode) {
    redirectTarget.searchParams.set("inviteCode", inviteCode);
  }
  return redirectTarget.toString();
};

// Builds a Supabase Auth (GitHub OAuth) sign-in URL. Kept synchronous/URL-based
// (rather than calling supabase.auth.signInWithOAuth directly) so it can be
// used as both a plain <a href> and a window.location.href redirect target.
export const getLoginUrl = (returnPath?: string, inviteCode?: string | null) => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  const url = new URL("/auth/v1/authorize", supabaseUrl);
  url.searchParams.set("provider", "github");
  url.searchParams.set("redirect_to", getAuthRedirectUrl(returnPath, inviteCode));

  return url.toString();
};

/** The /login screen (email link, GitHub or guest), returning to `returnPath` afterwards. */
export const getSignInPageUrl = (returnPath?: string, inviteCode?: string) => {
  const params = new URLSearchParams();
  if (returnPath) params.set("next", safeReturnPath(returnPath));
  if (inviteCode) params.set("inviteCode", inviteCode);
  const query = params.toString();
  return query ? `/login?${query}` : "/login";
};
