// Minimal transactional email via Resend's HTTP API (no SDK needed).
// Without RESEND_API_KEY the message is logged and reported as not sent, so
// the beta scheduler can retry once email is configured.

import { createHmac, timingSafeEqual } from "node:crypto";
import { ENV } from "./_core/env";

export type Email = { to: string; subject: string; html: string; text: string; headers?: Record<string, string> };

export async function sendEmail(msg: Email): Promise<boolean> {
  if (!ENV.resendApiKey) {
    console.log(`[Email] (RESEND_API_KEY not set — not sent) to=${msg.to} subject="${msg.subject}"`);
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${ENV.resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: ENV.emailFrom,
      to: [msg.to],
      // "Questions? Just reply." lands with the owner, not a no-reply sender.
      ...(ENV.ownerEmail ? { reply_to: ENV.ownerEmail } : {}),
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      headers: msg.headers,
    }),
  });
  if (!res.ok) {
    console.error(`[Email] Resend rejected message to ${msg.to}: ${res.status} ${await res.text().catch(() => "")}`);
    return false;
  }
  return true;
}

/** Signed token for one-click unsubscribe links: "<userId>.<sig>". */
export function signUnsubscribeToken(userId: number): string {
  const sig = createHmac("sha256", ENV.emailLinkSecret).update(`beta-unsub:${userId}`).digest("base64url").slice(0, 32);
  return `${userId}.${sig}`;
}

export function verifyUnsubscribeToken(token: string): number | null {
  const [id, sig] = token.split(".");
  const userId = Number(id);
  if (!ENV.emailLinkSecret || !Number.isInteger(userId) || !sig) return null;
  const expected = signUnsubscribeToken(userId).split(".")[1];
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b) ? userId : null;
}
