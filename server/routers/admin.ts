import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { users, subscriptions, waitlist, referrals, appSettings } from "../../drizzle/schema";
import { eq, desc, count, gte, sql } from "drizzle-orm";

export const adminRouter = router({
  /** High-level stats for the admin overview panel */
  getStats: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const now = new Date();

    const [totalUsers] = await db.select({ count: count() }).from(users);
    const [totalWaitlist] = await db.select({ count: count() }).from(waitlist);
    const [totalReferrals] = await db.select({ count: count() }).from(referrals);
    const [activeTrials] = await db
      .select({ count: count() })
      .from(subscriptions)
      .where(gte(subscriptions.trialEndsAt, now));
    const [paidSubs] = await db
      .select({ count: count() })
      .from(subscriptions)
      .where(
        sql`${subscriptions.tier} IN ('plus','pro') AND (${subscriptions.trialEndsAt} IS NULL OR ${subscriptions.trialEndsAt} < ${now})`
      );
    const [testers] = await db
      .select({ count: count() })
      .from(users)
      .where(eq(users.isTester, 1));

    return {
      totalUsers: totalUsers.count,
      totalWaitlist: totalWaitlist.count,
      totalReferrals: totalReferrals.count,
      activeTrials: activeTrials.count,
      paidSubscribers: paidSubs.count,
      testers: testers.count,
    };
  }),

  /** List all users with their subscription info */
  listUsers: adminProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(25),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { users: [], total: 0, page: input.page, pageSize: input.pageSize };
      const offset = (input.page - 1) * input.pageSize;

      const rows = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          isTester: users.isTester,
          referralCode: users.referralCode,
          createdAt: users.createdAt,
          lastSignedIn: users.lastSignedIn,
          utmSource: users.utmSource,
          utmMedium: users.utmMedium,
          utmCampaign: users.utmCampaign,
          acquisitionReferrer: users.acquisitionReferrer,
          tier: subscriptions.tier,
          trialEndsAt: subscriptions.trialEndsAt,
          aiCallsUsedThisMonth: subscriptions.aiCallsUsedThisMonth,
          freeMonthsRemaining: subscriptions.freeMonthsRemaining,
        })
        .from(users)
        .leftJoin(subscriptions, eq(users.id, subscriptions.userId))
        .orderBy(desc(users.createdAt))
        .limit(input.pageSize)
        .offset(offset);

      const [{ count: total }] = await db.select({ count: count() }).from(users);
      return { users: rows, total, page: input.page, pageSize: input.pageSize };
    }),

  /** Set a user's role */
  setRole: adminProcedure
    .input(z.object({ userId: z.number().int(), role: z.enum(["user", "admin"]) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.update(users).set({ role: input.role }).where(eq(users.id, input.userId));
      return { success: true };
    }),

  /** Grant or revoke tester status — testers get unlimited AI calls and Pro features */
  setTester: adminProcedure
    .input(z.object({ userId: z.number().int(), isTester: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db
        .update(users)
        .set({ isTester: input.isTester ? 1 : 0 })
        .where(eq(users.id, input.userId));

      if (input.isTester) {
        const [existing] = await db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.userId, input.userId));
        if (!existing) {
          await db.insert(subscriptions).values({
            userId: input.userId,
            tier: "pro",
            aiCallsUsedThisMonth: 0,
            periodStart: new Date(),
            trialUsed: 0,
            freeMonthsRemaining: 0,
          });
        } else {
          await db
            .update(subscriptions)
            .set({ tier: "pro" })
            .where(eq(subscriptions.userId, input.userId));
        }
      }
      return { success: true };
    }),

  /** Override a user's subscription tier */
  overrideSubscription: adminProcedure
    .input(
      z.object({
        userId: z.number().int(),
        tier: z.enum(["free", "plus", "pro"]),
        freeMonthsRemaining: z.number().int().min(0).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [existing] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, input.userId));

      if (existing) {
        await db
          .update(subscriptions)
          .set({
            tier: input.tier,
            ...(input.freeMonthsRemaining !== undefined
              ? { freeMonthsRemaining: input.freeMonthsRemaining }
              : {}),
          })
          .where(eq(subscriptions.userId, input.userId));
      } else {
        await db.insert(subscriptions).values({
          userId: input.userId,
          tier: input.tier,
          aiCallsUsedThisMonth: 0,
          periodStart: new Date(),
          trialUsed: 0,
          freeMonthsRemaining: input.freeMonthsRemaining ?? 0,
        });
      }
      return { success: true };
    }),

  /** List waitlist signups */
  listWaitlist: adminProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(50),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { entries: [], total: 0 };
      const offset = (input.page - 1) * input.pageSize;
      const rows = await db
        .select()
        .from(waitlist)
        .orderBy(desc(waitlist.createdAt))
        .limit(input.pageSize)
        .offset(offset);
      const [{ count: total }] = await db.select({ count: count() }).from(waitlist);
      return { entries: rows, total };
    }),

  /** List all referrals */
  listReferrals: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select({
        id: referrals.id,
        code: referrals.code,
        status: referrals.status,
        createdAt: referrals.createdAt,
        referrerName: users.name,
        referrerEmail: users.email,
      })
      .from(referrals)
      .leftJoin(users, eq(referrals.referrerId, users.id))
      .orderBy(desc(referrals.createdAt))
      .limit(200);
    return rows;
  }),

  /** Get current app settings (invite-only mode, etc.) */
  getSettings: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { inviteOnly: false };
    const [settings] = await db.select().from(appSettings).limit(1);
    return {
      inviteOnly: (settings?.inviteOnly ?? 0) === 1,
    };
  }),

  /** Toggle invite-only mode */
  toggleInviteOnly: adminProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [existing] = await db.select().from(appSettings).limit(1);
      if (existing) {
        await db
          .update(appSettings)
          .set({ inviteOnly: input.enabled ? 1 : 0 })
          .where(eq(appSettings.id, existing.id));
      } else {
        await db.insert(appSettings).values({
          inviteOnly: input.enabled ? 1 : 0,
        });
      }
      return { success: true, inviteOnly: input.enabled };
    }),
});
