// Runs against a real Postgres with all migrations applied:
//   TEST_DATABASE_URL=postgres://... npx vitest run server/beta-program.integration.test.ts
// Skipped when TEST_DATABASE_URL isn't set (the cap/expiry logic is SQL, so mocks wouldn't prove much).
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite("paid beta program (integration)", () => {
  let beta: typeof import("./beta-program");
  let scheduler: typeof import("./beta-scheduler");
  let db: NonNullable<Awaited<ReturnType<typeof import("./db").getDb>>>;
  let schema: typeof import("../drizzle/schema");
  let orm: typeof import("drizzle-orm");
  let appRouter: typeof import("./routers").appRouter;
  const sent: { to: string; subject: string }[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    process.env.RESEND_API_KEY = "test-key";
    process.env.EMAIL_LINK_SECRET = "test-secret";
    vi.stubGlobal("fetch", async (_u: string, init: { body: string }) => {
      const body = JSON.parse(init.body);
      sent.push({ to: body.to[0], subject: body.subject });
      return new Response("{}", { status: 200 });
    });
    beta = await import("./beta-program");
    scheduler = await import("./beta-scheduler");
    schema = await import("../drizzle/schema");
    orm = await import("drizzle-orm");
    appRouter = (await import("./routers")).appRouter;
    db = (await (await import("./db")).getDb())!;
  });

  beforeEach(async () => {
    sent.length = 0;
    await db.execute(orm.sql`TRUNCATE "betaEnrollments", "subscriptions", "users", "appSettings" RESTART IDENTITY CASCADE`);
  });

  afterAll(() => vi.unstubAllGlobals());

  let n = 0;
  async function makeUser(overrides: Partial<typeof schema.users.$inferInsert> = {}) {
    n++;
    const [u] = await db
      .insert(schema.users)
      .values({ openId: `u${n}-${Date.now()}`, email: `tester${n}@example.com`, name: `Tester ${n}`, loginMethod: "email", ...overrides })
      .returning();
    return u;
  }
  const tierOf = async (userId: number) =>
    (await db.select().from(schema.subscriptions).where(orm.eq(schema.subscriptions.userId, userId)))[0]?.tier;
  const enrollmentOf = async (userId: number) =>
    (await db.select().from(schema.betaEnrollments).where(orm.eq(schema.betaEnrollments.userId, userId)))[0];

  it("joining puts the user on the beta tier for 7 days", async () => {
    const u = await makeUser();
    const now = new Date("2026-10-12T10:00:00Z");
    const e = await beta.joinBeta(u, now);
    expect(await tierOf(u.id)).toBe("beta");
    expect(new Date(e.endsAt).toISOString()).toBe("2026-10-19T10:00:00.000Z");
  });

  it("rejects guests, missing emails and a second join", async () => {
    const guest = await makeUser({ loginMethod: "anonymous" });
    await expect(beta.joinBeta(guest)).rejects.toThrow(/free account/);
    const noEmail = await makeUser({ email: null });
    await expect(beta.joinBeta(noEmail)).rejects.toThrow(/email/);
    const u = await makeUser();
    await beta.joinBeta(u);
    await expect(beta.joinBeta(u)).rejects.toThrow(/already joined/);
  });

  it("closes at the spot limit, even when people join at the same moment", async () => {
    await beta.getProgramSettings();
    await db.update(schema.appSettings).set({ betaSpots: 2 });
    const users = await Promise.all([makeUser(), makeUser(), makeUser(), makeUser()]);
    const results = await Promise.allSettled(users.map((u) => beta.joinBeta(u)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    expect((await beta.getProgramAvailability()).open).toBe(false);
  });

  it("caps AI at 20 a day and 100 a week, and tracks active days", async () => {
    const u = await makeUser();
    const start = new Date("2026-10-12T09:00:00Z");
    await beta.joinBeta(u, start);
    for (let i = 0; i < 20; i++) await beta.consumeBetaAiCall(u.id, start);
    await expect(beta.consumeBetaAiCall(u.id, start)).rejects.toThrow(/today's 20/);

    // Next days: 20 each until the weekly 100 runs out partway through day 5.
    let lastErr: unknown = null;
    for (let d = 1; d < 6 && !lastErr; d++) {
      const day = new Date(start.getTime() + d * 86_400_000);
      for (let i = 0; i < 20; i++) {
        try {
          await beta.consumeBetaAiCall(u.id, day);
        } catch (err) {
          lastErr = err;
          break;
        }
      }
    }
    expect(String(lastErr)).toMatch(/all 100/);
    const e = await enrollmentOf(u.id);
    expect(e.aiCallsTotal).toBe(100);
    expect(e.activeDays).toEqual(["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16"]);
  });

  it("moves the tester to free automatically when the week ends", async () => {
    const u = await makeUser();
    const start = new Date("2026-10-12T09:00:00Z");
    await beta.joinBeta(u, start);
    const after = new Date("2026-10-19T09:00:01Z");
    expect(await beta.consumeBetaAiCall(u.id, after)).toBe(false); // falls through to normal free limits
    expect(await tierOf(u.id)).toBe("free");
    expect((await enrollmentOf(u.id)).status).toBe("ended");
  });

  it("sends one daily email per day, then the end email and one reminder", async () => {
    const u = await makeUser();
    const start = new Date("2026-10-12T09:00:00Z");
    await beta.joinBeta(u, start);

    const day2Early = new Date("2026-10-13T08:00:00Z");
    await scheduler.runBetaTick(day2Early);
    expect(sent).toHaveLength(0); // before the send hour

    const day2 = new Date("2026-10-13T15:00:00Z");
    await scheduler.runBetaTick(day2);
    await scheduler.runBetaTick(new Date("2026-10-13T16:00:00Z"));
    expect(sent.map((s) => s.subject)).toEqual(["Day 2: try a photo"]);

    await scheduler.runBetaTick(new Date("2026-10-19T10:00:00Z")); // week over
    expect(sent.at(-1)?.subject).toBe("Your Clover beta week is done");
    expect(await tierOf(u.id)).toBe("free");

    await scheduler.runBetaTick(new Date("2026-10-20T10:00:00Z")); // < 48h: no reminder yet
    await scheduler.runBetaTick(new Date("2026-10-21T11:00:00Z"));
    await scheduler.runBetaTick(new Date("2026-10-21T12:00:00Z"));
    expect(sent.map((s) => s.subject)).toEqual([
      "Day 2: try a photo",
      "Your Clover beta week is done",
      "Quick reminder: your Clover beta feedback",
    ]);
  });

  it("respects email opt-out", async () => {
    const u = await makeUser();
    await beta.joinBeta(u, new Date("2026-10-12T09:00:00Z"));
    await db.update(schema.betaEnrollments).set({ emailOptOut: 1 });
    await scheduler.runBetaTick(new Date("2026-10-13T15:00:00Z"));
    expect(sent).toHaveLength(0);
  });

  it("final feedback: only from day 7, and payout details only when a payout is configured", async () => {
    const u = await makeUser();
    await beta.joinBeta(u, new Date("2026-10-01T09:00:00Z"));
    const caller = appRouter.createCaller({ user: u, req: { headers: {} }, res: {} } as any);
    const answers = { overallRating: 4, keepUsing: "yes", likedMost: "Voice logging", frustrating: "Photo was slow", wouldPay: "5_to_10" } as const;

    // Week already over (started Oct 1). Make them qualified: 5 active days.
    await db
      .update(schema.betaEnrollments)
      .set({ activeDays: ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05"] });
    const done =
      beta.BETA_PAYOUT_USD > 0
        ? await (async () => {
            await expect(caller.betaProgram.submitFeedback(answers)).rejects.toThrow(/PayPal or Venmo/);
            return caller.betaProgram.submitFeedback({ ...answers, payoutMethod: "venmo", payoutHandle: "@tester" });
          })()
        : await caller.betaProgram.submitFeedback(answers);
    expect(done.payout).toBe(beta.BETA_PAYOUT_USD);
    expect(done.qualified).toBe(true);
    await expect(caller.betaProgram.submitFeedback({ ...answers, payoutMethod: "venmo", payoutHandle: "@tester" })).rejects.toThrow(
      /already sent/
    );

    // An active tester can't submit yet.
    const v = await makeUser();
    await beta.joinBeta(v);
    const callerV = appRouter.createCaller({ user: v, req: { headers: {} }, res: {} } as any);
    await expect(callerV.betaProgram.submitFeedback(answers)).rejects.toThrow(/opens when your beta week ends/);
  });
});
