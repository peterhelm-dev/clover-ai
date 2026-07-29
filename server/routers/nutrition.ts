import { invokeLLM } from "../_core/llm";
import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getOrCreateSubscription, incrementAICallsUsed } from "../db-subscriptions";
import { getAICallLimit, GUEST_AI_LIMIT, GUEST_LIMIT_MESSAGE } from "../products";
import { buildLogContext, SYMPTOM_GUARDRAILS } from "../log-context";
import { MICRONUTRIENT_KEYS } from "../nutrients";

// Re-export for existing importers (foodLogs router, tests).
export { MICRONUTRIENT_KEYS };

const micronutrientSchemaProps = Object.fromEntries(
  MICRONUTRIENT_KEYS.map(k => [
    k,
    { type: "number", description: `Estimated ${k.replace(/_/g, " ")} for this meal` },
  ])
);

/**
 * The structured output schema the LLM must return.
 * One entry per distinct meal/eating occasion in the description, so
 * "oatmeal this morning and a sandwich for lunch" produces two meals,
 * each with its own rough time-of-day placement.
 */
const NUTRITION_JSON_SCHEMA = {
  name: "food_nutrition_extraction",
  strict: true,
  schema: {
    type: "object",
    properties: {
      meals: {
        type: "array",
        description:
          "One entry per distinct meal or eating occasion described. A single meal description = one entry. EMPTY ARRAY when the message contains no food to log (a question, a feeling, a greeting).",
        items: {
          type: "object",
          properties: {
            foodName: {
              type: "string",
              description: "A concise, human-readable name for this meal",
            },
            quantity: {
              type: "string",
              description:
                "Best-estimate quantity/serving size (e.g. '2 large eggs', '1 cup cooked rice')",
            },
            calories: { type: "number", description: "Estimated total calories (kcal)" },
            protein: { type: "number", description: "Estimated protein in grams" },
            carbs: { type: "number", description: "Estimated total carbohydrates in grams" },
            fat: { type: "number", description: "Estimated total fat in grams" },
            fiber: { type: "number", description: "Estimated dietary fiber in grams" },
            micronutrients: {
              type: "object",
              description:
                "Rough micronutrient estimates for this meal based on typical composition. Best-effort estimates are expected — do not omit.",
              properties: micronutrientSchemaProps,
              required: [...MICRONUTRIENT_KEYS],
              additionalProperties: false,
            },
            allergensDetected: {
              type: "array",
              items: { type: "string" },
              description:
                "Common allergens present in this meal ('Gluten', 'Dairy', 'Peanuts', 'Tree Nuts', 'Eggs', 'Soy', 'Shellfish', 'Fish'). Empty array if none.",
            },
            mealPeriod: {
              type: ["string", "null"],
              enum: ["breakfast", "lunch", "dinner", "snack", null],
              description:
                "Time-of-day placement inferred from context ('this morning' → breakfast, 'for lunch' → lunch, 'last night' → dinner). Null when no time context is given.",
            },
            dayOffset: {
              type: "number",
              enum: [0, -1],
              description:
                "0 = today, -1 = yesterday (e.g. 'yesterday for dinner', 'last night'). Default 0.",
            },
          },
          required: [
            "foodName",
            "quantity",
            "calories",
            "protein",
            "carbs",
            "fat",
            "fiber",
            "micronutrients",
            "allergensDetected",
            "mealPeriod",
            "dayOffset",
          ],
          additionalProperties: false,
        },
      },
      reply: {
        type: ["string", "null"],
        description:
          "Conversational response when the message is (or includes) something other than a food description — a question about their data or patterns, a symptom mention ('I'm feeling tired'), a greeting, anything. Ground it in the user's data context. Warm, concise (under 120 words). Null when the message is purely a food log.",
      },
      moodContext: {
        type: ["object", "null"],
        description:
          "Silent pattern-tagging of emotional/contextual language in the message ('ugh, stress ate a whole sleeve of crackers', 'felt great after lunch'). This is NEVER mentioned in reply, notes, or clarifyingQuestion — it is captured quietly for the user's own trends view. Pattern tags only (stress, tiredness, celebration, social, routine, contentment) — never clinical or diagnostic labels, never a good/bad judgment. Null when the message carries no feeling/context language (most messages).",
        properties: {
          feelingTags: {
            type: "array",
            items: { type: "string" },
            description: "Short feeling words actually reflected in the message (e.g. 'stressed', 'content', 'exhausted', 'celebratory'). 1-3 max.",
          },
          contextTags: {
            type: "array",
            items: { type: "string" },
            description: "Situational context: 'stress', 'social', 'celebration', 'tired', 'routine'. 1-2 max.",
          },
          energy: {
            type: ["number", "null"],
            description: "1 (very low) to 5 (very high), ONLY when the message clearly signals energy level; otherwise null.",
          },
          ease: {
            type: ["number", "null"],
            description: "1 (tense) to 5 (at ease), ONLY when clearly signaled; otherwise null.",
          },
        },
        required: ["feelingTags", "contextTags", "energy", "ease"],
        additionalProperties: false,
      },
      clarifyingQuestion: {
        type: ["string", "null"],
        description:
          "Only for ambiguous FOOD descriptions: if multiple details meaningfully change the estimates, combine ALL of them into ONE natural question, and ALWAYS end it by offering to log anyway (e.g. '…— or I can just log my best guess now.'). This is your only chance to ask. Null when clear enough, and always null when meals is empty.",
      },
      confidence: {
        type: "string",
        enum: ["high", "medium", "low"],
        description:
          "Overall confidence. 'high' = clear description with known quantities. 'medium' = reasonable estimate. 'low' = very vague.",
      },
      notes: {
        type: ["string", "null"],
        description:
          "Optional brief nutritional note or health tip relevant to the food. Null if nothing notable.",
      },
    },
    required: ["meals", "reply", "moodContext", "clarifyingQuestion", "confidence", "notes"],
    additionalProperties: false,
  },
};

const SYSTEM_PROMPT = `You are Clover — a warm, knowledgeable nutrition companion in a wellness app. The user talks to you in one chat, and each message can be one of three things (or a mix):

1. A FOOD LOG ("I had oatmeal this morning") → extract it into meals[].
2. A QUESTION or something conversational ("how's my protein this week?", "I'm feeling tired lately", "hey") → meals stays empty; answer in 'reply', grounded in the user's data context below.
3. BOTH ("just had a burger — also, why am I so tired?") → extract the meals AND answer in 'reply'.

Never force a non-food message into a meal. Never ignore a question just because food was also mentioned.

SILENT MOOD CONTEXT: separately from all of the above, if the message carries emotional or situational language ("stress ate a whole sleeve of crackers", "felt really good after lunch", "exhausted today"), fill moodContext with soft pattern tags. This is quiet bookkeeping for the user's own trends view — NEVER acknowledge it in reply, notes, or clarifyingQuestion, never say "I noticed you're stressed". Pattern tags only — never anything resembling a clinical or mental-health label, never good/bad framing. Most messages have no such language: moodContext is null by default.

${SYMPTOM_GUARDRAILS}

Food extraction guidelines:
- Use USDA FoodData Central values as your reference for nutritional estimates.
- When quantities are not specified, use the most common serving size for that food.
- If cooking method is ambiguous (e.g. eggs could be fried, scrambled, boiled), assume the simplest preparation unless context suggests otherwise.
- MULTIPLE MEALS: if the description covers more than one distinct meal or eating occasion ("oatmeal this morning, then a sandwich for lunch"), return one meals[] entry per occasion. A single meal = a single entry.
- MEAL TIMING: infer mealPeriod from casual context — "this morning"/"for breakfast" → breakfast, "for lunch"/"midday" → lunch, "tonight"/"for dinner"/"last night" → dinner, otherwise snack when it's clearly between-meals, null when there's no time context at all. "Yesterday"/"last night" → dayOffset -1. Never ask the user for exact clock times — rough placement is the point. If it feels natural, you may append a brief, low-key line to 'notes' that mentioning when they ate helps their timing patterns — at most occasionally, never as a demand.
- MICRONUTRIENTS: estimate the full micronutrient panel per meal from typical food composition. These are understood to be rough estimates — provide your best numbers, never zeros for foods that plainly contain a nutrient.
- You get ONE opportunity to ask for clarification per description, ever. If several details are ambiguous, bundle them into a single natural-sounding question — and always close the question by offering to log with best estimates instead (e.g. "— or I can just log my best guess now."). Do not ask about anything you could reasonably assume.
- If this message already contains "Additional context from user" (the user answered, or chose to log anyway), you MUST return clarifyingQuestion: null and give your best estimates with what you have — do not ask again under any circumstances.
- Always detect common allergens: Gluten, Dairy, Peanuts, Tree Nuts, Eggs, Soy, Shellfish, Fish.
- Be conservative with calorie estimates — round to the nearest 5 kcal.
- Macros should be in grams, rounded to 1 decimal place.
- If the user mentions a refined or clarified version of a previous description, incorporate that context into your estimate.
- Respond ONLY with the JSON structure — no extra prose.`;

/** Zod mirror of the LLM output, used to validate before returning to the client. */
const mealSchema = z.object({
  foodName: z.string(),
  quantity: z.string(),
  calories: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
  fiber: z.number(),
  micronutrients: z.record(z.string(), z.number()),
  allergensDetected: z.array(z.string()),
  mealPeriod: z.enum(["breakfast", "lunch", "dinner", "snack"]).nullable(),
  dayOffset: z.number().int().min(-1).max(0),
});

const moodContextSchema = z.object({
  feelingTags: z.array(z.string().min(1).max(40)).max(5).default([]),
  contextTags: z.array(z.string().min(1).max(40)).max(5).default([]),
  energy: z.number().int().min(1).max(5).nullable().default(null),
  ease: z.number().int().min(1).max(5).nullable().default(null),
});

const analysisSchema = z.object({
  meals: z.array(mealSchema),
  reply: z.string().nullable().default(null),
  moodContext: moodContextSchema.nullable().default(null),
  clarifyingQuestion: z.string().nullable(),
  confidence: z.enum(["high", "medium", "low"]),
  notes: z.string().nullable(),
});

export type MealAnalysis = z.infer<typeof mealSchema>;

export const nutritionRouter = router({
  /**
   * The chat brain: analyzes each message as a food log (meals[]), a
   * data-grounded conversational turn (reply), or both. Meals carry rough
   * time-of-day placement. Accepts an optional `context` string (e.g. a
   * previous clarifying answer). Enforces AI call limits by tier.
   */
  analyzeTranscript: protectedProcedure
    .input(
      z.object({
        transcript: z
          .string()
          .min(1, "Message is empty")
          .max(2000, "Message too long"),
        /** Optional: user's answer to a previous clarifying question */
        clarificationContext: z.string().max(500).optional(),
        /** Optional: user's known allergies to cross-reference */
        knownAllergies: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { transcript, clarificationContext, knownAllergies } = input;

      // Check AI call limit for this user's subscription tier
      // Auto-create free subscription if it doesn't exist
      const sub = await getOrCreateSubscription(ctx.user.id);

      // Guests get a hard cap that overrides tier, trial, and tester status —
      // the demo is 10 analyses, then a free account.
      const isGuest = ctx.user.loginMethod === "anonymous";
      if (isGuest && sub.aiCallsUsedThisMonth >= GUEST_AI_LIMIT) {
        throw new TRPCError({ code: "FORBIDDEN", message: GUEST_LIMIT_MESSAGE });
      }

      // Testers get unlimited AI calls regardless of tier
      const isTester = !isGuest && !!(ctx.user.isTester);
      const limit = getAICallLimit(sub.tier);
      if (!isGuest && !isTester && sub.aiCallsUsedThisMonth >= limit) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `You have reached your AI call limit for this month (${limit} calls). Upgrade to Clover Plus for unlimited logs.`,
        });
      }

      // Build the user message, incorporating any clarification context
      let userMessage = `User message: "${transcript}"`;

      if (clarificationContext) {
        userMessage += `\n\nAdditional context from user: "${clarificationContext}"`;
      }

      if (knownAllergies && knownAllergies.length > 0) {
        const allergyList = knownAllergies
          .filter((a) => a !== "None")
          .join(", ");
        if (allergyList) {
          userMessage += `\n\nUser's known allergies (flag these if present): ${allergyList}`;
        }
      }

      // The user's data context makes 'reply' answers real instead of generic —
      // this is what lets "I'm feeling tired" get a grounded, honest response.
      const logContext = await buildLogContext(ctx.user.id);

      let result;
      try {
        result = await invokeLLM({
          messages: [
            { role: "system", content: `${SYSTEM_PROMPT}\n\n--- USER DATA CONTEXT ---\n${logContext}` },
            { role: "user", content: userMessage },
          ],
          response_format: {
            type: "json_schema",
            json_schema: NUTRITION_JSON_SCHEMA,
          },
        });
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "AI nutritional analysis failed. Please try again.",
          cause: err,
        });
      }

      const rawContent = result.choices?.[0]?.message?.content;
      if (!rawContent || typeof rawContent !== "string") {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "AI returned an unexpected response format.",
        });
      }

      let parsed: z.infer<typeof analysisSchema>;
      try {
        parsed = analysisSchema.parse(JSON.parse(rawContent));
      } catch {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "AI response could not be parsed as JSON.",
        });
      }

      // Respect the extraction toggle server-side, and drop empty extractions —
      // a moodContext with no tags and no axis values carries no signal.
      if (
        !ctx.user.moodExtractionEnabled ||
        (parsed.moodContext &&
          parsed.moodContext.feelingTags.length === 0 &&
          parsed.moodContext.contextTags.length === 0 &&
          parsed.moodContext.energy == null &&
          parsed.moodContext.ease == null)
      ) {
        parsed.moodContext = null;
      }

      // Increment AI calls used for this user
      await incrementAICallsUsed(ctx.user.id, 1);

      return parsed;
    }),
});
