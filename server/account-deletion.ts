// Permanent, user-initiated account deletion (App Store guideline 5.1.1(v)).
//
// Order matters:
//   1. Cancel any paid Stripe subscription, so a deleted user is never billed again.
//   2. Remove their meal photos from storage.
//   3. Delete every row that belongs to them, in one transaction.
//   4. Delete their Supabase Auth user, so the same login can't resurrect the account.
// Steps 1–2 run before the transaction because they can't be rolled back; if one
// fails we stop before touching the database and the user can retry.

import { eq, or } from "drizzle-orm";
import {
  accessPassRedemptions,
  betaFeedback,
  betaInvites,
  events,
  foodLogs,
  mealPlans,
  moodEntries,
  referrals,
  subscriptions,
  userProfiles,
  users,
  waitlist,
  waterIntake,
  type User,
} from "../drizzle/schema";
import { getDb } from "./db";
import { ENV } from "./_core/env";
import { getStripe } from "./_core/stripe";
import { getSupabaseAdmin } from "./_core/supabaseAdmin";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export type AccountDeletionDeps = {
  getDb: () => Promise<Db | null>;
  cancelStripeSubscription: (subscriptionId: string) => Promise<void>;
  deleteStoragePrefix: (prefix: string) => Promise<void>;
  deleteAuthUser: (authUserId: string) => Promise<void>;
};

const STORAGE_PAGE_SIZE = 100;

async function deleteStoragePrefix(prefix: string): Promise<void> {
  const bucket = getSupabaseAdmin().storage.from(ENV.supabaseStorageBucket);
  // Always list from offset 0: each pass removes what it found.
  for (;;) {
    const { data, error } = await bucket.list(prefix, { limit: STORAGE_PAGE_SIZE });
    if (error) throw new Error(`Storage list failed: ${error.message}`);
    if (!data || data.length === 0) return;
    const { error: removeError } = await bucket.remove(data.map((f) => `${prefix}/${f.name}`));
    if (removeError) throw new Error(`Storage delete failed: ${removeError.message}`);
    if (data.length < STORAGE_PAGE_SIZE) return;
  }
}

const defaultDeps: AccountDeletionDeps = {
  getDb,
  cancelStripeSubscription: async (id) => {
    try {
      await getStripe().subscriptions.cancel(id);
    } catch (err: any) {
      // Already cancelled or gone on Stripe's side — nothing left to bill.
      if (err?.code === "resource_missing") return;
      throw err;
    }
  },
  deleteStoragePrefix,
  deleteAuthUser: async (authUserId) => {
    const { error } = await getSupabaseAdmin().auth.admin.deleteUser(authUserId);
    if (error && error.status !== 404) {
      throw new Error(`Auth user delete failed: ${error.message}`);
    }
  },
};

export async function deleteUserAccount(
  user: Pick<User, "id" | "openId" | "email">,
  deps: AccountDeletionDeps = defaultDeps
): Promise<void> {
  const db = await deps.getDb();
  if (!db) throw new Error("Database not available");

  const [sub] = await db
    .select({ stripeSubscriptionId: subscriptions.stripeSubscriptionId })
    .from(subscriptions)
    .where(eq(subscriptions.userId, user.id))
    .limit(1);
  if (sub?.stripeSubscriptionId) {
    await deps.cancelStripeSubscription(sub.stripeSubscriptionId);
  }

  await deps.deleteStoragePrefix(`meals/${user.id}`);

  await db.transaction(async (tx) => {
    const id = user.id;
    await tx.delete(events).where(eq(events.userId, id)); // FK to users — must go first
    await tx.delete(foodLogs).where(eq(foodLogs.userId, id));
    await tx.delete(moodEntries).where(eq(moodEntries.userId, id));
    await tx.delete(waterIntake).where(eq(waterIntake.userId, id));
    await tx.delete(mealPlans).where(eq(mealPlans.userId, id));
    await tx.delete(betaFeedback).where(eq(betaFeedback.userId, id));
    await tx.delete(accessPassRedemptions).where(eq(accessPassRedemptions.userId, id));
    await tx.delete(referrals).where(or(eq(referrals.referrerId, id), eq(referrals.referredUserId, id)));
    // Keep the invite record (it belongs to whoever issued it), just forget who redeemed it.
    await tx.update(betaInvites).set({ redeemedBy: null }).where(eq(betaInvites.redeemedBy, id));
    await tx.delete(userProfiles).where(eq(userProfiles.userId, id));
    await tx.delete(subscriptions).where(eq(subscriptions.userId, id));
    if (user.email) await tx.delete(waitlist).where(eq(waitlist.email, user.email));
    await tx.delete(users).where(eq(users.id, id));
  });

  await deps.deleteAuthUser(user.openId);
}
