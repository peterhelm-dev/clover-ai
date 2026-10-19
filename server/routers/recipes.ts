import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { getUserProfile } from "../db-food-logs";

// ---------------------------------------------------------------------------
// Edamam diet/health label mappings from user profile data
// ---------------------------------------------------------------------------
const DIET_LABEL_MAP: Record<string, string> = {
  Balanced: "balanced",
  "High Protein": "high-protein",
  "Low Carb": "low-carb",
  Keto: "low-carb", // closest match
  Paleo: "balanced",
};

const HEALTH_LABEL_MAP: Record<string, string> = {
  Vegetarian: "vegetarian",
  Vegan: "vegan",
  Keto: "keto-friendly",
  Paleo: "paleo",
  Peanuts: "peanut-free",
  "Tree Nuts": "tree-nut-free",
  Gluten: "gluten-free",
  Dairy: "dairy-free",
  Soy: "soy-free",
  Shellfish: "crustacean-free",
  Eggs: "egg-free",
};

// ---------------------------------------------------------------------------
// Recipe search via Edamam API
// ---------------------------------------------------------------------------
async function searchEdamamRecipes(params: {
  query: string;
  healthLabels: string[];
  dietLabels: string[];
  from?: number;
  to?: number;
}) {
  const appId = process.env.EDAMAM_APP_ID;
  const appKey = process.env.EDAMAM_APP_KEY;

  if (!appId || !appKey) {
    return null; // Signal that API keys are not configured
  }

  const url = new URL("https://api.edamam.com/api/recipes/v2");
  url.searchParams.set("type", "public");
  url.searchParams.set("app_id", appId);
  url.searchParams.set("app_key", appKey);
  url.searchParams.set("q", params.query);
  url.searchParams.set("from", String(params.from ?? 0));
  url.searchParams.set("to", String(params.to ?? 12));
  url.searchParams.set("imageSize", "REGULAR");

  for (const h of params.healthLabels) {
    url.searchParams.append("health", h);
  }
  for (const d of params.dietLabels) {
    url.searchParams.append("diet", d);
  }

  const res = await fetch(url.toString(), {
    headers: { "Accept-Encoding": "gzip" },
  });

  if (!res.ok) {
    console.error(`[Recipes] upstream error ${res.status}`);
    throw new Error("Recipe search is unavailable right now.");
  }

  return res.json() as Promise<{
    hits: Array<{
      recipe: {
        uri: string;
        label: string;
        image: string;
        source: string;
        url: string;
        yield: number;
        dietLabels: string[];
        healthLabels: string[];
        calories: number;
        totalTime: number;
        cuisineType: string[];
        mealType: string[];
        totalNutrients: Record<string, { quantity: number; unit: string }>;
        ingredientLines: string[];
      };
    }>;
    count: number;
  }>;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
export const recipesRouter = router({
  /**
   * Search recipes filtered by the authenticated user's dietary profile.
   * Falls back to a "not configured" response if Edamam keys are missing.
   */
  search: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1).max(100).default("healthy"),
        from: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      // Build health/diet labels from user profile
      const profile = await getUserProfile(ctx.user.id);

      const healthLabels: string[] = [];
      const dietLabels: string[] = [];

      if (profile) {
        // Dietary choices → diet labels
        for (const choice of profile.dietaryChoices ?? []) {
          const dietLabel = DIET_LABEL_MAP[choice];
          if (dietLabel) dietLabels.push(dietLabel);

          const healthLabel = HEALTH_LABEL_MAP[choice];
          if (healthLabel) healthLabels.push(healthLabel);
        }

        // Allergies → health labels (free-from)
        for (const allergy of profile.allergies ?? []) {
          const healthLabel = HEALTH_LABEL_MAP[allergy];
          if (healthLabel && !healthLabels.includes(healthLabel)) {
            healthLabels.push(healthLabel);
          }
        }
      }

      const data = await searchEdamamRecipes({
        query: input.query,
        healthLabels,
        dietLabels,
        from: input.from,
        to: input.from + 12,
      });

      if (!data) {
        return { configured: false as const, recipes: [] };
      }

      const recipes = data.hits.map((hit) => {
        const r = hit.recipe;
        const nutrients = r.totalNutrients;
        const perServing = (val: number) =>
          Math.round(val / Math.max(r.yield, 1));

        return {
          id: r.uri.split("#recipe_")[1] ?? r.uri,
          label: r.label,
          image: r.image,
          source: r.source,
          url: r.url,
          calories: perServing(r.calories),
          protein: perServing(nutrients?.PROCNT?.quantity ?? 0),
          carbs: perServing(nutrients?.CHOCDF?.quantity ?? 0),
          fat: perServing(nutrients?.FAT?.quantity ?? 0),
          fiber: perServing(nutrients?.FIBTG?.quantity ?? 0),
          totalTime: r.totalTime ?? 0,
          cuisineType: r.cuisineType ?? [],
          mealType: r.mealType ?? [],
          dietLabels: r.dietLabels ?? [],
          healthLabels: (r.healthLabels ?? []).slice(0, 4),
          ingredientLines: r.ingredientLines ?? [],
        };
      });

      return { configured: true as const, recipes };
    }),

  /**
   * Public check: are Edamam API keys configured?
   */
  isConfigured: publicProcedure.query(() => {
    return {
      configured: !!(process.env.EDAMAM_APP_ID && process.env.EDAMAM_APP_KEY),
    };
  }),
});
