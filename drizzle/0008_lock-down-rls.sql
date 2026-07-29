-- Lock down direct PostgREST access to every application table.
--
-- WHY THIS IS NEEDED
-- Supabase exposes a REST API over these tables to the `anon` and
-- `authenticated` roles, authenticated by the anon key — which ships
-- publicly in the browser bundle by design. Every table had RLS disabled
-- AND full grants (SELECT/INSERT/UPDATE/DELETE/TRUNCATE) to both roles,
-- so anyone with the public key could read every user's email and food
-- logs, or delete the data outright, without logging in at all.
--
-- WHY REVOKING IS SAFE HERE
-- The browser never queries Supabase tables directly — client/src only
-- uses supabase-js for auth (verified: zero `.from()` / `.rpc()` calls).
-- All data access goes through the tRPC server, which connects as the
-- `postgres` role (BYPASSRLS), so it is unaffected by any of this.
--
-- DEFENSE IN DEPTH: we do BOTH.
--   1. REVOKE removes the grants, so PostgREST rejects these roles.
--   2. ENABLE ROW LEVEL SECURITY with no permissive policies means that
--      even if a grant is ever re-added (e.g. by a future migration or a
--      dashboard action), rows still aren't readable by those roles.

-- 1. Revoke all table privileges from the browser-facing roles.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
--> statement-breakpoint
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
--> statement-breakpoint
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;
--> statement-breakpoint

-- 2. Stop future tables/sequences from being auto-granted to those roles.
--    (Supabase's default privileges are what created this situation.)
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
--> statement-breakpoint

-- 3. Enable RLS on every application table. No policies are created, so
--    the default-deny applies to anon/authenticated. The server's
--    `postgres` role bypasses RLS entirely and is unaffected.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "userProfiles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "foodLogs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "moodEntries" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "waterIntake" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "mealPlans" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "accessPasses" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "accessPassRedemptions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "betaInvites" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "betaFeedback" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "appSettings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "referrals" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "waitlist" ENABLE ROW LEVEL SECURITY;
