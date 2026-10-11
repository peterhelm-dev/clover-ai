import { useState } from "react";
import { Loader2, RefreshCw, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export function MealPlanningTab() {
  const [weekStart, setWeekStart] = useState(() => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + 1);
    return monday.toISOString().split("T")[0];
  });

  const suggestionsQuery = trpc.mealPlan.getSuggestions.useQuery({ weekStart });
  const saveMutation = trpc.mealPlan.save.useMutation({
    onSuccess: () => {
      toast.success("Meal plan saved!");
      savedQuery.refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to save meal plan");
    },
  });
  const savedQuery = trpc.mealPlan.getForWeek.useQuery({ weekStart });

  const suggestions = suggestionsQuery.data?.meals || [];
  const savedPlan = savedQuery.data;

  const handleSave = () => {
    if (!suggestions.length) {
      toast.error("No meal plan to save");
      return;
    }
    saveMutation.mutate({ weekStart, meals: suggestions });
  };

  const handleRegenerate = () => {
    suggestionsQuery.refetch();
  };

  const getWeekDays = () => {
    const days = [];
    const start = new Date(weekStart);
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      days.push({
        date: date.toISOString().split("T")[0],
        label: date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      });
    }
    return days;
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight">Weekly Meal Plan</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {savedPlan ? "Your saved meal plan for this week" : "Generate AI-powered meal suggestions"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleRegenerate}
            disabled={suggestionsQuery.isLoading}
            variant="outline"
            size="sm"
          >
            {suggestionsQuery.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Regenerate
          </Button>
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending || !suggestions.length}
            size="sm"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Plan
          </Button>
        </div>
      </div>

      {/* Week selector */}
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium">Week starting:</label>
        <input
          type="date"
          value={weekStart}
          onChange={(e) => setWeekStart(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg text-sm"
        />
      </div>

      {/* Loading state */}
      {suggestionsQuery.isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Meal plan grid */}
      {!suggestionsQuery.isLoading && suggestions.length > 0 && (
        <div className="grid grid-cols-1 gap-4">
          {getWeekDays().map((day, idx) => {
            const meal = suggestions[idx];
            if (!meal) return null;

            return (
              <Card key={day.date} className="border-border/60 py-0 gap-0">
                <CardHeader className="p-4 pb-3 border-b border-border/40">
                  <CardTitle className="text-base font-semibold">{day.label}</CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Breakfast</p>
                      <p className="text-sm">{meal.breakfast}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Lunch</p>
                      <p className="text-sm">{meal.lunch}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Dinner</p>
                      <p className="text-sm">{meal.dinner}</p>
                    </div>
                    {meal.snack && (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase">Snack</p>
                        <p className="text-sm">{meal.snack}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!suggestionsQuery.isLoading && suggestions.length === 0 && !savedPlan && (
        <Card className="border-border/60 bg-muted/30">
          <CardContent className="p-8 text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Click "Regenerate" to get AI-powered meal suggestions for the week.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
