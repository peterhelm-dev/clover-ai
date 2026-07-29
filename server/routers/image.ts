import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { storagePut } from "../storage";
import { invokeLLM } from "../_core/llm";
import { getDb } from "../db";
import { foodLogs } from "../../drizzle/schema";
import { getOrCreateSubscription, incrementAICallsUsed } from "../db-subscriptions";
import { GUEST_AI_LIMIT, GUEST_LIMIT_MESSAGE } from "../products";

/**
 * Image-based meal logging router.
 * Handles image upload, AI vision analysis, and automatic nutrition extraction.
 */

export const imageRouter = router({
  /**
   * Upload meal image to S3 and return URL.
   * Client should call this first, then pass the URL to analyzeImage.
   */
  uploadImage: protectedProcedure
    .input(
      z.object({
        imageData: z.string(), // base64 encoded image
        fileName: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }: any) => {
      const fileName = input.fileName || `meal-${Date.now()}.jpg`;
      const buffer = Buffer.from(input.imageData, "base64");

      const { url, key } = await storagePut(
        `meals/${ctx.user.id}/${fileName}`,
        buffer,
        "image/jpeg"
      );

      return { url, key };
    }),

  /**
   * Analyze meal image using LLM vision API.
   * Returns extracted meal description and confidence level.
   */
  analyzeImage: protectedProcedure
    .input(
      z.object({
        imageUrl: z.string().url(),
      })
    )
    .mutation(async ({ input, ctx }: any) => {
      // Guests share the same hard demo cap as the chat — photo analysis is
      // an AI call too, so it can't be a loophole around the 10-try limit.
      if (ctx.user.loginMethod === "anonymous") {
        const sub = await getOrCreateSubscription(ctx.user.id);
        if (sub.aiCallsUsedThisMonth >= GUEST_AI_LIMIT) {
          throw new TRPCError({ code: "FORBIDDEN", message: GUEST_LIMIT_MESSAGE });
        }
        await incrementAICallsUsed(ctx.user.id, 1);
      }
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a nutrition expert AI. Analyze the meal image and extract:
1. Food items and their approximate quantities
2. Estimated macronutrients (calories, protein, carbs, fat, fiber)
3. Any visible allergens or dietary concerns
4. Confidence level (high/medium/low) based on image clarity

Respond ONLY with valid JSON, no markdown or extra text.`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this meal image and respond with JSON containing: foodDescription, calories, protein, carbs, fat, fiber, allergens (array), confidence (high/medium/low)",
              },
              {
                type: "image_url",
                image_url: {
                  url: input.imageUrl,
                  detail: "high",
                },
              },
            ],
          },
        ],
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error("No response from LLM");
      }

      // Parse JSON response - content can be string or array
      const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
      const jsonMatch = contentStr.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Could not parse JSON response from LLM");
      }

      const analysis = JSON.parse(jsonMatch[0]);
      
      // Validate response schema with strict types
      const responseSchema = z.object({
        foodDescription: z.string(),
        calories: z.number().min(0),
        protein: z.number().min(0),
        carbs: z.number().min(0),
        fat: z.number().min(0),
        fiber: z.number().min(0),
        allergens: z.array(z.string()).default([]),
        confidence: z.enum(['high', 'medium', 'low']).default('medium'),
      });
      
      const validated = responseSchema.parse(analysis);
      return validated;
    }),

  /**
   * Create food log entry from image analysis.
   * Combines image URL with extracted nutrition data.
   */
  logMealFromImage: protectedProcedure
    .input(
      z.object({
        imageUrl: z.string().url(),
        foodDescription: z.string(),
        calories: z.number().min(0),
        protein: z.number().min(0),
        carbs: z.number().min(0),
        fat: z.number().min(0),
        fiber: z.number().min(0),
        allergens: z.array(z.string()).default([]),
        confidence: z.enum(["high", "medium", "low"]).default("medium"),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }: any) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }
      const result = await db
        .insert(foodLogs)
        .values({
          userId: ctx.user.id,
          imageUrl: input.imageUrl,
          logMethod: "photo",
          foodName: input.foodDescription,
          quantity: "1 serving",
          calories: input.calories.toString(),
          protein: input.protein.toString(),
          carbs: input.carbs.toString(),
          fat: input.fat.toString(),
          fiber: input.fiber.toString(),
          allergensDetected: input.allergens,
          confidence: input.confidence,
          notes: input.notes,
        })
        .returning({ id: foodLogs.id });

      return {
        id: result[0].id,
        message: "Meal logged successfully from image",
      };
    }),
});
