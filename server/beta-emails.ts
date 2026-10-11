// Email content for the paid beta program. One short email per day of the
// week, each nudging toward one part of the app, plus the "week's done —
// final feedback" email and a single reminder.

import { ENV } from "./_core/env";
import { BETA_ACTIVE_DAYS_REQUIRED, BETA_DAYS, BETA_PAYOUT_USD } from "./beta-program";
import { signUnsubscribeToken, type Email } from "./email";

const DAILY: { subject: string; idea: string }[] = [
  {
    subject: "Welcome to the Clover beta 🌱",
    idea: "Start simple: open Clover and say what you ate today, out loud or typed — e.g. \"oatmeal with walnuts and a coffee\". That's it.",
  },
  { subject: "Day 2: try a photo", idea: "Today, tap the camera in the Log screen and snap your plate instead of describing it. Does Clover get it right?" },
  {
    subject: "Day 3: several meals in one go",
    idea: "Try logging more than one meal in a single sentence: \"eggs this morning, a burrito for lunch\". Clover should split them and place them at the right times.",
  },
  { subject: "Day 4: how are you feeling?", idea: "On the Home screen, do a quick mood check-in (energy and ease). It takes five seconds and is entirely optional." },
  {
    subject: "Day 5: ask Clover something",
    idea: "Ask a question about your own eating — \"How's my protein this week?\" or \"Why might I be tired lately?\" — and tell us if the answer felt useful and honest.",
  },
  { subject: "Day 6: look back", idea: "Open Past logs and My stats. Is anything confusing, wrong or missing? The Feedback button at the top is perfect for quick notes." },
  {
    subject: "Last day of your Clover beta",
    idea: "Log as you normally would today. Tomorrow we'll send a short final feedback form (about 2 minutes) — that's the last step for your $" + BETA_PAYOUT_USD + ".",
  },
];

function layout(userId: number, bodyHtml: string, bodyText: string, subject: string): Email & { to: "" } {
  const unsubUrl = `${ENV.appUrl}/api/beta/unsubscribe?token=${encodeURIComponent(signUnsubscribeToken(userId))}`;
  const html = `<!doctype html><html><body style="margin:0;background:#FAF6EE;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1F2A24">
<div style="max-width:520px;margin:0 auto;padding:32px 24px">
  <p style="font-family:Georgia,serif;font-size:22px;font-weight:600;color:#15803D;margin:0 0 24px">Clover</p>
  ${bodyHtml}
  <p style="font-size:12px;color:#6b7280;margin-top:40px;line-height:1.5">You're getting this because you joined the Clover beta. Questions? Just reply.<br>
  <a href="${unsubUrl}" style="color:#6b7280">Stop beta emails</a></p>
</div></body></html>`;
  const text = `${bodyText}\n\n—\nYou're getting this because you joined the Clover beta. Questions? Just reply.\nStop beta emails: ${unsubUrl}`;
  return { to: "", subject, html, text, headers: { "List-Unsubscribe": `<${unsubUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } };
}

function button(label: string, url: string) {
  return `<p style="margin:28px 0"><a href="${url}" style="background:#15803D;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;display:inline-block">${label}</a></p>`;
}

const p = (t: string) => `<p style="font-size:16px;line-height:1.6;margin:0 0 14px">${t}</p>`;

export function dailyEmail(userId: number, day: number, activeDays: number, firstName?: string | null) {
  const d = DAILY[Math.min(Math.max(day, 1), BETA_DAYS) - 1];
  const hi = firstName ? `Hi ${firstName},` : "Hi there,";
  const progress =
    activeDays >= BETA_ACTIVE_DAYS_REQUIRED
      ? `You've already used Clover on ${activeDays} days — that covers the ${BETA_ACTIVE_DAYS_REQUIRED} we ask for. Thank you!`
      : `So far you've used Clover on ${activeDays} of the ${BETA_ACTIVE_DAYS_REQUIRED} days we ask for.`;
  const intro =
    day === 1
      ? `Thanks for testing Clover this week. Use it on ${BETA_ACTIVE_DAYS_REQUIRED} of the next ${BETA_DAYS} days and fill in a short feedback form at the end, and we'll send you $${BETA_PAYOUT_USD}.`
      : `Day ${day} of ${BETA_DAYS}. ${progress}`;
  return layout(
    userId,
    p(hi) + p(intro) + p(`<strong>Today's idea:</strong> ${d.idea}`) + button("Open Clover", ENV.appUrl),
    `${hi}\n\n${intro}\n\nToday's idea: ${d.idea}\n\nOpen Clover: ${ENV.appUrl}`,
    d.subject
  );
}

export function endEmail(userId: number, activeDays: number, firstName?: string | null, reminder = false) {
  const hi = firstName ? `Hi ${firstName},` : "Hi there,";
  const url = `${ENV.appUrl}/beta/feedback`;
  const qualified = activeDays >= BETA_ACTIVE_DAYS_REQUIRED;
  const line = qualified
    ? `You used Clover on ${activeDays} days — thank you! The last step for your $${BETA_PAYOUT_USD} is a short feedback form (about 2 minutes), where you'll also tell us your PayPal or Venmo.`
    : `You used Clover on ${activeDays} of the ${BETA_ACTIVE_DAYS_REQUIRED} days the payout needed, so this round doesn't qualify for the $${BETA_PAYOUT_USD} — but your honest feedback would still help a lot, and it takes about 2 minutes.`;
  const subject = reminder ? "Quick reminder: your Clover beta feedback" : "Your Clover beta week is done";
  return layout(
    userId,
    p(hi) +
      p(reminder ? "Just a nudge in case this got buried." : "Your beta week has wrapped up and your account has moved to the free plan — your logs are all still there.") +
      p(line) +
      button("Give feedback", url),
    `${hi}\n\n${reminder ? "Just a nudge in case this got buried." : "Your beta week has wrapped up and your account has moved to the free plan — your logs are all still there."}\n\n${line}\n\nGive feedback: ${url}`,
    subject
  );
}
