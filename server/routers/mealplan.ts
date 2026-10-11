import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { mealPlans } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { consumeBetaAiCall } from "../beta-program";

const mealSchema = z.object({
  day: z.string(),
  breakfast: z.string(),
  lunch: z.string(),
  dinner: z.string(),
  snack: z.string().optional(),
});

export const mealPlanRouter = router({
  /**
   * Generate meal plan suggestions using LLM based on user profile.
   */
  getSuggestions: protectedProcedure
    .input(
      z.object({
        weekStart: z.string(), // YYYY-MM-DD
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await consumeBetaAiCall(ctx.user.id);
      // Call LLM to generate meal suggestions
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "You are a nutritionist. Generate a week of healthy meal suggestions in JSON format. Return an array of objects with day, breakfast, lunch, dinner, and optional snack fields.",
          },
          {
            role: "user",
            content: `Generate a week of meal suggestions starting from ${input.weekStart}. Format as JSON array.`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "meal_plan",
            strict: true,
            schema: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  day: { type: "string" },
                  breakfast: { type: "string" },
                  lunch: { type: "string" },
                  dinner: { type: "string" },
                  snack: { type: "string" },
                },
                required: ["day", "breakfast", "lunch", "dinner"],
                additionalProperties: false,
              },
            },
          },
        },
      });

      const content = response.choices[0]?.message.content;
      if (!content) {
        throw new Error("No response from LLM");
      }

      const contentStr = typeof content === "string" ? content : JSON.stringify(content);
      const meals = JSON.parse(contentStr);

      return { meals, weekStart: input.weekStart };
    }),

  /**
   * Save meal plan for the week.
   */
  save: protectedProcedure
    .input(
      z.object({
        weekStart: z.string(), // YYYY-MM-DD
        meals: z.array(mealSchema),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db.insert(mealPlans).values({
        userId: ctx.user.id,
        weekStart: input.weekStart,
        meals: input.meals,
      });

      return { success: true };
    }),

  /**
   * Get saved meal plan for a week.
   */
  getForWeek: protectedProcedure
    .input(
      z.object({
        weekStart: z.string(), // YYYY-MM-DD
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const plans: any[] = await db
        .select()
        .from(mealPlans)
        .where(eq(mealPlans.userId, ctx.user.id));

      const plan = plans.find((p) => p.weekStart === input.weekStart);
      return plan || null;
    }),

  /**
   * Get all saved meal plans.
   */
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const plans: any[] = await db.select().from(mealPlans).where(eq(mealPlans.userId, ctx.user.id));

    return plans;
  }),
});
