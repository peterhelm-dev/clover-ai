import { describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import { deleteUserAccount, type AccountDeletionDeps } from "./account-deletion";
import { appRouter } from "./routers";

function fakeDb(subscriptionId: string | null, calls: string[]) {
  const tx = {
    delete: (table: any) => ({
      where: async () => calls.push(`delete:${getTableName(table)}`),
    }),
    update: (table: any) => ({
      set: () => ({ where: async () => calls.push(`update:${getTableName(table)}`) }),
    }),
  };
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => (subscriptionId ? [{ stripeSubscriptionId: subscriptionId }] : []),
        }),
      }),
    }),
    transaction: async (fn: (t: typeof tx) => Promise<void>) => {
      calls.push("tx:begin");
      await fn(tx);
      calls.push("tx:commit");
    },
  };
}

function makeDeps(calls: string[], subscriptionId: string | null = "sub_123", overrides: Partial<AccountDeletionDeps> = {}) {
  return {
    getDb: async () => fakeDb(subscriptionId, calls) as any,
    cancelStripeSubscription: vi.fn(async (id: string) => void calls.push(`stripe:${id}`)),
    deleteStoragePrefix: vi.fn(async (prefix: string) => void calls.push(`storage:${prefix}`)),
    deleteAuthUser: vi.fn(async (id: string) => void calls.push(`auth:${id}`)),
    ...overrides,
  } satisfies AccountDeletionDeps;
}

const user = { id: 42, openId: "auth-uuid", email: "someone@example.com" };

describe("deleteUserAccount", () => {
  it("cancels billing, removes photos, deletes all rows, then the auth user", async () => {
    const calls: string[] = [];
    await deleteUserAccount(user, makeDeps(calls));

    expect(calls[0]).toBe("stripe:sub_123");
    expect(calls[1]).toBe("storage:meals/42");
    expect(calls[2]).toBe("tx:begin");
    expect(calls[3]).toBe("delete:events"); // FK to users, must precede the users delete
    expect(calls.at(-3)).toBe("delete:users");
    expect(calls.at(-2)).toBe("tx:commit");
    expect(calls.at(-1)).toBe("auth:auth-uuid");
    for (const table of ["foodLogs", "moodEntries", "subscriptions", "userProfiles", "waitlist", "referrals"]) {
      expect(calls).toContain(`delete:${table}`);
    }
    expect(calls).toContain("update:betaInvites");
  });

  it("skips Stripe when there is no paid subscription", async () => {
    const calls: string[] = [];
    const deps = makeDeps(calls, null);
    await deleteUserAccount(user, deps);
    expect(deps.cancelStripeSubscription).not.toHaveBeenCalled();
    expect(calls).toContain("delete:users");
  });

  it("leaves the database untouched if cancelling billing fails", async () => {
    const calls: string[] = [];
    const deps = makeDeps(calls, "sub_123", {
      cancelStripeSubscription: async () => {
        throw new Error("stripe down");
      },
    });
    await expect(deleteUserAccount(user, deps)).rejects.toThrow("stripe down");
    expect(calls).not.toContain("tx:begin");
    expect(deps.deleteAuthUser).not.toHaveBeenCalled();
  });
});

describe("auth.deleteAccount", () => {
  it("requires the literal DELETE confirmation", async () => {
    const caller = appRouter.createCaller({
      user: { id: 1, openId: "x", email: null, role: "user" },
      req: { headers: {} },
      res: {},
    } as any);
    await expect(caller.auth.deleteAccount({ confirm: "delete" as any })).rejects.toThrow();
  });
});
