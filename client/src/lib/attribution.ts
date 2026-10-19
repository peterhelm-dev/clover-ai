import {
  attributionFromVisit,
  type FirstTouchAttribution,
} from "@shared/attribution";

const STORAGE_KEY = "clover-attribution";

function readRaw(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** First-touch values already saved in this browser, re-validated. */
export function readStoredAttribution(): FirstTouchAttribution | null {
  const raw = readRaw();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<FirstTouchAttribution>;
    return attributionFromVisit({
      utmSource: parsed.utmSource,
      utmMedium: parsed.utmMedium,
      utmCampaign: parsed.utmCampaign,
      referrer: parsed.referrer,
    });
  } catch {
    return null;
  }
}

/**
 * Remember utm_source / utm_medium / utm_campaign and the external referrer
 * from the first visit that has any of them. Later visits do not overwrite.
 */
export function captureFirstTouch(
  loc: Pick<Location, "search" | "origin"> = window.location,
  referrer: string = document.referrer
): FirstTouchAttribution | null {
  const existing = readStoredAttribution();
  if (existing) return existing;

  const params = new URLSearchParams(loc.search);
  const fresh = attributionFromVisit({
    utmSource: params.get("utm_source"),
    utmMedium: params.get("utm_medium"),
    utmCampaign: params.get("utm_campaign"),
    referrer,
    ownOrigin: loc.origin,
  });
  if (!fresh) return null;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  } catch {
    /* private mode or storage disabled — the signup request just won't have it */
  }
  return fresh;
}

/** Headers for the signup request. Values are percent-encoded so they're header-safe. */
export function attributionHeaders(): Record<string, string> {
  const stored = readStoredAttribution();
  if (!stored) return {};
  const headers: Record<string, string> = {};
  if (stored.utmSource) headers["x-utm-source"] = encodeURIComponent(stored.utmSource);
  if (stored.utmMedium) headers["x-utm-medium"] = encodeURIComponent(stored.utmMedium);
  if (stored.utmCampaign) headers["x-utm-campaign"] = encodeURIComponent(stored.utmCampaign);
  if (stored.referrer) headers["x-acquisition-referrer"] = encodeURIComponent(stored.referrer);
  return headers;
}
