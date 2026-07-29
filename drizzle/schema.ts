import {
  bigint,
  bigserial,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const roleEnum = pgEnum("role", ["user", "admin"]);
export const confidenceEnum = pgEnum("confidence", ["high", "medium", "low"]);
/**
 * How a food log was captured. 'text' covers typed entries — historically
 * indistinguishable from voice (both land in rawSpeech), so pre-migration
 * non-photo rows stay null rather than guessing.
 */
export const logMethodEnum = pgEnum("log_method", ["voice", "photo", "text"]);
/** Failed parses must not count as a "logged day" for D14 retention. */
export const logStatusEnum = pgEnum("log_status", ["success", "failed"]);
/**
 * Fixed goal set driving weekly-export highlights (golden-path spec 2.5).
 * The enum carries the full expanded set, but a goal is only selectable in
 * the UI once its template copy exists — goals without templates fall back
 * to general_awareness templates rather than shipping with no matching copy.
 */
export const primaryGoalEnum = pgEnum("primary_goal", [
  "weight_management",
  "muscle_gain",
  "protein_focus",
  "energy_levels",
  "blood_sugar_awareness",
  "digestive_health",
  "general_awareness",
]);
export const tierEnum = pgEnum("tier", ["free", "plus", "pro"]);
export const referralStatusEnum = pgEnum("referral_status", ["pending", "credited"]);
export const feedbackCategoryEnum = pgEnum("feedback_category", [
  "general",
  "bug",
  "feature_request",
  "ux",
  "performance",
]);

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = pgTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: serial("id").primaryKey(),
  /** Supabase Auth user id (uuid, from auth.users.id / JWT `sub` claim). Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  /** Testers get unlimited AI calls and Pro features regardless of subscription tier */
  isTester: integer("isTester").default(0).notNull(), // 0=false, 1=true
  /** Unique referral code for this user (generated on first login) */
  referralCode: varchar("referralCode", { length: 16 }).unique(),
  /**
   * IANA timezone name for day-boundary calculations (user_d14_retention view).
   * Null → UTC. Not yet populated by the app — known approximation per the
   * D14 spec until timezone capture is added.
   */
  timezone: varchar("timezone", { length: 64 }),
  /** Drives weekly-export highlight selection. Set at onboarding, editable in Settings. */
  primaryGoal: primaryGoalEnum("primaryGoal").default("general_awareness").notNull(),
  /** Daily reminder opt-in. Default off — user owns notifications (golden-path principle). */
  reminderEnabled: integer("reminderEnabled").default(0).notNull(), // 0=false, 1=true
  /** "HH:MM" 24h local time for the daily reminder. Null unless the user set one. */
  reminderTime: varchar("reminderTime", { length: 5 }),
  /** Weekly export email opt-in — independent of the daily reminder, never bundled. */
  weeklyExportEmail: integer("weeklyExportEmail").default(0).notNull(), // 0=false, 1=true
  /**
   * Passive mood extraction from chat messages. Default ON per the mood spec,
   * discoverable and one-tap to disable in Settings. Manual check-ins work
   * regardless of this setting.
   */
  moodExtractionEnabled: integer("moodExtractionEnabled").default(1).notNull(), // 0=false, 1=true
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ---------------------------------------------------------------------------
// User health profiles (onboarding data)
// ---------------------------------------------------------------------------
export const userProfiles = pgTable("userProfiles", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().unique(),
  age: integer("age"),
  weightLbs: numeric("weightLbs", { precision: 6, scale: 2 }),
  allergies: jsonb("allergies").$type<string[]>().default([]),
  dietaryChoices: jsonb("dietaryChoices").$type<string[]>().default([]),
  healthConditions: jsonb("healthConditions").$type<string[]>().default([]),
  calorieTarget: integer("calorieTarget").default(2000),
  proteinTarget: integer("proteinTarget").default(120),
  carbsTarget: integer("carbsTarget").default(200),
  fatTarget: integer("fatTarget").default(65),
  fiberTarget: integer("fiberTarget").default(28),
  onboardingComplete: integer("onboardingComplete").default(0), // 0=false, 1=true
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = typeof userProfiles.$inferInsert;

// ---------------------------------------------------------------------------
// Food logs (one row per AI-analyzed meal entry)
// ---------------------------------------------------------------------------
export const foodLogs = pgTable("foodLogs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: integer("userId").notNull(),
  rawSpeech: text("rawSpeech"),
  imageUrl: text("imageUrl"), // Supabase Storage URL if logged from image
  foodName: varchar("foodName", { length: 255 }).notNull(),
  quantity: varchar("quantity", { length: 255 }),
  calories: numeric("calories", { precision: 8, scale: 2 }).default("0"),
  protein: numeric("protein", { precision: 8, scale: 2 }).default("0"),
  carbs: numeric("carbs", { precision: 8, scale: 2 }).default("0"),
  fat: numeric("fat", { precision: 8, scale: 2 }).default("0"),
  fiber: numeric("fiber", { precision: 8, scale: 2 }).default("0"),
  allergensDetected: jsonb("allergensDetected").$type<string[]>().default([]),
  /**
   * Rough AI-estimated micronutrients for this meal. Keys are fixed
   * (see MICRONUTRIENT_KEYS in server/routers/nutrition.ts): iron_mg,
   * magnesium_mg, vitamin_b12_mcg, vitamin_d_mcg, potassium_mg, calcium_mg,
   * zinc_mg, sodium_mg. Null for logs made before micro tracking existed.
   */
  micronutrients: jsonb("micronutrients").$type<Record<string, number>>(),
  confidence: confidenceEnum("confidence").default("medium"),
  notes: text("notes"),
  /** Null for pre-migration rows where voice vs typed is unknowable (photo rows were backfilled). */
  logMethod: logMethodEnum("logMethod"),
  /** Rows are only inserted after successful analysis, so 'success' is the correct default. */
  status: logStatusEnum("status").default("success").notNull(),
  loggedAt: timestamp("loggedAt").defaultNow().notNull(),
});

export type FoodLog = typeof foodLogs.$inferSelect;
export type InsertFoodLog = typeof foodLogs.$inferInsert;

// ---------------------------------------------------------------------------
// Subscriptions (Stripe billing)
// ---------------------------------------------------------------------------
export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().unique(),
  tier: tierEnum("tier").default("free").notNull(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 128 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 128 }),
  aiCallsUsedThisMonth: integer("aiCallsUsedThisMonth").default(0).notNull(),
  periodStart: timestamp("periodStart").defaultNow().notNull(),
  /** Trial support: Plus trial auto-started on first login */
  trialEndsAt: timestamp("trialEndsAt"),
  trialUsed: integer("trialUsed").default(0).notNull(), // 0=never used, 1=used
  /** Free months credited from referrals (each = 1 month of Pro) */
  freeMonthsRemaining: integer("freeMonthsRemaining").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

// ---------------------------------------------------------------------------
// Waitlist (pre-launch email capture)
// ---------------------------------------------------------------------------
export const waitlist = pgTable("waitlist", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  source: varchar("source", { length: 64 }).default("landing_hero").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Waitlist = typeof waitlist.$inferSelect;
export type InsertWaitlist = typeof waitlist.$inferInsert;

// ---------------------------------------------------------------------------
// Referrals (one row per successful referred signup)
// ---------------------------------------------------------------------------
export const referrals = pgTable("referrals", {
  id: serial("id").primaryKey(),
  /** The user who shared their referral code */
  referrerId: integer("referrerId").notNull(),
  /** The new user who signed up using the code */
  referredUserId: integer("referredUserId").notNull().unique(),
  /** The referral code that was used */
  code: varchar("code", { length: 16 }).notNull(),
  /** Whether the free month has been credited to the referrer */
  status: referralStatusEnum("status").default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Referral = typeof referrals.$inferSelect;
export type InsertReferral = typeof referrals.$inferInsert;

// ---------------------------------------------------------------------------
// Beta Invites (admin-generated single-use invite links)
// ---------------------------------------------------------------------------
export const betaInvites = pgTable("betaInvites", {
  id: serial("id").primaryKey(),
  /** Unique token used in the invite URL: /beta/:code */
  code: varchar("code", { length: 32 }).notNull().unique(),
  /** Admin user who created this invite */
  createdBy: integer("createdBy").notNull(),
  /** User who redeemed this invite (null until redeemed) */
  redeemedBy: integer("redeemedBy"),
  redeemedAt: timestamp("redeemedAt"),
  /** Optional label/note for the invite (e.g. "For Alice - beta group 1") */
  note: varchar("note", { length: 255 }),
  /** When the invite expires (default 30 days from creation) */
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BetaInvite = typeof betaInvites.$inferSelect;
export type InsertBetaInvite = typeof betaInvites.$inferInsert;

// ---------------------------------------------------------------------------
// Beta Feedback (submitted by beta testers via the in-app feedback form)
// ---------------------------------------------------------------------------
export const betaFeedback = pgTable("betaFeedback", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  /** 1–5 star rating */
  rating: integer("rating").notNull(),
  /** Category of feedback */
  category: feedbackCategoryEnum("category").default("general").notNull(),
  /** Free-text feedback message */
  message: text("message").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BetaFeedback = typeof betaFeedback.$inferSelect;
export type InsertBetaFeedback = typeof betaFeedback.$inferInsert;

// ---------------------------------------------------------------------------
// App Settings (admin-configurable app-wide settings)
// ---------------------------------------------------------------------------
export const appSettings = pgTable("appSettings", {
  id: serial("id").primaryKey(),
  /** If true, only users with valid beta invites can sign up */
  inviteOnly: integer("inviteOnly").default(0).notNull(), // 0=false, 1=true
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type AppSettings = typeof appSettings.$inferSelect;
export type InsertAppSettings = typeof appSettings.$inferInsert;

// ---------------------------------------------------------------------------
// Water Intake Tracking (daily water consumption logging)
// ---------------------------------------------------------------------------
export const waterIntake = pgTable("waterIntake", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  /** Date for this water log (YYYY-MM-DD) */
  date: varchar("date", { length: 10 }).notNull(),
  /** Amount of water logged in milliliters */
  amount: integer("amount").notNull(), // in ml
  /** Daily water goal in milliliters (default 2000ml) */
  goal: integer("goal").default(2000).notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export type WaterIntake = typeof waterIntake.$inferSelect;
export type InsertWaterIntake = typeof waterIntake.$inferInsert;

// ---------------------------------------------------------------------------
// Meal Plans (weekly meal planning suggestions)
// ---------------------------------------------------------------------------
export const mealPlans = pgTable("mealPlans", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  /** Start date of the week (YYYY-MM-DD) */
  weekStart: varchar("weekStart", { length: 10 }).notNull(),
  /** JSON array of meal suggestions for the week */
  meals: jsonb("meals").$type<Array<{
    day: string;
    breakfast: string;
    lunch: string;
    dinner: string;
    snack?: string;
  }>>().default([]),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type MealPlan = typeof mealPlans.$inferSelect;
export type InsertMealPlan = typeof mealPlans.$inferInsert;

// ---------------------------------------------------------------------------
// Events (lean first-party instrumentation — clover-instrumentation-spec.md)
// One table for all event types; extend by logging a new event_name, no
// migration needed. food_logs remains the source of truth for D14 — events
// exist for funnel analysis, not as the primary activity record.
// Adapted from the spec's SQL: user_id is integer (our users PK), not uuid.
// ---------------------------------------------------------------------------
export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: integer("user_id").references(() => users.id),
    eventName: text("event_name").notNull(),
    properties: jsonb("properties").default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  table => [
    index("events_user_id_idx").on(table.userId),
    index("events_event_name_idx").on(table.eventName),
    index("events_created_at_idx").on(table.createdAt),
  ]
);

export type Event = typeof events.$inferSelect;
export type InsertEvent = typeof events.$inferInsert;

// ---------------------------------------------------------------------------
// Mood entries (mood & feeling tracker spec)
// Two-axis soft model (energy / ease), never a single good-bad score.
// Adapted from the spec for this schema: integer PKs/FKs (not uuid), and
// sourceText replaces linked_chat_message_id because chat messages are
// client-side only — the raw message text serves the same audit purpose.
// ---------------------------------------------------------------------------
export const moodSourceEnum = pgEnum("mood_source", [
  "manual_checkin",
  "chat_extracted",
  "retrospective",
]);

export const moodEntries = pgTable(
  "moodEntries",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    source: moodSourceEnum("source").notNull(),
    /** Soft feeling tags — free-form or from the suggested set. Never a forced score. */
    feelingTags: jsonb("feelingTags").$type<string[]>().default([]),
    /** Context tags: stress, social, celebration, tired, routine, ... optional. */
    contextTags: jsonb("contextTags").$type<string[]>().default([]),
    /** Energy axis 1–5 (low ↔ high). Null = not set; null never implies "bad". */
    energy: integer("energy"),
    /** Ease axis 1–5 (tense ↔ at ease). Null = not set. */
    ease: integer("ease"),
    /** Optional 1–5, user never required to set this. */
    intensity: integer("intensity"),
    note: text("note"),
    /** Set when the mood was captured alongside a specific food log. */
    linkedFoodLogId: bigint("linkedFoodLogId", { mode: "number" }),
    /** For chat_extracted rows: the message the tags came from (transparency/audit). */
    sourceText: text("sourceText"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("mood_entries_user_id_idx").on(table.userId),
    index("mood_entries_created_at_idx").on(table.createdAt),
  ]
);

export type MoodEntry = typeof moodEntries.$inferSelect;
export type InsertMoodEntry = typeof moodEntries.$inferInsert;

// ---------------------------------------------------------------------------
// Access Passes — owner-shareable links granting free unlimited AI access,
// revocable at any time. Redeeming sets isTester=1; deactivating a pass
// clears it for that pass's redeemers (unless covered by another active pass).
// ---------------------------------------------------------------------------
export const accessPasses = pgTable("accessPasses", {
  id: serial("id").primaryKey(),
  /** Token used in the share link: /pass/:code */
  code: varchar("code", { length: 32 }).notNull().unique(),
  /** Label for the admin's own bookkeeping, e.g. "For Alice". */
  label: varchar("label", { length: 255 }),
  createdBy: integer("createdBy").notNull(),
  /** 1 = redeemable and privileges live; 0 = revoked. */
  active: integer("active").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AccessPass = typeof accessPasses.$inferSelect;

export const accessPassRedemptions = pgTable(
  "accessPassRedemptions",
  {
    id: serial("id").primaryKey(),
    passId: integer("passId").notNull(),
    userId: integer("userId").notNull(),
    redeemedAt: timestamp("redeemedAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("access_pass_redemptions_pass_user_idx").on(table.passId, table.userId),
    index("access_pass_redemptions_user_idx").on(table.userId),
  ]
);

export type AccessPassRedemption = typeof accessPassRedemptions.$inferSelect;
