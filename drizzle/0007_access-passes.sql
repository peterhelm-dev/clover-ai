CREATE TABLE "accessPassRedemptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"passId" integer NOT NULL,
	"userId" integer NOT NULL,
	"redeemedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accessPasses" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(32) NOT NULL,
	"label" varchar(255),
	"createdBy" integer NOT NULL,
	"active" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "accessPasses_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "access_pass_redemptions_pass_user_idx" ON "accessPassRedemptions" USING btree ("passId","userId");--> statement-breakpoint
CREATE INDEX "access_pass_redemptions_user_idx" ON "accessPassRedemptions" USING btree ("userId");