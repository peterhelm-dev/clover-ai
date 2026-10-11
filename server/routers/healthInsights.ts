import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { buildLogContext, SYMPTOM_GUARDRAILS } from "../log-context";
import { consumeBetaAiCall } from "../beta-program";

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const healthInsightsRouter = router({
  /**
   * Generate a daily health overview: a short summary + 2-3 actionable tips.
   * Returns plain text / markdown suitable for rendering with Streamdown.
   */
  overview: protectedProcedure.mutation(async ({ ctx }) => {
    const logContext = await buildLogContext(ctx.user.id);

    const systemPrompt = `You are Clover, a friendly and knowledgeable nutrition coach. 
Your job is to review a user's recent food logs and provide a concise, encouraging daily health overview.

Format your response in Markdown with two sections:
1. **Today's Summary** — 2-3 sentences summarising the day's intake vs. targets. Be specific about numbers.
2. **Tips for Tomorrow** — 2-3 short, actionable, personalised improvement tips based on the data.

Keep the total response under 200 words. Be warm, specific, and practical.`;

    await consumeBetaAiCall(ctx.user.id);
    try {
      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Here is my nutrition data:\n\n${logContext}\n\nPlease give me my daily overview and tips.` },
        ],
      });

      const content = response?.choices?.[0]?.message?.content;
      if (!content) throw new Error("Empty LLM response");
      return { overview: content };
    } catch (err) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to generate health overview",
        cause: err,
      });
    }
  }),

  /**
   * Data-aware chat: answer questions about the user's food history.
   * Accepts a messages array (conversation history) and returns the next assistant reply.
   */
  chat: protectedProcedure
    .input(
      z.object({
        messages: z.array(
          z.object({
            role: z.enum(["user", "assistant"]),
            content: z.string(),
          })
        ).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const logContext = await buildLogContext(ctx.user.id);

      const systemPrompt = `You are Clover, a friendly nutrition coach with access to the user's food log history.
Answer questions about their eating habits, nutritional intake, patterns, and give personalised advice.
Always base your answers on the actual data provided. If data is insufficient, say so honestly and specifically (which days are missing, what isn't tracked).
Keep answers concise (under 150 words) and practical.

${SYMPTOM_GUARDRAILS}

${logContext}`;

      await consumeBetaAiCall(ctx.user.id);
      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            ...input.messages,
          ],
        });

        const content = response?.choices?.[0]?.message?.content;
        if (!content) throw new Error("Empty LLM response");
        return { reply: content };
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate chat response",
          cause: err,
        });
      }
    }),
});
