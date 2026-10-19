/**
 * First-touch attribution. Captured in the browser on the first visit that
 * has a UTM parameter or an external referrer, then sent with signup.
 * Query strings are dropped from referrers so tokens in other sites' URLs
 * are never stored.
 */

export type FirstTouchAttribution = {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  referrer: string | null;
};

const UTM_MAX = 128;
const REFERRER_MAX = 512;

export function cleanUtm(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value
    .replace(/[^\w .+~:/@-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  return cleaned.slice(0, UTM_MAX);
}

/** Origin + path of an external http(s) referrer, or null. */
export function externalReferrer(
  referrer: string | null | undefined,
  ownOrigin: string
): string | null {
  if (!referrer) return null;
  let url: URL;
  try {
    url = new URL(referrer);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (ownOrigin) {
    try {
      if (url.origin === new URL(ownOrigin).origin) return null;
    } catch {
      if (url.origin === ownOrigin) return null;
    }
  }
  const path = url.pathname === "/" ? "" : url.pathname;
  return `${url.origin}${path}`.slice(0, REFERRER_MAX);
}

export function attributionFromVisit(input: {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  referrer?: string | null;
  ownOrigin?: string;
}): FirstTouchAttribution | null {
  const value: FirstTouchAttribution = {
    utmSource: cleanUtm(input.utmSource),
    utmMedium: cleanUtm(input.utmMedium),
    utmCampaign: cleanUtm(input.utmCampaign),
    referrer: externalReferrer(input.referrer, input.ownOrigin ?? ""),
  };
  if (!value.utmSource && !value.utmMedium && !value.utmCampaign && !value.referrer) {
    return null;
  }
  return value;
}
