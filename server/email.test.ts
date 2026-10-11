import { describe, expect, it } from "vitest";

describe("beta email unsubscribe tokens", () => {
  it("round-trips and rejects tampering", async () => {
    process.env.EMAIL_LINK_SECRET = "unit-test-secret";
    const { signUnsubscribeToken, verifyUnsubscribeToken } = await import("./email");
    const token = signUnsubscribeToken(42);
    expect(verifyUnsubscribeToken(token)).toBe(42);
    expect(verifyUnsubscribeToken(token.replace(/^42\./, "43."))).toBeNull();
    expect(verifyUnsubscribeToken("42.not-a-real-signature")).toBeNull();
    expect(verifyUnsubscribeToken("")).toBeNull();
  });
});
