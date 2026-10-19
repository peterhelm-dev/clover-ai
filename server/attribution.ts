import type { Request } from "express";
import { attributionFromVisit, type FirstTouchAttribution } from "../shared/attribution";

function headerValue(req: Request, name: string): string | null {
  const raw = req.headers[name];
  if (typeof raw !== "string" || !raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function ownOrigin(req: Request): string {
  const forwarded = req.headers["x-forwarded-proto"];
  const proto = (typeof forwarded === "string" ? forwarded.split(",")[0] : "https").trim() || "https";
  const hostHeader = req.headers["x-forwarded-host"] ?? req.headers.host;
  const host = typeof hostHeader === "string" ? hostHeader.split(",")[0].trim() : "";
  return host ? `${proto}://${host}` : "";
}

/** Attribution attached to the request that creates the user. Null when absent. */
export function attributionFromRequest(req: Request): FirstTouchAttribution | null {
  return attributionFromVisit({
    utmSource: headerValue(req, "x-utm-source"),
    utmMedium: headerValue(req, "x-utm-medium"),
    utmCampaign: headerValue(req, "x-utm-campaign"),
    referrer: headerValue(req, "x-acquisition-referrer"),
    ownOrigin: ownOrigin(req),
  });
}
