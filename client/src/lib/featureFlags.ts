/**
 * Single feature-flag config for the beta, per clover-feature-exposure-rules.md.
 *
 * Three tiers:
 *  - Core: the golden path itself — always on, present in onboarding and as
 *    the home screen's dominant CTA.
 *  - Peripheral: built and working, but not under test. The flag being `true`
 *    does NOT grant placement — Peripheral features must stay out of
 *    onboarding, primary nav, and the dominant CTA area, and must not emit
 *    notifications/prompts. Placement is enforced in the components (see the
 *    nav structure in Home.tsx), not by this file.
 *  - Beta-Gated: not ready. Fully off — nav entries removed AND content
 *    render-gated, so a stray state change or deep link can't reach them.
 *    No usage data may be generated for these while off.
 */
export const FEATURE_FLAGS = {
  // Core — always on during beta
  voiceLogging: true,
  photoLogging: true,
  batchLogging: true,
  weeklyExport: true,
  goalSelection: true,
  notificationPreference: true,

  // Peripheral — on, but exposure-restricted (secondary nav only)
  calendarView: true, // also serves as the golden path's "access to past logs"
  curatedRecipes: true,
  mealPlanning: true,
  billing: true,
  aiNutritionChat: true, // floating "Ask Clover" panel
  waterTracking: true, // card on the dashboard
  referralProgram: true,
  betaFeedback: true, // beta ops — floating feedback button stays

  // Beta-Gated — fully off
  travelSourcing: false, // renders mock data only (MOCK_TRAVEL_CALENDAR)
  integrations: false, // connect buttons are "coming soon" stubs
  habitCoachInterventions: false, // does not exist in codebase yet
  multiAgentOrchestrator: false, // does not exist in codebase yet
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

export const isFeatureEnabled = (flag: FeatureFlag): boolean => FEATURE_FLAGS[flag];
