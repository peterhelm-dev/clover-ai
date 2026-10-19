export const ENV = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  /** Any account with this email gets admin + unlimited AI, regardless of login provider. */
  ownerEmail: process.env.OWNER_EMAIL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  supabaseStorageBucket: process.env.SUPABASE_STORAGE_BUCKET ?? "food-photos",
  /** Transactional email (beta program). Without a key, emails are logged instead of sent. */
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "Clover <onboarding@resend.dev>",
  /** Public site URL used in email links. */
  appUrl: (process.env.APP_URL ?? "https://clover-ai.up.railway.app").replace(/\/+$/, ""),
  /** Signs one-click email unsubscribe links. */
  emailLinkSecret: process.env.EMAIL_LINK_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  /**
   * Footer link for logged-out visitors (mailto: or https:). The placeholder
   * is intentional until the owner sets PUBLIC_FEEDBACK_URL.
   */
  publicFeedbackUrl: resolvePublicFeedbackUrl(process.env.PUBLIC_FEEDBACK_URL),
};

function resolvePublicFeedbackUrl(raw: string | undefined): string {
  const fallback = "mailto:feedback@example.com";
  const value = raw?.trim();
  if (!value || /[\u0000-\u001F\u007F]/.test(value)) return fallback;
  if (value.startsWith("mailto:") && value.length > "mailto:".length && value.length <= 320) {
    return value;
  }
  try {
    const url = new URL(value);
    if (url.protocol === "https:" || url.protocol === "http:") return value;
  } catch {
    /* not a URL */
  }
  return fallback;
}
