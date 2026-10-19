import http, { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  applyDocumentUrls,
  canonicalUrl,
  legacyRedirectUrl,
  PUBLIC_APP_URL,
  redirectLegacyHosts,
} from "./public-url";

const RAILWAY_HOST = "clover-ai.up.railway.app";
const FARM_HOST = "clover-farm-production.up.railway.app";

describe("custom domain urls", () => {
  it("points the code default at getclover.app", async () => {
    const previous = process.env.APP_URL;
    delete process.env.APP_URL;
    vi.resetModules();
    const { ENV } = await import("./_core/env");
    expect(ENV.appUrl).toBe(PUBLIC_APP_URL);
    expect(PUBLIC_APP_URL).toBe("https://getclover.app");
    if (previous === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = previous;
    vi.resetModules();
  });

  it("301s the old Railway host to APP_URL and keeps the path and query", () => {
    expect(
      legacyRedirectUrl(
        PUBLIC_APP_URL,
        RAILWAY_HOST,
        "/join?utm_source=ig&ref=1"
      )
    ).toBe("https://getclover.app/join?utm_source=ig&ref=1");
    expect(legacyRedirectUrl(PUBLIC_APP_URL, FARM_HOST, "/privacy")).toBe(
      "https://getclover.app/privacy"
    );
  });

  it("does not redirect when the request host already matches APP_URL", () => {
    expect(
      legacyRedirectUrl(`https://${RAILWAY_HOST}`, RAILWAY_HOST, "/join")
    ).toBeNull();
    expect(
      legacyRedirectUrl(PUBLIC_APP_URL, "getclover.app", "/join")
    ).toBeNull();
  });

  it("does not redirect local dev", () => {
    expect(
      legacyRedirectUrl(PUBLIC_APP_URL, "localhost", "/join?x=1")
    ).toBeNull();
    expect(legacyRedirectUrl(PUBLIC_APP_URL, "127.0.0.1", "/")).toBeNull();
  });

  it("rewrites canonical and social tags for the request path", () => {
    const html = fs.readFileSync(
      path.resolve(import.meta.dirname, "../client/index.html"),
      "utf-8"
    );
    const page = applyDocumentUrls(html, PUBLIC_APP_URL, "/join?utm_source=ig");
    expect(page).toContain(
      '<link rel="canonical" href="https://getclover.app/join" />'
    );
    expect(page).toContain(
      '<meta property="og:url" content="https://getclover.app/join" />'
    );
    expect(page).toContain(
      '<meta property="og:image" content="https://getclover.app/og-image.jpg" />'
    );
    expect(page).not.toContain("utm_source");
    expect(page).not.toContain("railway.app");
    expect(canonicalUrl("https://staging.example/ignored", "/privacy")).toBe(
      "https://staging.example/privacy"
    );
  });

  it("inserts a canonical tag when the shell does not have one", () => {
    const page = applyDocumentUrls("<head></head>", PUBLIC_APP_URL, "/tos");
    expect(page).toContain(
      '<link rel="canonical" href="https://getclover.app/tos" />'
    );
  });

  it("keeps a hostile path on the canonical host", () => {
    expect(canonicalUrl(PUBLIC_APP_URL, "//evil.example/phish")).toBe(
      "https://getclover.app/"
    );
    expect(
      legacyRedirectUrl(PUBLIC_APP_URL, RAILWAY_HOST, "//evil.example")
    ).toBe("https://getclover.app/");
  });

  it("static public files use getclover.app", () => {
    const root = path.resolve(import.meta.dirname, "..");
    const html = fs.readFileSync(path.join(root, "client/index.html"), "utf-8");
    const robots = fs.readFileSync(
      path.join(root, "client/public/robots.txt"),
      "utf-8"
    );
    const sitemap = fs.readFileSync(
      path.join(root, "client/public/sitemap.xml"),
      "utf-8"
    );
    for (const file of [html, robots, sitemap]) {
      expect(file).not.toContain("railway.app");
      expect(file).toContain("https://getclover.app");
    }
    expect(html).toContain('rel="canonical"');
    expect(sitemap).toContain("<loc>https://getclover.app/join</loc>");
  });
});

describe("legacy host redirect middleware", () => {
  let server: Server;
  let port: number;

  beforeAll(async () => {
    const app = express();
    app.use(redirectLegacyHosts(PUBLIC_APP_URL));
    app.use((req, res) => {
      res
        .type("html")
        .send(
          applyDocumentUrls("<head></head>", PUBLIC_APP_URL, req.originalUrl)
        );
    });
    server = createServer(app);
    await new Promise<void>(resolve =>
      server.listen(0, "127.0.0.1", () => resolve())
    );
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close(err => (err ? reject(err) : resolve()))
    );
  });

  function get(host: string, pathAndQuery: string) {
    return new Promise<{
      status: number;
      location: string | undefined;
      body: string;
    }>((resolve, reject) => {
      const req = http.request(
        { hostname: "127.0.0.1", port, path: pathAndQuery, headers: { host } },
        res => {
          const chunks: Buffer[] = [];
          res.on("data", chunk => chunks.push(chunk));
          res.on("end", () =>
            resolve({
              status: res.statusCode ?? 0,
              location:
                typeof res.headers.location === "string"
                  ? res.headers.location
                  : undefined,
              body: Buffer.concat(chunks).toString("utf8"),
            })
          );
        }
      );
      req.on("error", reject);
      req.end();
    });
  }

  it("redirects the Railway host and serves localhost", async () => {
    const redirected = await get(RAILWAY_HOST, "/join?utm_medium=email");
    expect(redirected.status).toBe(301);
    expect(redirected.location).toBe(
      "https://getclover.app/join?utm_medium=email"
    );

    const local = await get("localhost", "/login");
    expect(local.status).toBe(200);
    expect(local.location).toBeUndefined();
    expect(local.body).toContain(
      '<link rel="canonical" href="https://getclover.app/login" />'
    );
  });
});
