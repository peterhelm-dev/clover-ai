import { ForbiddenError } from "@shared/_core/errors";
import { eq } from "drizzle-orm";
import type { Request } from "express";
import { appSettings, betaInvites, users, type User } from "../../drizzle/schema";
import * as db from "../db";
import { getDb } from "../db";
import { ENV } from "./env";
import { getSupabaseAuthClient } from "./supabaseAdmin";

function getBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

function getInviteCodeHeader(req: Request): string | undefined {
  const value = req.headers["x-invite-code"];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function deriveLoginMethod(user: {
  app_metadata?: { provider?: string | null } | null;
  is_anonymous?: boolean;
}): string | null {
  if (user.is_anonymous) return "anonymous";
  return user.app_metadata?.provider ?? null;
}

/**
 * The owner's email always carries admin + unlimited AI, regardless of which
 * provider they signed in with (GitHub today, Google tomorrow). Runs on every
 * request but only writes when the row is missing the privileges.
 */
async function ensureOwnerPrivileges(user: User): Promise<User> {
  if (!ENV.ownerEmail || user.email !== ENV.ownerEmail) return user;
  if (user.isTester === 1 && user.role === "admin") return user;
  const dbConn = await getDb();
  if (!dbConn) return user;
  await dbConn
    .update(users)
    .set({ isTester: 1, role: "admin" })
    .where(eq(users.id, user.id));
  return { ...user, isTester: 1, role: "admin" };
}

/**
 * Validates the Supabase-issued access token on the request, syncs the
 * corresponding row in our own `users` table, and returns it. Returns
 * `null` when there's no (or an invalid) session — callers treat that as
 * "not logged in", which is fine for public procedures.
 */
export async function authenticateRequest(req: Request): Promise<User | null> {
  const token = getBearerToken(req);
  if (!token) return null;

  const { data, error } = await getSupabaseAuthClient().auth.getUser(token);
  if (error || !data.user) return null;

  const supabaseUser = data.user;
  const openId = supabaseUser.id;
  const signedInAt = new Date();

  let user = await db.getUserByOpenId(openId);

  if (!user) {
    // New user — check invite-only mode before creating the local row.
    // Anonymous guests bypass the invite gate by design: they're the public
    // demo path and are hard-capped at GUEST_AI_LIMIT analyses.
    const dbConn = await getDb();
    const inviteCode = getInviteCodeHeader(req);
    const isGuest = !!supabaseUser.is_anonymous;

    if (dbConn && !isGuest) {
      const [settings] = await dbConn.select().from(appSettings).limit(1);
      if (settings?.inviteOnly === 1) {
        if (!inviteCode) {
          throw ForbiddenError("This app is invite-only. You need a valid invite code to sign up.");
        }
        const [invite] = await dbConn
          .select()
          .from(betaInvites)
          .where(eq(betaInvites.code, inviteCode));
        if (!invite || invite.redeemedBy || new Date(invite.expiresAt) < new Date()) {
          throw ForbiddenError("Invalid or expired invite code");
        }
      }
    }

    const name =
      (supabaseUser.user_metadata?.full_name as string | undefined) ??
      (supabaseUser.user_metadata?.name as string | undefined) ??
      (isGuest ? "Guest" : null);

    await db.upsertUser({
      openId,
      name,
      email: supabaseUser.email ?? null,
      loginMethod: deriveLoginMethod(supabaseUser),
      lastSignedIn: signedInAt,
    });

    user = await db.getUserByOpenId(openId);

    if (user && dbConn && inviteCode) {
      await dbConn
        .update(betaInvites)
        .set({ redeemedBy: user.id, redeemedAt: signedInAt })
        .where(eq(betaInvites.code, inviteCode));
    }
  } else {
    await db.upsertUser({ openId, lastSignedIn: signedInAt });
    user = await db.getUserByOpenId(openId);
  }

  if (!user) throw ForbiddenError("Failed to sync user info");

  return ensureOwnerPrivileges(user);
}
