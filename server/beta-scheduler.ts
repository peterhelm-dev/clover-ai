// Hourly job for the paid beta program. Railway runs one long-lived Node
// process, so a plain interval is enough; every step is idempotent (claimed
// with a conditional UPDATE before sending) so overlapping or repeated ticks
// never double-send.
//
// Each tick:
//   • ends any tester whose 7 days are up (tier → free)
//   • sends days 2–7's daily email (day 1's goes out when they join)
//   • sends the "week's done, give feedback" email once, and one reminder 48h later

import { and, eq, isNull, or, sql } from "drizzle-orm";
import { betaEnrollments, users } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { getDb } from "./db";
import { expireIfDue, programDay, utcDay } from "./beta-program";
import { dailyEmail, endEmail } from "./beta-emails";
import { sendEmail } from "./email";

/** Daily emails go out from this UTC hour (~7–10am across US time zones). */
const DAILY_SEND_HOUR_UTC = 14;
const REMINDER_AFTER_MS = 48 * 3_600_000;

const firstName = (name: string | null) => name?.trim().split(/\s+/)[0] || null;

export async function runBetaTick(now = new Date()): Promise<{ ended: number; sent: number }> {
  const db = await getDb();
  if (!db) return { ended: 0, sent: 0 };
  const emailOn = !!ENV.resendApiKey;
  const today = utcDay(now);
  let ended = 0;
  let sent = 0;

  const rows = await db
    .select({ e: betaEnrollments, email: users.email, name: users.name })
    .from(betaEnrollments)
    .innerJoin(users, eq(users.id, betaEnrollments.userId))
    .where(
      or(
        eq(betaEnrollments.status, "active"),
        and(isNull(betaEnrollments.feedbackSubmittedAt), isNull(betaEnrollments.feedbackReminderSentAt))
      )
    );

  for (const { e: row, email, name } of rows) {
    try {
      const e = await expireIfDue(row, now);
      if (e.status !== row.status) ended++;
      if (!emailOn || !email || e.emailOptOut) continue;

      if (e.status === "active") {
        const day = programDay(e, now);
        if (day < 2 || now.getUTCHours() < DAILY_SEND_HOUR_UTC || e.lastDailyEmailOn === today) continue;
        const [claimed] = await db
          .update(betaEnrollments)
          .set({ lastDailyEmailOn: today })
          .where(and(eq(betaEnrollments.id, e.id), sql`${betaEnrollments.lastDailyEmailOn} IS DISTINCT FROM ${today}`))
          .returning({ id: betaEnrollments.id });
        if (!claimed) continue;
        const ok = await sendEmail({ ...dailyEmail(e.userId, day, e.activeDays.length, firstName(name)), to: email });
        if (ok) sent++;
        else await db.update(betaEnrollments).set({ lastDailyEmailOn: e.lastDailyEmailOn }).where(eq(betaEnrollments.id, e.id));
        continue;
      }

      if (e.feedbackSubmittedAt) continue;
      if (!e.endEmailSentAt) {
        const [claimed] = await db
          .update(betaEnrollments)
          .set({ endEmailSentAt: now })
          .where(and(eq(betaEnrollments.id, e.id), isNull(betaEnrollments.endEmailSentAt)))
          .returning({ id: betaEnrollments.id });
        if (!claimed) continue;
        const ok = await sendEmail({ ...endEmail(e.userId, e.activeDays.length, firstName(name)), to: email });
        if (ok) sent++;
        else await db.update(betaEnrollments).set({ endEmailSentAt: null }).where(eq(betaEnrollments.id, e.id));
      } else if (now.getTime() - new Date(e.endEmailSentAt).getTime() >= REMINDER_AFTER_MS) {
        const [claimed] = await db
          .update(betaEnrollments)
          .set({ feedbackReminderSentAt: now })
          .where(and(eq(betaEnrollments.id, e.id), isNull(betaEnrollments.feedbackReminderSentAt)))
          .returning({ id: betaEnrollments.id });
        if (!claimed) continue;
        const ok = await sendEmail({ ...endEmail(e.userId, e.activeDays.length, firstName(name), true), to: email });
        if (ok) sent++;
        else await db.update(betaEnrollments).set({ feedbackReminderSentAt: null }).where(eq(betaEnrollments.id, e.id));
      }
    } catch (err) {
      console.error(`[Beta] tick failed for enrollment ${row.id}:`, err);
    }
  }
  if (ended || sent) console.log(`[Beta] tick: ended ${ended}, emailed ${sent}`);
  return { ended, sent };
}

/** Starts the hourly tick. Production only unless ENABLE_BETA_SCHEDULER=1. */
export function startBetaScheduler() {
  if (!process.env.DATABASE_URL) return;
  if (!ENV.isProduction && process.env.ENABLE_BETA_SCHEDULER !== "1") return;
  if (!ENV.resendApiKey) console.log("[Beta] RESEND_API_KEY not set — beta emails are paused (expiry still runs).");
  const tick = () => runBetaTick().catch((err) => console.error("[Beta] tick error:", err));
  setTimeout(tick, 60_000);
  setInterval(tick, 60 * 60_000).unref();
}
