import type { RequestHandler } from "express";

/** Canonical public origin. Railway's APP_URL overrides this when set. */
export const PUBLIC_APP_URL = "https://getclover.app";

/**
 * Hostnames that used to be the public site. Requests on these hosts 301 to
 * APP_URL. Other hosts (localhost, the custom domain itself) are left alone.
 */
export const LEGACY_PUBLIC_HOSTS = [
  "clover-farm-production.up.railway.app",
  "clover-ai.up.railway.app",
] as const;

export function appOrigin(appUrl: string): string {
  try {
    const url = new URL(appUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:")
      return PUBLIC_APP_URL;
    return url.origin;
  } catch {
    return PUBLIC_APP_URL;
  }
}

/** Path-only canonical URL for a request. Query strings stay out of the tag. */
export function canonicalUrl(appUrl: string, originalUrl: string): string {
  return appOrigin(appUrl) + safePathname(originalUrl);
}

export function ogImageUrl(appUrl: string): string {
  return `${appOrigin(appUrl)}/og-image.jpg`;
}

/**
 * 301 target for a legacy public host, or null when the request should be
 * served as-is. Null when the request host already matches APP_URL, so a
 * deploy whose APP_URL is still the Railway host does not redirect to itself,
 * and so localhost never matches the legacy list.
 */
export function legacyRedirectUrl(
  appUrl: string,
  hostname: string,
  originalUrl: string
): string | null {
  const requestHost = hostname.split(":")[0]?.trim().toLowerCase() ?? "";
  if (!(LEGACY_PUBLIC_HOSTS as readonly string[]).includes(requestHost))
    return null;

  const origin = appOrigin(appUrl);
  if (requestHost === new URL(origin).hostname.toLowerCase()) return null;

  return `${origin}${safeOriginalUrl(originalUrl)}`;
}

export function redirectLegacyHosts(appUrl: string): RequestHandler {
  return (req, res, next) => {
    const target = legacyRedirectUrl(appUrl, req.hostname, req.originalUrl);
    if (!target) {
      next();
      return;
    }
    res.redirect(301, target);
  };
}

/** Point canonical, og:url, and og:image at APP_URL for this request path. */
export function applyDocumentUrls(
  html: string,
  appUrl: string,
  originalUrl: string
): string {
  const canonical = escapeAttr(canonicalUrl(appUrl, originalUrl));
  const image = escapeAttr(ogImageUrl(appUrl));
  let next = html;
  next = replaceOrInsert(
    next,
    /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/,
    `<link rel="canonical" href="${canonical}" />`
  );
  next = replaceOrInsert(
    next,
    /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/,
    `<meta property="og:url" content="${canonical}" />`
  );
  next = replaceOrInsert(
    next,
    /<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/,
    `<meta property="og:image" content="${image}" />`
  );
  return next;
}

function safePathname(originalUrl: string): string {
  const path = safeOriginalUrl(originalUrl).split("?")[0] ?? "/";
  return path || "/";
}

function safeOriginalUrl(originalUrl: string): string {
  if (
    !originalUrl.startsWith("/") ||
    originalUrl.startsWith("//") ||
    /[\u0000-\u0020\u007F]/.test(originalUrl)
  ) {
    return "/";
  }
  try {
    const parsed = new URL(originalUrl, PUBLIC_APP_URL);
    if (parsed.origin !== PUBLIC_APP_URL) return "/";
    const path = `${parsed.pathname || "/"}${parsed.search}`;
    if (!path.startsWith("/") || path.startsWith("//")) return "/";
    return path;
  } catch {
    return "/";
  }
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function replaceOrInsert(html: string, pattern: RegExp, tag: string): string {
  if (pattern.test(html)) return html.replace(pattern, tag);
  if (html.includes("</head>"))
    return html.replace("</head>", `    ${tag}\n  </head>`);
  return `${html}\n${tag}`;
}
