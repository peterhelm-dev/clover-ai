import { z } from "zod";
import { and, eq, inArray, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { customAlphabet } from "nanoid";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { accessPasses, accessPassRedemptions, users } from "../../drizzle/schema";
import { ENV } from "../_core/env";
import { logEvent } from "../events";

// Readable, unambiguous share codes (no 0/O/1/I)
const generateCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 10);

/**
 * Access passes: owner-shareable links that grant free unlimited AI access
 * (isTester=1), revocable at any time. Deactivating a pass clears the grant
 * for its redeemers unless they're covered by another active pass, are the
 * owner, or are an admin.
 */
export const passesRouter = router({
  /** Public: lets the redeem page describe the pass before sign-in. */
  info: publicProcedure
    .input(z.object({ code: z.string().min(4).max(32) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { valid: false as const };
      const [pass] = await db
        .select({ label: accessPasses.label, active: accessPasses.active })
        .from(accessPasses)
        .where(eq(accessPasses.code, input.code.toUpperCase()));
      if (!pass || !pass.active) return { valid: false as const };
      return { valid: true as const, label: pass.label };
    }),

  /** Signed-in user claims a pass: grants unlimited AI until the pass is revoked. */
  redeem: protectedProcedure
    .input(z.object({ code: z.string().min(4).max(32) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [pass] = await db
        .select()
        .from(accessPasses)
        .where(eq(accessPasses.code, input.code.toUpperCase()));
      if (!pass || !pass.active) {
        throw new TRPCError({ code: "NOT_FOUND", message: "This pass is no longer active." });
      }
      if (ctx.user.loginMethod === "anonymous") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Passes need a real account — sign in first, then open the link again.",
        });
      }
      await db
        .insert(accessPassRedemptions)
        .values({ passId: pass.id, userId: ctx.user.id })
        .onConflictDoNothing();
      await db.update(users).set({ isTester: 1 }).where(eq(users.id, ctx.user.id));
      void logEvent(ctx.user.id, "access_pass_redeemed", { pass_id: pass.id });
      return { success: true, label: pass.label } as const;
    }),

  adminCreate: adminProcedure
    .input(z.object({ label: z.string().max(255).optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const code = generateCode();
      const [row] = await db
        .insert(accessPasses)
        .values({ code, label: input.label, createdBy: ctx.user.id })
        .returning();
      return row;
    }),

  adminList: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select({
        id: accessPasses.id,
        code: accessPasses.code,
        label: accessPasses.label,
        active: accessPasses.active,
        createdAt: accessPasses.createdAt,
        redemptions: sql<number>`(
          select count(*)::int from "accessPassRedemptions" r where r."passId" = ${accessPasses.id}
        )`,
      })
      .from(accessPasses)
      .orderBy(accessPasses.id);
    return rows.map(r => ({ ...r, createdAt: r.createdAt.getTime() }));
  }),

  /**
   * Toggle a pass. Turning one off revokes unlimited access for its
   * redeemers — except the owner, admins, and anyone still covered by a
   * different active pass.
   */
  adminSetActive: adminProcedure
    .input(z.object({ id: z.number().int().positive(), active: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const updated = await db
        .update(accessPasses)
        .set({ active: input.active ? 1 : 0 })
        .where(eq(accessPasses.id, input.id))
        .returning({ id: accessPasses.id });
      if (updated.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Pass not found" });
      }

      if (!input.active) {
        // Revoke isTester for this pass's redeemers who have no other cover.
        const redeemers = await db
          .select({ userId: accessPassRedemptions.userId })
          .from(accessPassRedemptions)
          .where(eq(accessPassRedemptions.passId, input.id));
        const ids = redeemers.map(r => r.userId);
        if (ids.length > 0) {
          const stillCovered = await db
            .select({ userId: accessPassRedemptions.userId })
            .from(accessPassRedemptions)
            .innerJoin(accessPasses, eq(accessPasses.id, accessPassRedemptions.passId))
            .where(and(inArray(accessPassRedemptions.userId, ids), eq(accessPasses.active, 1)));
          const coveredIds = new Set(stillCovered.map(r => r.userId));
          const toRevoke = ids.filter(id => !coveredIds.has(id));
          if (toRevoke.length > 0) {
            const conditions = [inArray(users.id, toRevoke), eq(users.role, "user" as const)];
            if (ENV.ownerEmail) {
              conditions.push(sql`(${users.email} is distinct from ${ENV.ownerEmail})`);
            }
            await db
              .update(users)
              .set({ isTester: 0 })
              .where(and(...conditions));
          }
        }
      }
      return { success: true } as const;
    }),
});
