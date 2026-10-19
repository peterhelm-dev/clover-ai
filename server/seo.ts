import type { Express } from "express";

/** Public pages worth listing. Authenticated app routes and /admin stay out. */
const PUBLIC_PATHS = ["/", "/login", "/join", "/privacy", "/tos"] as const;

function origin(appUrl: string): string {
  return appUrl.replace(/\/+$/, "");
}

export function robotsTxt(appUrl: string): string {
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /api/",
    "",
    `Sitemap: ${origin(appUrl)}/sitemap.xml`,
    "",
  ].join("\n");
}

export function sitemapXml(appUrl: string): string {
  const base = origin(appUrl);
  const urls = PUBLIC_PATHS.map(path => `  <url><loc>${base}${path === "/" ? "/" : path}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/** Real files, registered before the SPA fallback so these paths never return index.html. */
export function registerSeoRoutes(app: Express, appUrl: string): void {
  app.get("/robots.txt", (_req, res) => {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.send(robotsTxt(appUrl));
  });
  app.get("/sitemap.xml", (_req, res) => {
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.send(sitemapXml(appUrl));
  });
}
