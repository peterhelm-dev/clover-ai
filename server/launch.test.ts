import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  attributionFromVisit,
  cleanUtm,
  externalReferrer,
} from "../shared/attribution";
import { isFeedbackOpen, BETA_DAYS, BETA_PAYOUT_USD } from "./beta-program";
import { dailyEmail, endEmail } from "./beta-emails";
import { registerSeoRoutes, robotsTxt, sitemapXml } from "./seo";

describe("free early access defaults", () => {
  it("does not promise a cash payout", () => {
    expect(BETA_PAYOUT_USD).toBe(0);
  });

  it("keeps payout language out of the beta emails", () => {
    for (const day of [1, 7]) {
      const email = dailyEmail(1, day, 3, "Ada");
      expect(email.text).not.toMatch(/\$\d/);
      expect(email.html).not.toMatch(/\$\d|PayPal|Venmo/);
    }
    const done = endEmail(1, 5, "Ada");
    expect(done.text + done.html).not.toMatch(/\$\d|PayPal|Venmo/);
    expect(dailyEmail(1, 7, 3, "Ada").text).toContain("/beta/feedback");
  });

  it("opens the survey on day 7 and not before", () => {
    const startedAt = new Date("2026-10-12T09:00:00Z");
    const day6 = new Date(
      startedAt.getTime() + (BETA_DAYS - 1) * 86_400_000 - 1000
    );
    const day7 = new Date(startedAt.getTime() + (BETA_DAYS - 1) * 86_400_000);
    expect(isFeedbackOpen({ startedAt, status: "active" }, day6)).toBe(false);
    expect(isFeedbackOpen({ startedAt, status: "active" }, day7)).toBe(true);
    expect(isFeedbackOpen({ startedAt, status: "ended" }, day6)).toBe(true);
  });
});

describe("attribution", () => {
  it("keeps utm fields and an external referrer, and drops query strings", () => {
    const value = attributionFromVisit({
      utmSource: " newsletter ",
      utmMedium: "email",
      utmCampaign: "launch_week",
      referrer: "https://news.example/story?token=secret",
      ownOrigin: "https://getclover.app",
    });
    expect(value).toEqual({
      utmSource: "newsletter",
      utmMedium: "email",
      utmCampaign: "launch_week",
      referrer: "https://news.example/story",
    });
  });

  it("ignores same-site referrers and header-breaking characters", () => {
    expect(
      externalReferrer(
        "https://clover.test/join?utm_source=x",
        "https://clover.test"
      )
    ).toBeNull();
    expect(
      externalReferrer("javascript:alert(1)", "https://clover.test")
    ).toBeNull();
    expect(cleanUtm("ig\r\nSet-Cookie: x")).toBe("igSet-Cookie: x");
    expect(attributionFromVisit({ referrer: "", utmSource: "  " })).toBeNull();
  });

  it("does not overwrite a first touch already stored in the browser", async () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    });
    const { captureFirstTouch } = await import("../client/src/lib/attribution");
    const first = captureFirstTouch(
      {
        search: "?utm_source=instagram&utm_medium=social&utm_campaign=launch",
        origin: "https://clover.test",
      },
      "https://clover.test/join"
    );
    const second = captureFirstTouch(
      { search: "?utm_source=later", origin: "https://clover.test" },
      "https://google.com/search?q=clover"
    );
    expect(first?.utmSource).toBe("instagram");
    expect(second?.utmSource).toBe("instagram");
    expect(second?.referrer).toBeNull();
    vi.unstubAllGlobals();
  });
});

describe("robots and sitemap", () => {
  let server: Server;
  let base: string;

  beforeAll(async () => {
    const app = express();
    registerSeoRoutes(app, "https://getclover.app");
    app.use((_req, res) => {
      res.type("html").send('<!doctype html><div id="root"></div>');
    });
    server = createServer(app);
    await new Promise<void>(resolve =>
      server.listen(0, "127.0.0.1", () => resolve())
    );
    const { port } = server.address() as AddressInfo;
    base = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close(err => (err ? reject(err) : resolve()))
    );
  });

  it("returns the real files instead of the SPA", async () => {
    const robots = await fetch(`${base}/robots.txt`);
    const sitemap = await fetch(`${base}/sitemap.xml`);
    expect(robots.headers.get("content-type")).toMatch(/text\/plain/);
    expect(sitemap.headers.get("content-type")).toMatch(
      /application\/xml|text\/xml/
    );
    const robotsBody = await robots.text();
    const sitemapBody = await sitemap.text();
    expect(robotsBody).toBe(robotsTxt("https://getclover.app"));
    expect(sitemapBody).toBe(sitemapXml("https://getclover.app"));
    expect(robotsBody).not.toContain("<html");
    expect(sitemapBody).toContain("<loc>https://getclover.app/join</loc>");
    expect(sitemapBody).not.toContain("<!doctype");
  });
});

describe("public feedback url", () => {
  it("falls back when the env value is missing or not a link", async () => {
    vi.resetModules();
    delete process.env.PUBLIC_FEEDBACK_URL;
    const missing = await import("./_core/env");
    expect(missing.ENV.publicFeedbackUrl).toBe("mailto:feedback@example.com");

    vi.resetModules();
    process.env.PUBLIC_FEEDBACK_URL = "javascript:alert(1)";
    const rejected = await import("./_core/env");
    expect(rejected.ENV.publicFeedbackUrl).toBe("mailto:feedback@example.com");

    vi.resetModules();
    process.env.PUBLIC_FEEDBACK_URL = "https://forms.example/clover";
    const accepted = await import("./_core/env");
    expect(accepted.ENV.publicFeedbackUrl).toBe("https://forms.example/clover");
    delete process.env.PUBLIC_FEEDBACK_URL;
  });
});
