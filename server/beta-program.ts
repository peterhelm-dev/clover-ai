// 7-day early-access program (public /join link).
//
// Someone joins, their subscription tier becomes "beta" for 7 days with capped
// AI usage, they get one email a day, and when the week ends they drop to the
// free tier automatically. The feedback form opens on day 7. Cash payouts are
// off (BETA_PAYOUT_USD = 0). A value above 0 re-enables the old paid-tester
// copy and the PayPal/Venmo step; there is no admin setting for the amount.

import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import { appSettings, betaEnrollments, subscriptions, type BetaEnrollment } from "../drizzle/schema";
import { getDb } from "./db";
import { getOrCreateSubscription } from "./db-subscriptions";

export const BETA_DAYS = 7;
export const BETA_DAILY_AI_CAP = 20;
export const BETA_WEEKLY_AI_CAP = 100;
export const BETA_ACTIVE_DAYS_REQUIRED = 5;
/**
 * Dollars promised to a tester who qualifies. 0 disables every user-facing
 * payout promise (free early access). This is a code default, not an admin
 * or database setting.
 */
export const BETA_PAYOUT_USD = 0;
export const BETA_DEFAULT_SPOTS = 20;

export function payoutsEnabled(): boolean {
  return BETA_PAYOUT_USD > 0;
}

/**
 * The end-of-week survey opens on day 7 (six full days after they joined)
 * and stays open after the week ends. Day 1 is the first 24 hours.
 */
export function isFeedbackOpen(
  e: { startedAt: Date | string; status: "active" | "ended" },
  now = new Date()
): boolean {
  if (e.status === "ended") return true;
  const started = new Date(e.startedAt).getTime();
  return now.getTime() - started >= (BETA_DAYS - 1) * 86_400_000;
}

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

async function requireDb(): Promise<Db> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db;
}

/** UTC calendar day, "YYYY-MM-DD". Daily caps and active days both use UTC days. */
export function utcDay(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** 1-based day of the week-long program (1..7), clamped. */
export function programDay(e: Pick<BetaEnrollment, "startedAt">, now = new Date()): number {
  const day = Math.floor((now.getTime() - new Date(e.startedAt).getTime()) / 86_400_000) + 1;
  return Math.min(Math.max(day, 1), BETA_DAYS);
}

export function isQualified(e: Pick<BetaEnrollment, "activeDays" | "feedbackSubmittedAt">): boolean {
  return (e.activeDays?.length ?? 0) >= BETA_ACTIVE_DAYS_REQUIRED && !!e.feedbackSubmittedAt;
}

/** Program settings, creating the singleton appSettings row on first use. */
export async function getProgramSettings(db?: Db): Promise<{ spots: number; open: boolean }> {
  const conn = db ?? (await requireDb());
  let [row] = await conn.select().from(appSettings).limit(1);
  if (!row) {
    [row] = await conn.insert(appSettings).values({}).returning();
  }
  return { spots: row.betaSpots ?? BETA_DEFAULT_SPOTS, open: (row.betaOpen ?? 1) === 1 };
}

export async function countEnrollments(db?: Db): Promise<number> {
  const conn = db ?? (await requireDb());
  const [r] = await conn.select({ n: sql<number>`count(*)::int` }).from(betaEnrollments);
  return r?.n ?? 0;
}

/** Public numbers for the /join page. */
export async function getProgramAvailability() {
  const db = await requireDb();
  const { spots, open } = await getProgramSettings(db);
  const taken = await countEnrollments(db);
  const spotsLeft = Math.max(spots - taken, 0);
  return { open: open && spotsLeft > 0, spotsLeft, spots };
}

export async function getEnrollment(userId: number): Promise<BetaEnrollment | null> {
  // No database (unit tests, local tooling) → nobody is enrolled; the caller's own
  // subscription lookup still enforces normal limits.
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(betaEnrollments).where(eq(betaEnrollments.userId, userId)).limit(1);
  return row ?? null;
}

/**
 * Ends a tester's week if it's over: status → ended, tier → free with a fresh
 * monthly allowance. Idempotent and safe to call on every request; the
 * scheduler calls it too so people who never come back still get moved.
 */
export async function expireIfDue(e: BetaEnrollment, now = new Date()): Promise<BetaEnrollment> {
  if (e.status !== "active" || new Date(e.endsAt) > now) return e;
  const db = await requireDb();
  const [ended] = await db
    .update(betaEnrollments)
    .set({ status: "ended", endedAt: now })
    .where(and(eq(betaEnrollments.id, e.id), eq(betaEnrollments.status, "active")))
    .returning();
  // Only touch the tier if it's still "beta" — never overwrite a paid plan they bought meanwhile.
  await db
    .update(subscriptions)
    .set({ tier: "free", aiCallsUsedThisMonth: 0, periodStart: now, updatedAt: now })
    .where(and(eq(subscriptions.userId, e.userId), eq(subscriptions.tier, "beta")));
  return ended ?? { ...e, status: "ended", endedAt: now };
}

export type JoinUser = { id: number; email: string | null; loginMethod: string | null };

export async function joinBeta(user: JoinUser, now = new Date()): Promise<BetaEnrollment> {
  if (user.loginMethod === "anonymous") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Create a free account first, then join the beta." });
  }
  if (!user.email) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Your account needs an email address so we can reach you during the beta." });
  }
  const db = await requireDb();

  return db.transaction(async (tx) => {
    // Serialize joins on the settings row so two people can't both take the last spot:
    // make sure the row exists, lock it, then read the settings under the lock.
    await getProgramSettings(tx as unknown as Db);
    await tx.execute(sql`SELECT id FROM "appSettings" ORDER BY id LIMIT 1 FOR UPDATE`);
    const { spots, open } = await getProgramSettings(tx as unknown as Db);

    const [existing] = await tx.select().from(betaEnrollments).where(eq(betaEnrollments.userId, user.id)).limit(1);
    if (existing) {
      throw new TRPCError({ code: "CONFLICT", message: "You've already joined the beta — one week per person." });
    }
    const [{ n: taken }] = await tx.select({ n: sql<number>`count(*)::int` }).from(betaEnrollments);
    if (!open || taken >= spots) {
      throw new TRPCError({ code: "FORBIDDEN", message: "The beta is full right now. Thanks so much for your interest!" });
    }

    const sub = await getOrCreateSubscription(user.id);
    if (sub.stripeSubscriptionId && (sub.tier === "plus" || sub.tier === "pro")) {
      throw new TRPCError({ code: "FORBIDDEN", message: "You're already on a paid plan, so the beta tier wouldn't add anything." });
    }

    const endsAt = new Date(now.getTime() + BETA_DAYS * 86_400_000);
    const [row] = await tx
      .insert(betaEnrollments)
      .values({ userId: user.id, startedAt: now, endsAt })
      .returning();
    await tx
      .update(subscriptions)
      .set({ tier: "beta", trialEndsAt: null, updatedAt: now })
      .where(eq(subscriptions.userId, user.id));
    return row;
  });
}

/**
 * Called before every AI request from a user on the beta tier. Atomically
 * counts the call against today's and the week's cap and marks today as an
 * active day; throws a friendly error once a cap is hit. Returns false when
 * the user isn't an active tester (normal tier limits then apply).
 */
export async function consumeBetaAiCall(userId: number, now = new Date()): Promise<boolean> {
  let e = await getEnrollment(userId);
  if (!e) return false;
  e = await expireIfDue(e, now);
  if (e.status !== "active") return false;

  const db = await requireDb();
  const today = utcDay(now);
  const [updated] = await db
    .update(betaEnrollments)
    .set({
      aiCallsToday: sql`CASE WHEN ${betaEnrollments.aiCallsDay} = ${today} THEN ${betaEnrollments.aiCallsToday} + 1 ELSE 1 END`,
      aiCallsDay: today,
      aiCallsTotal: sql`${betaEnrollments.aiCallsTotal} + 1`,
      activeDays: sql`CASE WHEN ${betaEnrollments.activeDays} ? ${today} THEN ${betaEnrollments.activeDays} ELSE ${betaEnrollments.activeDays} || to_jsonb(${today}::text) END`,
    })
    .where(
      and(
        eq(betaEnrollments.id, e.id),
        eq(betaEnrollments.status, "active"),
        sql`${betaEnrollments.aiCallsTotal} < ${BETA_WEEKLY_AI_CAP}`,
        sql`(${betaEnrollments.aiCallsDay} IS DISTINCT FROM ${today} OR ${betaEnrollments.aiCallsToday} < ${BETA_DAILY_AI_CAP})`
      )
    )
    .returning({ id: betaEnrollments.id });

  if (!updated) {
    const weeklyHit = e.aiCallsTotal >= BETA_WEEKLY_AI_CAP;
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: weeklyHit
        ? `You've used all ${BETA_WEEKLY_AI_CAP} AI analyses for your beta week — thank you for testing so thoroughly!`
        : `That's today's ${BETA_DAILY_AI_CAP} AI analyses. Your allowance resets at midnight UTC — see you tomorrow!`,
    });
  }
  return true;
}

/** What the app shows a tester about their week. */
export function describeEnrollment(e: BetaEnrollment, now = new Date()) {
  const today = utcDay(now);
  return {
    status: e.status,
    day: programDay(e, now),
    days: BETA_DAYS,
    endsAt: e.endsAt,
    aiUsedToday: e.aiCallsDay === today ? e.aiCallsToday : 0,
    aiDailyCap: BETA_DAILY_AI_CAP,
    aiUsedTotal: e.aiCallsTotal,
    aiWeeklyCap: BETA_WEEKLY_AI_CAP,
    activeDays: e.activeDays?.length ?? 0,
    activeDaysRequired: BETA_ACTIVE_DAYS_REQUIRED,
    feedbackSubmitted: !!e.feedbackSubmittedAt,
    /** Survey is available from day 7, including while the week is still active. */
    feedbackOpen: isFeedbackOpen(e, now),
    qualified: isQualified(e),
    paid: !!e.paidAt,
    payout: BETA_PAYOUT_USD,
  };
}
