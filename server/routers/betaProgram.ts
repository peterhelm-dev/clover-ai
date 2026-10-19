import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { appSettings, betaEnrollments, users } from "../../drizzle/schema";
import {
  BETA_ACTIVE_DAYS_REQUIRED,
  BETA_DAILY_AI_CAP,
  BETA_DAYS,
  BETA_PAYOUT_USD,
  BETA_WEEKLY_AI_CAP,
  describeEnrollment,
  expireIfDue,
  getEnrollment,
  getProgramAvailability,
  getProgramSettings,
  isFeedbackOpen,
  isQualified,
  joinBeta,
  payoutsEnabled,
  utcDay,
} from "../beta-program";
import { dailyEmail } from "../beta-emails";
import { sendEmail } from "../email";
import { logEvent } from "../events";

const feedbackInput = z.object({
  overallRating: z.number().int().min(1).max(5),
  keepUsing: z.enum(["yes", "maybe", "no"]),
  likedMost: z.string().trim().min(1, "Tell us one thing you liked").max(2000),
  frustrating: z.string().trim().min(1, "Tell us one thing that frustrated you").max(2000),
  confusing: z.string().trim().max(2000).optional(),
  wouldPay: z.enum(["no", "under_5", "5_to_10", "over_10"]),
  anythingElse: z.string().trim().max(2000).optional(),
  payoutMethod: z.enum(["paypal", "venmo"]).optional(),
  payoutHandle: z.string().trim().min(2).max(128).optional(),
});

export const betaProgramRouter = router({
  /** Public: what the /join page shows before anyone signs in. */
  availability: publicProcedure.query(async () => {
    const a = await getProgramAvailability();
    return {
      ...a,
      days: BETA_DAYS,
      payout: BETA_PAYOUT_USD,
      activeDaysRequired: BETA_ACTIVE_DAYS_REQUIRED,
      dailyCap: BETA_DAILY_AI_CAP,
      weeklyCap: BETA_WEEKLY_AI_CAP,
    };
  }),

  /** The signed-in user's beta week, or null if they never joined. Ends the week if it's over. */
  status: protectedProcedure.query(async ({ ctx }) => {
    const e = await getEnrollment(ctx.user.id);
    if (!e) return null;
    return describeEnrollment(await expireIfDue(e));
  }),

  join: protectedProcedure.mutation(async ({ ctx }) => {
    const e = await joinBeta(ctx.user);
    void logEvent(ctx.user.id, "beta_joined", { enrollment_id: e.id });
    // Day 1 email goes out right away; the scheduler sends days 2–7.
    if (ctx.user.email) {
      const first = ctx.user.name?.trim().split(/\s+/)[0] ?? null;
      void sendEmail({ ...dailyEmail(ctx.user.id, 1, 0, first), to: ctx.user.email }).then(async (ok) => {
        if (!ok) return;
        const db = await getDb();
        await db?.update(betaEnrollments).set({ lastDailyEmailOn: utcDay() }).where(eq(betaEnrollments.id, e.id));
      });
    }
    return describeEnrollment(e);
  }),

  submitFeedback: protectedProcedure.input(feedbackInput).mutation(async ({ ctx, input }) => {
    let e = await getEnrollment(ctx.user.id);
    if (!e) throw new TRPCError({ code: "NOT_FOUND", message: "You're not in the beta." });
    e = await expireIfDue(e);
    if (!isFeedbackOpen(e)) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The feedback form opens when your beta week ends." });
    }
    if (e.feedbackSubmittedAt) {
      throw new TRPCError({ code: "CONFLICT", message: "You've already sent your feedback — thank you!" });
    }
    const eligible = payoutsEnabled() && e.activeDays.length >= BETA_ACTIVE_DAYS_REQUIRED;
    if (eligible && (!input.payoutMethod || !input.payoutHandle)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Add your PayPal or Venmo so we can send your $" + BETA_PAYOUT_USD + "." });
    }
    const { payoutMethod, payoutHandle, ...answers } = input;
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const [saved] = await db
      .update(betaEnrollments)
      .set({
        feedback: answers,
        feedbackSubmittedAt: new Date(),
        payoutMethod: eligible ? payoutMethod : null,
        payoutHandle: eligible ? payoutHandle : null,
      })
      .where(eq(betaEnrollments.id, e.id))
      .returning();
    void logEvent(ctx.user.id, "beta_feedback_submitted", { rating: input.overallRating, qualified: isQualified(saved) });
    return describeEnrollment(saved);
  }),

  // ---- Admin ---------------------------------------------------------------

  adminOverview: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const settings = await getProgramSettings(db);
    const rows = await db
      .select({ e: betaEnrollments, email: users.email, name: users.name })
      .from(betaEnrollments)
      .innerJoin(users, eq(users.id, betaEnrollments.userId))
      .orderBy(desc(betaEnrollments.startedAt));
    const testers = [];
    for (const r of rows) {
      const e = await expireIfDue(r.e);
      testers.push({
        id: e.id,
        name: r.name,
        email: r.email,
        startedAt: e.startedAt,
        ...describeEnrollment(e),
        emailOptOut: !!e.emailOptOut,
        feedback: e.feedback,
        payoutMethod: e.payoutMethod,
        payoutHandle: e.payoutHandle,
        paidAt: e.paidAt,
      });
    }
    return { ...settings, payout: BETA_PAYOUT_USD, taken: testers.length, testers };
  }),

  adminUpdateSettings: adminProcedure
    .input(z.object({ spots: z.number().int().min(0).max(10_000).optional(), open: z.boolean().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await getProgramSettings(db); // ensures the row exists
      await db
        .update(appSettings)
        .set({
          ...(input.spots !== undefined ? { betaSpots: input.spots } : {}),
          ...(input.open !== undefined ? { betaOpen: input.open ? 1 : 0 } : {}),
          updatedAt: new Date(),
        });
      return getProgramSettings(db);
    }),

  adminSetPaid: adminProcedure
    .input(z.object({ enrollmentId: z.number().int(), paid: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db
        .update(betaEnrollments)
        .set({ paidAt: input.paid ? new Date() : null })
        .where(eq(betaEnrollments.id, input.enrollmentId));
      return { success: true } as const;
    }),
});
