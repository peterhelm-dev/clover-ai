CREATE TYPE "public"."beta_status" AS ENUM('active', 'ended');--> statement-breakpoint
CREATE TYPE "public"."payout_method" AS ENUM('paypal', 'venmo');--> statement-breakpoint
ALTER TYPE "public"."tier" ADD VALUE 'beta';--> statement-breakpoint
CREATE TABLE "betaEnrollments" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"status" "beta_status" DEFAULT 'active' NOT NULL,
	"startedAt" timestamp DEFAULT now() NOT NULL,
	"endsAt" timestamp NOT NULL,
	"endedAt" timestamp,
	"aiCallsDay" varchar(10),
	"aiCallsToday" integer DEFAULT 0 NOT NULL,
	"aiCallsTotal" integer DEFAULT 0 NOT NULL,
	"activeDays" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"lastDailyEmailOn" varchar(10),
	"endEmailSentAt" timestamp,
	"feedbackReminderSentAt" timestamp,
	"emailOptOut" integer DEFAULT 0 NOT NULL,
	"feedbackSubmittedAt" timestamp,
	"feedback" jsonb,
	"payoutMethod" "payout_method",
	"payoutHandle" varchar(128),
	"paidAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "betaEnrollments_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
ALTER TABLE "appSettings" ADD COLUMN "betaSpots" integer DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE "appSettings" ADD COLUMN "betaOpen" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE INDEX "beta_enrollments_status_idx" ON "betaEnrollments" USING btree ("status");--> statement-breakpoint
-- Same lock-down as 0008: testers' payout handles and feedback must never be
-- readable through the public anon key. The server's postgres role bypasses RLS.
REVOKE ALL ON TABLE "betaEnrollments" FROM anon, authenticated;--> statement-breakpoint
ALTER TABLE "betaEnrollments" ENABLE ROW LEVEL SECURITY;
