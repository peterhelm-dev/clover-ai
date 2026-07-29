# Clover AI: Design Language

This replaces an earlier design-brainstorm doc that was written for a different product concept (a local-food marketplace) and no longer reflects what's built. This is a short reference to the design language actually implemented.

## Current direction: Warm, calm, card-based

- **Palette**: warm green primary (`--primary: green-700` in light mode), soft neutral backgrounds, no dark "performance dashboard" aesthetic. Dark mode swaps to a blue-tinted primary on a near-black background (`client/src/index.css`).
- **Layout**: card-based throughout (shadcn/ui `Card` components), generous rounded corners, soft borders over heavy shadows.
- **Typography**: serif headings (`font-serif`) for warmth on section titles, clean sans-serif body text for readability.
- **Data visualization**: Recharts line/area charts with a single accent color per series, minimal gridlines, no red/green pass-fail coloring — trend lines simply skip days without data rather than showing zeros.
- **Interaction**: quiet by default — no streak counters, no urgency-colored badges, no bulk "approve all" actions. Confirmations (a logged meal, a saved check-in) are a small green check, not a modal.

## Why this replaced the old brainstorm

The original three design concepts here ("Agrarian Editorial," "Neo-Brutalist Harvest," "Warm Tech Craft") were built around a farm/grower marketplace product with role-based dashboards, pickup-window indicators, and match-suggestion UI. None of that exists in Clover AI, which is a single-user AI nutrition and mood tracker. Some of the visual instincts carried over (warm palette, card layouts, soft shadows) — the marketplace-specific interaction patterns did not.

If a future redesign is worth exploring, scope it against the actual product surfaces: the chat logger, the weekly compassionate report, the nutrient panel, and the mood trends view — not a three-sided network UI.
