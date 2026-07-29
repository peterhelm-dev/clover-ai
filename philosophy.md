# Clover AI: Product Philosophy

Most food-tracking apps are built around a spreadsheet mindset: log every gram, hit your targets, feel bad when you miss a day. That model burns people out. Clover is built on the opposite premise — **logging should take seconds, and the app should never make you feel judged for a missed day.**

---

## 1. The Core Principles

### A. Say it, don't enter it
The primary interaction is a chat: speak or type what you ate, in your own words ("had a big bowl of oatmeal with walnuts this morning"). Clover extracts the food, quantities, macros, and a full vitamin/mineral estimate — no dropdowns, no per-ingredient forms, no barcode scanning.

### B. Logging is retrospective-friendly
Real life doesn't happen in real time. Clover treats a single message describing several meals ("oatmeal this morning, sandwich for lunch") as first-class, splitting it into separate logs with rough time-of-day placement (breakfast ≈ 8:00, lunch ≈ 12:30, etc.) — never demanding an exact clock time.

### C. Inform without shaming
No streaks. No red bars for missed days. No "you failed to hit your protein goal" framing. Trends are computed only over the days you actually logged, and that's stated explicitly rather than hidden. A partial week still produces a positive, useful picture.

### D. The AI is a companion, not a form processor
The same chat that logs your food also answers questions about it — "how's my iron been this week?", "why am I so tired lately?" — grounded in your real logged data, not generic advice. It's one conversation, not a logger bolted onto a separate chatbot.

### E. Route to humans when it matters
Clover will point at plausible nutritional patterns (e.g. estimated iron running low), but it will never diagnose a deficiency or condition. Intake estimates aren't lab values, and unlogged days and untracked factors (sleep, stress, activity) are stated as real gaps. Persistent symptoms get pointed at a doctor, with the weekly report offered as something to bring along.

### F. Tone is engineered, not improvised
The weekly report and mood insight cards are generated from a fixed, reviewed template library selected by computed patterns — not open-ended generation. This is deliberate: it guarantees the "supportive friend" voice can't drift into a lab-report or scolding tone as usage scales.

---

## 2. What "curated" means here

Clover doesn't curate *ingredients* or *sourcing* — it curates the **experience of tracking**:

| Generic food-logging app | Clover |
| :--- | :--- |
| Manual entry, per-ingredient, per-meal | One sentence or photo logs a full meal — or several |
| Calorie/macro targets shown as pass/fail | Trends shown as direction, only over logged days |
| Chatbot bolted on as a separate feature | One chat that logs *and* answers questions |
| Generic "eat more protein" advice | Advice grounded in your actual estimated intake, with stated data limits |
| Missed days shown as broken streaks | Missed days are simply absent from the picture |

---

## 3. Open surface for the next iteration

- **Timezone-aware day boundaries** — currently UTC by default; per-user IANA timezones are schema-ready but not yet populated by onboarding.
- **Weekly export mood section** — mood/feeling data isn't in the shareable PDF yet by design (kept private-only until validated with real usage).
- **Wearables / sleep tracking** — explicitly named as a current gap in every AI response that touches on energy or fatigue, rather than silently ignored.
