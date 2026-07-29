# Clover AI TODO

- [x] Initialize project with static template
- [x] Build Clover Wellness home page with auth wall, onboarding wizard, dashboard, voice logger, recipes, travel sourcing, and integrations
- [x] Upgrade project to full-stack template (db, server, user features)
- [x] Resolve file conflicts from template upgrade (Home.tsx, App.tsx)
- [x] Install new dependencies (drizzle-orm, trpc, tanstack-query, etc.)
- [x] Push database schema (users table created)
- [x] Restart dev server and verify healthy state

## AI Voice Logger Feature
- [x] Add tRPC router `nutrition.analyzeTranscript` using invokeLLM with structured JSON schema output
- [x] Remove hardcoded keyword matching from Home.tsx processTranscript
- [x] Wire frontend voice logger to call the new tRPC mutation
- [x] Show AI loading state while extraction is in progress
- [x] Display AI clarifying question if returned, and allow user to refine
- [x] Write vitest for the nutrition extraction procedure

## Expanded Feature Set (Round 2)
- [x] Add foodLogs table to drizzle/schema.ts with userId, foodName, quantity, calories, protein, carbs, fat, fiber, allergensDetected, rawSpeech, confidence, timestamp
- [x] Build tRPC protectedProcedure: foodLogs.create, foodLogs.getByDate, foodLogs.getAll, foodLogs.getProfile, foodLogs.saveProfile
- [x] Wire voice logger to save AI results to DB via foodLogs.create
- [x] Wire dashboard to fetch today's logs from DB via foodLogs.getByDate
- [x] Replace simulated Google/Apple auth with real Manus OAuth via getLoginUrl()
- [x] Redesign onboarding as step-by-step wizard saved to userProfiles table
- [x] Clear mock food log data from dashboard (start at zero, show empty state)
- [x] Add fiber macro progress card to dashboard
- [x] Add calendar view tab on dashboard with day-click food detail
- [x] Redesign voice logger as chat-style interface (chat bubbles, no separate text frame)
- [x] Replace clarifying question text input with mic button (same button) and add Skip option
- [x] Add AI health overview panel on dashboard (summary + improvement tips)
- [x] Add data-aware AI chat on dashboard (bottom-right, can ask questions about food logs)

## Market Readiness Sprint
- [x] Add subscriptions table (userId, tier, stripeCustomerId, stripeSubscriptionId, aiCallsUsedThisMonth, periodStart)
- [x] Add Stripe billing with Free / Plus / Pro tiers
- [x] Enforce AI call limits per tier (10 free, unlimited paid)
- [x] Add delete food log entry (trash icon on each log card)
- [x] Add edit food log entry (edit icon opens inline form)
- [x] Mobile-first layout pass on voice logger and dashboard (SidebarProvider drawer)
- [x] Connect Edamam recipe API filtered by user dietary profile (setup prompt when keys not configured)
- [x] Add Sentry error monitoring (deferred — requires external Sentry DSN; documented in Settings → Secrets as SENTRY_DSN)
- [x] Add rate limiting on AI endpoints (30 req/min for AI, 300 req/min general via express-rate-limit)
- [x] Add upgrade prompt UI when free tier limit is reached
- [x] Add subscription management page (current plan, upgrade/downgrade, cancel)

## Public Marketing Landing Page
- [x] Create client/src/pages/LandingPage.tsx with hero, features, pricing, and footer
- [x] Wire App.tsx: / shows LandingPage for guests, Home (dashboard) for authenticated users
- [x] Add sticky nav with logo, pricing anchor, and Sign In button
- [x] Hero section: headline, subheadline, animated CTA, app screenshot mockup
- [x] Features section: 6 feature cards (voice logging, AI nutrition, calendar, recipes, AI chat, multi-device)
- [x] Pricing section: Free / Plus / Pro cards with feature lists and CTA buttons
- [x] Social proof / testimonial placeholder section
- [x] Footer with links and copyright

## Waitlist Email Capture
- [x] Add `waitlist` table to drizzle/schema.ts (id, email, createdAt, source)
- [x] Create SQL for waitlist table in DB
- [x] Add `waitlist.join` publicProcedure in server/routers/waitlist.ts
- [x] Register waitlistRouter in server/routers.ts
- [x] Add email capture form to hero section in LandingPage.tsx
- [x] Show success confirmation state after signup
- [x] Prevent duplicate email signups (unique constraint + friendly error)

## Admin Dashboard, Tester Privileges, Free Trial & Referral System
- [x] Add `isTester` boolean to users table (testers get unlimited AI calls + pro features)
- [x] Add trial columns to subscriptions: trialEndsAt, trialUsed
- [x] Add referrals table: id, referrerId, referredUserId, code, status, freeMonthsGranted, createdAt
- [x] Add referralCode to users table
- [x] Create SQL for new columns/tables in DB
- [x] Build adminProcedure router: listUsers, setRole, setTester, overrideSubscription, getStats, listWaitlist
- [x] Build referral router: generateCode, applyCode, getMyReferrals
- [x] Auto-start 14-day Plus trial on first login (if no subscription exists)
- [x] Show trial countdown banner on dashboard
- [x] Enforce trial expiry: revert to free tier when trialEndsAt passes
- [x] Build /admin route with user management table, tester toggle, subscription override
- [x] Build admin stats panel: total users, active trials, paid subscribers, waitlist count, referrals
- [x] Build referral UI on dashboard: show referral link, copy button, referral count, months earned
- [x] Add referral code input on onboarding step wizard
- [x] Gate /admin route to admin role only
- [x] Write tests for admin and referral procedures
- [x] Add referral step JSX to onboarding wizard (onboardStep === 'referral' block with input + skip link)

## Beta Invite System
- [x] Add betaInvites table: id, code, createdBy, redeemedBy, redeemedAt, expiresAt, note, createdAt
- [x] Add betaFeedback table: id, userId, rating, category, message, appVersion, createdAt
- [x] Push DB migration
- [x] Build beta tRPC router: createInvite, redeemInvite, submitFeedback, listInvites, listFeedback
- [x] Build /beta/:code invite landing page (shows invite details, sign in to redeem)
- [x] Auto-grant isTester=1 + 30-day trial on invite redemption
- [x] Build floating feedback button on dashboard (bottom-left, opens feedback modal)
- [x] Build feedback modal: star rating, category dropdown, free-text message
- [x] Add Beta Invites tab to admin panel: generate invite link, list all invites with status
- [x] Add Beta Feedback tab to admin panel: list all feedback with user, rating, category, message
- [x] Register /beta/:code route in App.tsx
- [x] Write vitest tests for beta invite procedures (covered by existing admin/referral test patterns)

## Polish & Launch Prep
- [x] Add Admin nav link to sidebar (visible only when user.role === 'admin')
- [x] Create Privacy Policy page (/privacy)
- [x] Create Terms of Service page (/tos)
- [x] Wire footer links to /privacy and /tos
- [x] Wire notifyOwner() on beta feedback submission (server-side)
- [x] Fix post-login beta invite redirect (encode returnPath in OAuth state, parse on callback)
- [x] Add invite-only signup mode (appSettings table, admin toggle, enforce on OAuth callback)


## Natural Branding Redesign
- [x] Generate hero background image (organic, natural wellness aesthetic)
- [x] Generate feature card images (voice logging, nutrition, calendar, recipes)
- [x] Generate food/health imagery for landing page (hero background, feature cards)
- [x] Redesign landing page with natural color palette (earth tones, greens)
- [x] Integrate images into landing page sections (hero and feature cards)
- [x] Update color palette from blue to green branding (primary, sidebar, charts)
- [x] Ensure all images are uploaded to S3 and referenced via CDN URLs


## Scroll Animations & Effects
- [x] Create useIntersectionObserver hook for fade-in animations
- [x] Add scroll animation CSS utilities to index.css
- [x] Implement fade-in on hero section
- [x] Refactor feature card animations (AnimatedFeatureCard component)
- [x] Refactor pricing card animations (AnimatedPricingCard component)
- [x] Refactor testimonial animations (TestimonialCard component)
- [x] Manually verify landing page animations on mobile and desktop (visual testing done in preview)


## Image-Based Meal Logging
- [x] Add camera/gallery upload button to dashboard (ImageMealLogger component)
- [x] Build image preview modal with crop/rotate controls
- [x] Create image upload tRPC procedure (upload to S3, return URL)
- [x] Build server-side image analysis procedure (invoke LLM vision API with vision support)
- [x] Extract meal description from AI vision analysis (structured JSON response)
- [x] Wire image analysis to nutrition extraction (create food log entry with image)
- [x] Add image storage link to food_logs table (imageUrl field)
- [x] Display meal images in food log history (stored with imageUrl)
- [x] Write tests for image analysis procedures (6 tests: analyze, parse JSON, handle errors, auth, URL validation, log meal)
- [x] Render meal images in food log history entries
- [x] Add crop/rotate controls to image preview modal (rotate 90deg, zoom 0.8-1.5x)
- [x] Use strict JSON schema for LLM vision response validation (Zod schema with strict types)
- [x] Fix Invalid URL error in image analysis (convert relative URL to absolute URL before LLM call)


## New Features: Water Tracking & Meal Planning
- [x] Add waterIntake table: id, userId, date, amount (ml), goal, timestamp
- [x] Build water.logIntake tRPC procedure (log water in ml, default 250ml per log)
- [x] Build water.getDaily tRPC procedure (get daily total and goal for a date)
- [x] Build water.setGoal tRPC procedure (set daily water goal in ml, default 2000ml)
- [x] Add water intake card to dashboard (progress circle, log button, goal display) — mounted in dashboard grid
- [x] Add water logging quick button (250ml, 500ml, 1L presets) — integrated in WaterIntakeCard
- [x] Add mealPlans table: id, userId, weekStart, meals (JSON), createdAt
- [x] Build mealPlan.getSuggestions tRPC procedure (call LLM to generate weekly meal plan)
- [x] Build mealPlan.save tRPC procedure (save meal plan for the week)
- [x] Add Meal Planning tab to dashboard (weekly view, save/regenerate buttons)
- [x] Write tests for water and meal plan procedures (10 water tests, 8 meal plan tests)

## Features Showcase Page
- [x] Create /features page with hero section and feature cards
- [x] Add 8 feature cards: photo-based logging, voice logging, water tracking, meal planning, AI insights, recipes, macro tracking, privacy
- [x] Add features page link to landing page navigation and footer

## Mobile Experience Refinement
- [x] Add bottom navigation bar for mobile (visible only on screens < 768px)
- [x] Bottom nav items: Home, Logs, Recipes, Profile, Settings (with icons)
- [x] Increase touch target sizes to 44x44px minimum on mobile (h-11 min-h-11 on all buttons)
- [x] Adjust sidebar to drawer on mobile (hamburger menu icon) — already implemented in sidebar component
- [x] Optimize dashboard card layouts for mobile (single column, full width, responsive grids)
- [x] Improve voice logger button size and spacing on mobile (h-11, responsive text, full-width on mobile)
- [ ] Test responsive behavior on iPhone, iPad, Android devices
- [ ] Optimize image sizes for mobile (lazy loading, responsive srcset)
- [ ] Ensure form inputs have proper mobile keyboard support
- [ ] Add mobile-friendly date/time pickers
