# Clover AI

**AI-powered nutrition tracking that works the way you talk.**

Describe a meal in plain language — spoken, typed, or as a photo — and Clover extracts the nutrition, timestamps it sensibly, and quietly builds a picture of how you eat and feel over time. No calorie courtroom, no streaks, no guilt about missed days.

> "I had oatmeal with walnuts this morning, and a turkey sandwich for lunch"
> → two logged meals, each with macros, 15 estimated vitamins & minerals, rough meal-time placement, and allergen flags — in one message.

**Try it live:** the landing page has a no-signup guest demo (10 free AI analyses).

---

## What it does

- **Conversational logging** — one chat that both logs food *and* answers questions. "Why am I so tired lately?" gets a real answer grounded in your own data (e.g. below-range iron estimates), with honest caveats about what isn't tracked, and never a diagnosis.
- **Multi-modal input** — voice (Web Speech API), typed text, or meal photos (vision analysis).
- **Multi-meal parsing with time awareness** — one message can log several meals; "this morning" lands around 8:00, "last night" lands yesterday evening. It never asks you for clock times.
- **Nutrient tracking** — macros plus a 15-nutrient vitamin/mineral panel estimated per meal, aggregated against typical adult reference ranges. Clearly labeled as estimates, never framed as pass/fail.
- **Mood & feeling tracker** — optional two-axis check-ins (energy / ease), plus passive extraction: "stress ate a whole sleeve of crackers" quietly tags the context for your trends view, never commented on in chat, one tap to disable.
- **Weekly compassionate report** — a shareable one-page summary written like a supportive friend, not a lab report. Days without logs are simply absent — never zeros, never red.
- **Guest demo mode** — anonymous sessions with a server-enforced 10-analysis cap, so anyone can try the real product in under a minute.

## AI engineering notes

The interesting decisions, briefly:

- **Structured outputs with a validation boundary.** Every chat message goes through one Claude call returning strict JSON (meals array, conversational reply, mood context, clarifying question). The response is Zod-validated server-side before anything touches the database — model output is treated as untrusted input.
- **Context injection over tool-calling.** For symptom questions, the server pre-builds a compact context block (recent logs, nutrient averages, explicit data-coverage gaps) rather than running an agentic tool loop. One round-trip, predictable latency, easy to guardrail. The threshold for switching to tool-calling/MCP is documented in the context builder.
- **One clarification, ever.** Ambiguous meals get at most one bundled clarifying question — which always ends with an offer to just log the best guess. A client-side round counter backstops the prompt.
- **Tone as a constraint, not a vibe.** Weekly-report and insight-card copy comes from a fixed, reviewed template library selected by computed patterns — not open-ended generation — so the "knowledgeable friend" voice can't drift into moralizing.
- **First-party analytics.** A single `events` table plus a Postgres view computes the beta's D14 retention metric with plain SQL. No third-party analytics SDK.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, Tailwind 4, shadcn/ui, Recharts, wouter |
| API | Express 4 + tRPC 11 (end-to-end types, superjson) |
| AI | Anthropic Messages API (direct HTTPS, custom wrapper) |
| Database | PostgreSQL (Supabase) via Drizzle ORM |
| Auth | Supabase Auth — GitHub OAuth + anonymous guest sessions |
| Storage | Supabase Storage (meal photos, signed URLs) |
| Payments | Stripe (subscriptions + webhooks) |
| Hosting | Railway (persistent Node server) |

## Local development

```bash
pnpm install
cp .env.example .env   # fill in Supabase, Anthropic, Stripe keys
pnpm db:push           # apply Drizzle migrations
pnpm dev               # http://localhost:3000
```

Node ≥ 22. Tests: `pnpm test` · Typecheck: `pnpm check` · Production build: `pnpm build && pnpm start`.

## Repo tour

```
server/routers/nutrition.ts   The chat brain: meals + reply + mood context, one structured call
server/_core/llm.ts           Anthropic API wrapper (OpenAI-shaped interface, JSON-schema outputs)
server/log-context.ts         User-data context block + symptom guardrails for every AI surface
server/weekly-export.ts       Pattern analysis + fixed template library for the weekly report
server/mood-insights.ts       Tone-controlled mood insight cards
server/nutrients.ts           The 15-nutrient panel + reference ranges (everything derives from this)
drizzle/schema.ts             Postgres schema (users, foodLogs, moodEntries, events, accessPasses…)
client/src/pages/Home.tsx     The app: chat logger, trends, weekly report, settings
```
