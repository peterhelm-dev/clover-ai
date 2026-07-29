import React, { useState, useEffect, useRef, useCallback } from "react";
import { AIChatBox } from "@/components/AIChatBox";
import { ImageMealLogger } from "@/components/ImageMealLogger";
import { WaterIntakeCard } from "@/components/WaterIntakeCard";
import { MealPlanningTab } from "@/components/MealPlanningTab";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Sparkles, Calendar, Check, Leaf, Clock,
  Mic, MicOff, BrainCircuit, Heart, AlertTriangle, Apple, Compass,
  LogOut, Activity, BarChart3, Bell, RefreshCw, Smartphone, ChevronRight,
  ChevronLeft, Send, SkipForward, Loader2, Wheat, Trash2, Pencil, Crown, X, CreditCard,
  Share2, Copy, Gift, Shield, Camera
} from "lucide-react";
import { toast } from "sonner";
import {
  SidebarProvider,
  Sidebar,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, PieChart, Pie, Cell,
  ComposedChart, Line, Bar, Scatter
} from "recharts";
import { MOCK_TRAVEL_CALENDAR } from "@shared/const";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type LoggedMealEntry = {
  /** DB id of the saved log — enables in-chat undo. */
  logId: number;
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  allergens: string[];
  mealPeriod: "breakfast" | "lunch" | "dinner" | "snack" | null;
  dayOffset: number;
  undone?: boolean;
};

type ChatMessage = {
  id: string;
  role: "user" | "ai" | "system";
  text: string;
  confidence?: "high" | "medium" | "low";
  logSaved?: boolean;
  imageDataUrl?: string;
  loggedMeals?: LoggedMealEntry[];
  notes?: string | null;
};

// Golden-path onboarding (spec Part 1): Welcome → Goal → First log → Notification preference.
// Health-profile details (age, weight, allergies, etc.) moved to Settings.
type OnboardStep = "welcome" | "goal" | "first-log" | "notifications" | "done";

const ONBOARD_STEPS: OnboardStep[] = ["welcome", "goal", "first-log", "notifications", "done"];

/** Goals selectable in the UI — only goals whose weekly-export template copy exists. */
const GOAL_OPTIONS: { value: "weight_management" | "protein_focus" | "general_awareness"; label: string; description: string }[] = [
  { value: "weight_management", label: "Weight management", description: "Gentle awareness of overall intake patterns" },
  { value: "protein_focus", label: "Protein focus", description: "Keep an eye on protein across your week" },
  { value: "general_awareness", label: "Just general awareness", description: "No specific target — understand your patterns" },
];

const DIET_OPTIONS = ["Balanced", "Vegetarian", "Vegan", "Keto", "Paleo", "High Protein", "Low Carb"];
const ALLERGEN_OPTIONS = ["Peanuts", "Tree Nuts", "Gluten", "Dairy", "Soy", "Shellfish", "Eggs"];
const CONDITION_OPTIONS = ["None", "Diabetes", "Hypertension", "High Cholesterol", "Acid Reflux"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function todayUTCRange() {
  const now = Date.now();
  const d = new Date(now);
  const start = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return { start, end: start + 86400000 - 1, nowMs: now };
}

function confidenceColor(c: "high" | "medium" | "low") {
  if (c === "high") return "border-emerald-300 text-emerald-700 bg-emerald-50";
  if (c === "medium") return "border-amber-300 text-amber-700 bg-amber-50";
  return "border-red-300 text-red-700 bg-red-50";
}

// ---------------------------------------------------------------------------
// LoggedMealCard sub-component — the polished "meal saved" confirmation,
// with in-chat undo and rough time-of-day placement.
// ---------------------------------------------------------------------------
function LoggedMealCard({
  meal,
  confidence,
  onUndo,
  undoing,
}: {
  meal: LoggedMealEntry;
  confidence?: "high" | "medium" | "low";
  onUndo?: () => void;
  undoing?: boolean;
}) {
  const macros = [
    { label: "Calories", value: `${Math.round(meal.calories)} kcal` },
    { label: "Protein", value: `${Math.round(meal.protein)}g` },
    { label: "Carbs", value: `${Math.round(meal.carbs)}g` },
    { label: "Fat", value: `${Math.round(meal.fat)}g` },
    { label: "Fiber", value: `${Math.round(meal.fiber)}g` },
  ];

  const whenLabel = meal.mealPeriod
    ? `${meal.mealPeriod}${meal.dayOffset === -1 ? " · yesterday" : ""}`
    : meal.dayOffset === -1
      ? "yesterday"
      : null;

  if (meal.undone) {
    return (
      <div className="rounded-2xl border border-border/60 bg-muted/30 px-4 py-3">
        <p className="text-xs text-muted-foreground line-through">{meal.foodName}</p>
        <p className="text-xs text-muted-foreground mt-0.5">Removed from your log.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 overflow-hidden">
      <div className="flex items-center gap-2 px-4 pt-3">
        <div className="h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
          <Check className="h-3 w-3 text-white" />
        </div>
        <span className="text-sm font-semibold text-emerald-800">Logged</span>
        {whenLabel && (
          <Badge variant="outline" className="text-[9px] border-emerald-300 text-emerald-700 bg-white capitalize">
            {whenLabel}
          </Badge>
        )}
        {confidence && (
          <Badge variant="outline" className={`text-[9px] ml-auto ${confidenceColor(confidence)}`}>
            {confidence} confidence
          </Badge>
        )}
      </div>

      <div className="px-4 pt-2 pb-3">
        <p className="text-sm font-medium text-foreground">{meal.foodName}</p>
      </div>

      <div className="grid grid-cols-5 gap-px bg-emerald-200/60 border-y border-emerald-200">
        {macros.map(m => (
          <div key={m.label} className="bg-white px-2 py-2 text-center">
            <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{m.label}</div>
            <div className="text-xs font-semibold mt-0.5">{m.value}</div>
          </div>
        ))}
      </div>

      {(meal.allergens.length > 0 || onUndo) && (
        <div className="px-4 py-2.5 space-y-2">
          {meal.allergens.length > 0 && (
            <div className="flex items-start gap-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>Allergens detected: {meal.allergens.join(", ")}</span>
            </div>
          )}
          {onUndo && (
            <button
              type="button"
              onClick={onUndo}
              disabled={undoing}
              className="text-[11px] text-muted-foreground hover:text-destructive underline underline-offset-2 transition-colors disabled:opacity-50"
            >
              {undoing ? "Removing..." : "Undo — remove this log"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mood & feeling tracker sub-components.
// Two-axis soft model (energy / ease) — no single mood score, no field ever
// required, nothing framed as good/bad. Visual bones borrowed from modern
// agent dashboards (cards, sparklines, inline suggestion cards) retoned to
// Clover's warm register: no scores, no red/green, no bulk actions.
// ---------------------------------------------------------------------------

const FEELING_TAG_OPTIONS = ["content", "calm", "energized", "tired", "stressed", "foggy"];
const CONTEXT_TAG_OPTIONS = ["routine", "social", "celebration", "stress", "travel"];

/** 1–5 tap selector for one axis. Tap the selected dot again to unset. */
function AxisSelector({
  label,
  lowLabel,
  highLabel,
  value,
  onChange,
}: {
  label: string;
  lowLabel: string;
  highLabel: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">{label}</span>
        <span className="text-[10px] text-muted-foreground">{value == null ? "not set" : ""}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground w-10">{lowLabel}</span>
        <div className="flex gap-1.5 flex-1 justify-center">
          {[1, 2, 3, 4, 5].map(v => (
            <button
              key={v}
              type="button"
              onClick={() => onChange(value === v ? null : v)}
              className={`h-6 w-6 rounded-full border transition-colors ${
                value != null && v <= value
                  ? "bg-primary/70 border-primary"
                  : "bg-muted/40 border-border/60 hover:border-border"
              }`}
              title={`${label} ${v} of 5`}
            />
          ))}
        </div>
        <span className="text-[10px] text-muted-foreground w-10 text-right">{highLabel}</span>
      </div>
    </div>
  );
}

/** Quick manual check-in — everything optional, empty submission still counts. */
function MoodCheckInCard() {
  const utils = trpc.useUtils();
  const [energy, setEnergy] = useState<number | null>(null);
  const [ease, setEase] = useState<number | null>(null);
  const [feelings, setFeelings] = useState<string[]>([]);
  const [contexts, setContexts] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const createMutation = trpc.mood.create.useMutation({
    onSuccess: () => {
      toast.success("Checked in");
      setEnergy(null); setEase(null); setFeelings([]); setContexts([]); setNote(""); setShowNote(false);
      utils.mood.list.invalidate();
      utils.mood.insights.invalidate();
    },
    onError: () => toast.error("Couldn't save that check-in — try again."),
  });

  const toggle = (arr: string[], v: string, set: (a: string[]) => void) =>
    set(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

  return (
    <Card className="border-border/60">
      <CardContent className="p-5 space-y-4">
        <div>
          <p className="text-sm font-medium">How are you feeling?</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Entirely optional — set as much or as little as you like.</p>
        </div>
        <AxisSelector label="Energy" lowLabel="low" highLabel="high" value={energy} onChange={setEnergy} />
        <AxisSelector label="Ease" lowLabel="tense" highLabel="at ease" value={ease} onChange={setEase} />
        <div className="flex flex-wrap gap-1.5">
          {FEELING_TAG_OPTIONS.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => toggle(feelings, t, setFeelings)}
              className={`text-[11px] rounded-full border px-2.5 py-1 transition-colors ${
                feelings.includes(t)
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border/60 text-muted-foreground hover:border-border"
              }`}
            >
              {t}
            </button>
          ))}
          {CONTEXT_TAG_OPTIONS.map(t => (
            <button
              key={`ctx-${t}`}
              type="button"
              onClick={() => toggle(contexts, t, setContexts)}
              className={`text-[11px] rounded-full border border-dashed px-2.5 py-1 transition-colors ${
                contexts.includes(t)
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border/60 text-muted-foreground hover:border-border"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        {showNote ? (
          <Input
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Anything you want to remember about right now..."
            className="text-sm"
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowNote(true)}
            className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            + add a note
          </button>
        )}
        <Button
          size="sm"
          disabled={createMutation.isPending}
          onClick={() =>
            createMutation.mutate({
              source: "manual_checkin",
              feelingTags: feelings,
              contextTags: contexts,
              energy,
              ease,
              note: note.trim() || undefined,
            })
          }
        >
          {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check in"}
        </Button>
      </CardContent>
    </Card>
  );
}

/** Mood trends: two-line chart, optional food-log overlay, insight cards, editable entry list. */
function MoodTrendsView() {
  const utils = trpc.useUtils();
  const [days, setDays] = useState<7 | 14 | 30>(7);
  const [showOverlay, setShowOverlay] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNote, setEditNote] = useState("");
  const [editEnergy, setEditEnergy] = useState<number | null>(null);
  const [editEase, setEditEase] = useState<number | null>(null);
  const [cardChoices, setCardChoices] = useState<Record<string, "saved" | "dismissed">>(() => {
    try { return JSON.parse(localStorage.getItem("clover-mood-insight-choices") ?? "{}"); } catch { return {}; }
  });

  const listQuery = trpc.mood.list.useQuery({ days });
  const insightsQuery = trpc.mood.insights.useQuery();
  const logsQuery = trpc.foodLogs.getAll.useQuery();
  const updateMutation = trpc.mood.update.useMutation({
    onSuccess: () => { utils.mood.list.invalidate(); setEditingId(null); toast.success("Updated"); },
  });
  const deleteMutation = trpc.mood.delete.useMutation({
    onSuccess: () => { utils.mood.list.invalidate(); utils.mood.insights.invalidate(); toast.success("Entry removed"); },
  });

  const chooseCard = (id: string, choice: "saved" | "dismissed") => {
    const next = { ...cardChoices, [id]: choice };
    setCardChoices(next);
    localStorage.setItem("clover-mood-insight-choices", JSON.stringify(next));
  };

  // Per-day chart rows across the whole window (days without data stay blank —
  // the lines simply skip them; absence is never rendered as a zero).
  const entries = listQuery.data ?? [];
  const chartData: { day: string; label: string; energy: number | null; ease: number | null; meals: number; linked: number | null }[] = [];
  {
    const byDay = new Map<string, { e: number[]; a: number[]; linked: boolean }>();
    for (const en of entries) {
      const day = new Date(en.createdAt).toISOString().slice(0, 10);
      const acc = byDay.get(day) ?? { e: [], a: [], linked: false };
      if (en.energy != null) acc.e.push(en.energy);
      if (en.ease != null) acc.a.push(en.ease);
      if (en.linkedFoodLogId != null) acc.linked = true;
      byDay.set(day, acc);
    }
    const mealsByDay = new Map<string, number>();
    for (const log of logsQuery.data ?? []) {
      const day = new Date(log.loggedAt).toISOString().slice(0, 10);
      mealsByDay.set(day, (mealsByDay.get(day) ?? 0) + 1);
    }
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const day = d.toISOString().slice(0, 10);
      const acc = byDay.get(day);
      const meals = mealsByDay.get(day) ?? 0;
      chartData.push({
        day,
        label: d.toLocaleDateString("en-US", { month: "numeric", day: "numeric" }),
        energy: acc && acc.e.length > 0 ? Math.round((acc.e.reduce((s, x) => s + x, 0) / acc.e.length) * 10) / 10 : null,
        ease: acc && acc.a.length > 0 ? Math.round((acc.a.reduce((s, x) => s + x, 0) / acc.a.length) * 10) / 10 : null,
        meals,
        linked: acc?.linked ? meals + 0.3 : null,
      });
    }
  }
  const hasAxisData = chartData.some(r => r.energy != null || r.ease != null);

  const sourceLabel = (s: string) =>
    s === "manual_checkin" ? "check-in" : s === "chat_extracted" ? "from your chat" : "retrospective";

  const visibleInsights = (insightsQuery.data ?? []).filter(c => cardChoices[c.id] !== "dismissed");

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-serif font-bold">How you've felt</h2>
          <p className="text-xs text-muted-foreground mt-1">Patterns to notice, not scores to hit. Edit or remove anything here — including what Clover picked up from your chat.</p>
        </div>
        <div className="flex gap-1 shrink-0">
          {([7, 14, 30] as const).map(d => (
            <Button key={d} variant={days === d ? "secondary" : "ghost"} size="sm" className="h-7 px-2.5 text-xs" onClick={() => setDays(d)}>
              {d}d
            </Button>
          ))}
        </div>
      </div>

      {/* Trend chart */}
      <Card className="border-border/60">
        <CardContent className="p-5">
          {!hasAxisData ? (
            <p className="text-xs text-muted-foreground py-6 text-center">
              No energy or ease data yet — check in from the Home tab whenever you feel like it, or just keep chatting; Clover quietly notices context you mention.
            </p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  {showOverlay && <YAxis yAxisId="meals" orientation="right" hide domain={[0, "dataMax + 2"]} />}
                  <Tooltip
                    formatter={(value: any, name: any) =>
                      name === "meals" ? [`${value} logged`, "meals"] : name === "linked" ? ["mood noted with a meal", ""] : [value, name]
                    }
                  />
                  {showOverlay && <Bar yAxisId="meals" dataKey="meals" fill="hsl(var(--muted-foreground) / 0.15)" radius={[3, 3, 0, 0]} />}
                  {showOverlay && <Scatter yAxisId="meals" dataKey="linked" fill="#8b5cf6" />}
                  <Line type="monotone" dataKey="energy" stroke="#10b981" strokeWidth={2} dot={{ r: 2.5 }} connectNulls name="energy" />
                  <Line type="monotone" dataKey="ease" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 2.5 }} connectNulls name="ease" />
                </ComposedChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-between mt-2">
                <div className="flex gap-4 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Energy</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-violet-500" /> Ease</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowOverlay(v => !v)}
                  className={`text-[10px] rounded-full border px-2 py-0.5 transition-colors ${showOverlay ? "border-primary text-foreground bg-primary/5" : "border-border/60 text-muted-foreground hover:border-border"}`}
                >
                  {showOverlay ? "Hide" : "Show"} food-log overlay
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">Lines connect only the days you have data — quiet days are simply quiet, not zeros. The overlay shows your meals per day and marks days where a feeling was noted alongside a meal; what you make of any overlap is yours to decide.</p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Insight cards — single, standalone, optional observations */}
      {visibleInsights.length > 0 && (
        <div className="space-y-2">
          {visibleInsights.map(card => (
            <Card key={card.id} className="border-border/60">
              <CardContent className="p-4 flex items-start gap-3">
                <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <p className="text-sm leading-relaxed">{card.text}</p>
                  <div className="flex gap-2">
                    {cardChoices[card.id] === "saved" ? (
                      <span className="text-[10px] text-primary flex items-center gap-1"><Check className="h-3 w-3" /> Noticing</span>
                    ) : (
                      <>
                        <button type="button" onClick={() => chooseCard(card.id, "saved")} className="text-[11px] rounded-full border border-border/60 px-2.5 py-1 text-muted-foreground hover:text-foreground hover:border-border transition-colors">
                          Save to notice
                        </button>
                        <button type="button" onClick={() => chooseCard(card.id, "dismissed")} className="text-[11px] rounded-full border border-border/60 px-2.5 py-1 text-muted-foreground hover:text-foreground hover:border-border transition-colors">
                          Not helpful
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Entry list — everything editable and deletable, extraction included */}
      <Card className="border-border/60">
        <CardHeader className="p-5 border-b border-border/40">
          <CardTitle className="font-serif text-base font-bold">Entries</CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          {listQuery.isLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</div>
          ) : entries.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nothing in this window yet.</p>
          ) : (
            <div className="space-y-3">
              {entries.map(en => (
                <div key={en.id} className="border-b border-border/30 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(en.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}, {new Date(en.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </span>
                        <Badge variant="outline" className="text-[9px]">{sourceLabel(en.source)}</Badge>
                        {en.energy != null && <span className="text-[10px] text-emerald-700">energy {en.energy}/5</span>}
                        {en.ease != null && <span className="text-[10px] text-violet-700">ease {en.ease}/5</span>}
                      </div>
                      {(en.feelingTags?.length || en.contextTags?.length) ? (
                        <div className="flex flex-wrap gap-1">
                          {[...(en.feelingTags ?? []), ...(en.contextTags ?? [])].map((t, i) => (
                            <span key={i} className="text-[10px] rounded-full bg-muted/60 px-2 py-0.5">{t}</span>
                          ))}
                        </div>
                      ) : null}
                      {en.note && <p className="text-xs text-muted-foreground italic">{en.note}</p>}
                      {en.source === "chat_extracted" && en.sourceText && (
                        <p className="text-[10px] text-muted-foreground/70 truncate">from: “{en.sourceText}”</p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          if (editingId === en.id) { setEditingId(null); return; }
                          setEditingId(en.id);
                          setEditNote(en.note ?? "");
                          setEditEnergy(en.energy);
                          setEditEase(en.ease);
                        }}
                        title="Edit"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        disabled={deleteMutation.isPending}
                        onClick={() => deleteMutation.mutate({ id: en.id })}
                        title="Delete"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  {editingId === en.id && (
                    <div className="mt-3 space-y-3 rounded-xl border border-border/40 p-3">
                      <AxisSelector label="Energy" lowLabel="low" highLabel="high" value={editEnergy} onChange={setEditEnergy} />
                      <AxisSelector label="Ease" lowLabel="tense" highLabel="at ease" value={editEase} onChange={setEditEase} />
                      <Input value={editNote} onChange={e => setEditNote(e.target.value)} placeholder="Note (optional)" className="text-sm" />
                      <Button
                        size="sm"
                        disabled={updateMutation.isPending}
                        onClick={() => updateMutation.mutate({ id: en.id, energy: editEnergy, ease: editEase, note: editNote.trim() || null })}
                      >
                        {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NutrientPanel sub-component — micronutrient averages across categories.
// Informational framing only: typical adult ranges, clearly labeled as rough
// AI estimates. Not targets, not a report card, never medical guidance.
// ---------------------------------------------------------------------------
function NutrientPanel() {
  const [windowDays, setWindowDays] = useState<7 | 30>(7);
  const summaryQuery = trpc.foodLogs.nutrientSummary.useQuery({ days: windowDays });
  const data = summaryQuery.data;

  const statusStyle = (status: string) =>
    status === "within"
      ? "bg-emerald-500"
      : status === "unknown"
        ? "bg-muted-foreground/30"
        : "bg-amber-400";

  const statusLabel = (status: string, upperLimit?: boolean) =>
    status === "within"
      ? "in typical range"
      : status === "below"
        ? "below typical range"
        : status === "above"
          ? upperLimit
            ? "above advisory limit"
            : "above typical range"
          : "no data yet";

  return (
    <Card className="border-border/60">
      <CardHeader className="p-5 border-b border-border/40">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="font-serif text-base font-bold">Nutrients</CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Rough AI estimates from your logged meals — averaged over the days you logged, not a lab result.
            </CardDescription>
          </div>
          <div className="flex gap-1 shrink-0">
            {([7, 30] as const).map(d => (
              <Button
                key={d}
                variant={windowDays === d ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2.5 text-xs"
                onClick={() => setWindowDays(d)}
              >
                {d}d
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-5">
        {summaryQuery.isLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Crunching your nutrients...
          </div>
        ) : !data || data.daysWithData === 0 ? (
          <p className="text-xs text-muted-foreground py-2">
            No nutrient estimates yet — they're captured automatically with each new meal you log, so this fills in as you go.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5">
              {data.nutrients.map(n => (
                <div key={n.key} className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${statusStyle(n.status)}`} />
                    <span className="font-medium truncate">{n.label}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono text-xs">
                      {n.avgPerDay != null ? `${n.avgPerDay}${n.unit}/day` : "—"}
                    </span>
                    <span className="block text-[10px] text-muted-foreground">
                      {statusLabel(n.status, n.upperLimit)}
                      {n.status !== "unknown" && !n.upperLimit && ` · typical ${n.low}–${n.high}${n.unit}`}
                      {n.status !== "unknown" && n.upperLimit && ` · advisory limit ${n.high}${n.unit}`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground pt-1 border-t border-border/30 leading-relaxed">
              Based on {data.daysWithData} {data.daysWithData === 1 ? "day" : "days"} with nutrient data
              (of {data.daysLogged} logged in the last {data.windowDays}). Intake isn't the same as absorption —
              if you're chasing a symptom like fatigue, treat this as a conversation starter for a doctor, not an answer.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// ReferralCard sub-component
// ---------------------------------------------------------------------------
function ReferralCard() {
  const { data, isLoading } = trpc.referral.getMyReferrals.useQuery();
  const applyCode = trpc.referral.applyCode.useMutation({
    onSuccess: (res) => {
      if (res.success) toast.success(res.message);
      else toast.error(res.message);
    },
  });
  const [codeInput, setCodeInput] = useState("");
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    if (!data?.code) return;
    navigator.clipboard.writeText(data.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = () => {
    if (!data?.code) return;
    const url = `${window.location.origin}?ref=${data.code}`;
    navigator.clipboard.writeText(url);
    toast.success("Referral link copied!");
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="p-5 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" />
          <CardTitle className="font-serif text-base">Refer Friends, Earn Free Months</CardTitle>
        </div>
        <CardDescription className="text-xs mt-1">
          Share your code and earn 1 free Pro month for every friend who signs up.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* My referral code */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Your Referral Code</p>
            {isLoading ? (
              <div className="h-10 bg-muted animate-pulse rounded-lg" />
            ) : (
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted rounded-lg px-4 py-2 font-mono text-lg font-bold tracking-widest text-center">
                  {data?.code ?? "—"}
                </code>
                <Button variant="outline" size="icon" onClick={copyCode} title="Copy code">
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button variant="outline" size="icon" onClick={shareLink} title="Copy share link">
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
            )}
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span><strong className="text-foreground">{data?.totalReferrals ?? 0}</strong> friends referred</span>
              <span><strong className="text-foreground">{data?.freeMonthsRemaining ?? 0}</strong> free months earned</span>
            </div>
          </div>

          {/* Apply a referral code */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Have a Friend's Code?</p>
            <div className="flex gap-2">
              <Input
                placeholder="Enter referral code"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                className="font-mono uppercase text-sm"
                maxLength={16}
              />
              <Button
                size="sm"
                disabled={applyCode.isPending || codeInput.length < 4}
                onClick={() => applyCode.mutate({ code: codeInput })}
              >
                {applyCode.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">You can only apply one referral code. Your friend earns a free month too.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// RecipesTab sub-component (keeps recipe state isolated)
// ---------------------------------------------------------------------------
function RecipesTab({ profile }: { profile: { dietaryChoices?: string[] | null; allergies?: string[] | null } | null | undefined }) {
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("healthy");
  const [selectedRecipe, setSelectedRecipe] = useState<null | {
    label: string; image: string; source: string; url: string;
    calories: number; protein: number; carbs: number; fat: number; fiber: number;
    totalTime: number; cuisineType: string[]; mealType: string[];
    dietLabels: string[]; healthLabels: string[];
    ingredientLines: string[];
  }>(null);

  const configuredQuery = trpc.recipes.isConfigured.useQuery();
  const recipesQuery = trpc.recipes.search.useQuery(
    { query },
    { enabled: configuredQuery.data?.configured === true }
  );

  const isConfigured = configuredQuery.data?.configured;
  const recipes = recipesQuery.data?.recipes ?? [];
  const isLoading = recipesQuery.isLoading && configuredQuery.data?.configured;

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchInput.trim()) setQuery(searchInput.trim());
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight">Curated Recipes</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {isConfigured
              ? "Live recipes from Edamam, filtered to your dietary profile."
              : "Connect Edamam to get 2M+ recipes filtered to your dietary preferences."}
          </p>
        </div>
        {isConfigured && (
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search recipes…"
              className="w-48 h-8 text-xs"
            />
            <Button type="submit" size="sm" className="h-8 text-xs">Search</Button>
          </form>
        )}
      </div>

      {/* Not configured — show setup prompt */}
      {!isConfigured && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-8 text-center space-y-4">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mx-auto">
              <Apple className="h-6 w-6" />
            </div>
            <h3 className="font-serif text-lg font-bold">Connect Edamam Recipe API</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Edamam provides access to 2M+ recipes with full nutritional data, filtered automatically
              by your dietary choices and allergens. A free developer account gives you 10,000 calls/month.
            </p>
            <ol className="text-xs text-left max-w-sm mx-auto space-y-2 text-muted-foreground">
              <li className="flex gap-2"><span className="font-bold text-primary">1.</span> Sign up at <a href="https://developer.edamam.com" target="_blank" rel="noopener noreferrer" className="underline text-primary">developer.edamam.com</a></li>
              <li className="flex gap-2"><span className="font-bold text-primary">2.</span> Create a "Recipe Search API" application</li>
              <li className="flex gap-2"><span className="font-bold text-primary">3.</span> Copy your App ID and App Key</li>
              <li className="flex gap-2"><span className="font-bold text-primary">4.</span> Add them as <code className="bg-muted px-1 rounded">EDAMAM_APP_ID</code> and <code className="bg-muted px-1 rounded">EDAMAM_APP_KEY</code> in Settings → Secrets</li>
            </ol>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Recipe grid */}
      {isConfigured && !isLoading && recipes.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {recipes.map(r => (
            <Card
              key={r.id}
              className="border-border/60 overflow-hidden hover:shadow-md transition-all duration-200 cursor-pointer"
              onClick={() => setSelectedRecipe(r)}
            >
              <div className="h-44 bg-muted relative overflow-hidden">
                {r.image ? (
                  <img src={r.image} alt={r.label} className="object-cover w-full h-full" />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <Apple className="h-10 w-10 opacity-30" />
                  </div>
                )}
                {r.totalTime > 0 && (
                  <Badge className="absolute top-3 right-3 bg-black/60 text-white border-0 text-[10px]">
                    <Clock className="h-3 w-3 mr-1" />{r.totalTime} min
                  </Badge>
                )}
              </div>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="font-serif text-sm font-bold leading-tight line-clamp-2">{r.label}</CardTitle>
                <p className="text-[10px] text-muted-foreground mt-0.5">{r.source}</p>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                <div className="grid grid-cols-4 gap-1 text-center">
                  {[{ label: "Cal", val: r.calories }, { label: "Pro", val: r.protein + "g" }, { label: "Carb", val: r.carbs + "g" }, { label: "Fat", val: r.fat + "g" }].map(m => (
                    <div key={m.label} className="bg-muted/40 rounded-lg py-1.5">
                      <div className="text-xs font-bold">{m.val}</div>
                      <div className="text-[9px] text-muted-foreground">{m.label}</div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {r.healthLabels.slice(0, 3).map(h => (
                    <span key={h} className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded-full">{h}</span>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {isConfigured && !isLoading && recipes.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Apple className="h-10 w-10 mx-auto opacity-30 mb-3" />
          <p className="text-sm">No recipes found for "{query}". Try a different search.</p>
        </div>
      )}

      {/* Recipe detail modal */}
      {selectedRecipe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setSelectedRecipe(null)}>
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto border-border/60 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="h-52 bg-muted relative overflow-hidden">
              {selectedRecipe.image && <img src={selectedRecipe.image} alt={selectedRecipe.label} className="object-cover w-full h-full" />}
              <button onClick={() => setSelectedRecipe(null)} className="absolute top-3 right-3 bg-black/50 text-white rounded-full p-1 hover:bg-black/70">
                <X className="h-4 w-4" />
              </button>
            </div>
            <CardHeader className="p-5 border-b border-border/40">
              <CardTitle className="font-serif text-lg font-bold">{selectedRecipe.label}</CardTitle>
              <p className="text-xs text-muted-foreground">{selectedRecipe.source}</p>
              <div className="grid grid-cols-5 gap-2 mt-3">
                {[{ label: "Cal", val: selectedRecipe.calories }, { label: "Protein", val: selectedRecipe.protein + "g" }, { label: "Carbs", val: selectedRecipe.carbs + "g" }, { label: "Fat", val: selectedRecipe.fat + "g" }, { label: "Fiber", val: selectedRecipe.fiber + "g" }].map(m => (
                  <div key={m.label} className="bg-muted/40 rounded-lg py-2 text-center">
                    <div className="text-sm font-bold">{m.val}</div>
                    <div className="text-[9px] text-muted-foreground">{m.label}</div>
                  </div>
                ))}
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Ingredients</h4>
                <ul className="space-y-1">
                  {selectedRecipe.ingredientLines.map((line, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs">
                      <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />{line}
                    </li>
                  ))}
                </ul>
              </div>
              <a
                href={selectedRecipe.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <Button className="w-full gap-2 text-xs">
                  View Full Recipe <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </a>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function Home() {
  const { user, loading: authLoading, isAuthenticated, logout } = useAuth();
  const utils = trpc.useUtils();

  // ---- DB queries ----
  const { start: todayStart, nowMs } = todayUTCRange();
  const [todayMs] = useState(() => nowMs);
  const todayLogsQuery = trpc.foodLogs.getByDate.useQuery(
    { dateMs: todayMs },
    { enabled: isAuthenticated }
  );
  const profileQuery = trpc.foodLogs.getProfile.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const allLogsQuery = trpc.foodLogs.getAll.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // ---- mutations ----
  const saveLogMutation = trpc.foodLogs.create.useMutation({
    onSuccess: () => {
      utils.foodLogs.getByDate.invalidate();
      utils.foodLogs.getAll.invalidate();
    },
  });
  const saveProfileMutation = trpc.foodLogs.saveProfile.useMutation({
    onSuccess: () => utils.foodLogs.getProfile.invalidate(),
  });
  const analyzeTranscript = trpc.nutrition.analyzeTranscript.useMutation();
  const uploadImageMutation = trpc.image.uploadImage.useMutation();
  const analyzeImageMutation = trpc.image.analyzeImage.useMutation();
  const logMealFromImageMutation = trpc.image.logMealFromImage.useMutation({
    onSuccess: () => {
      utils.foodLogs.getByDate.invalidate();
      utils.foodLogs.getAll.invalidate();
    },
  });
  const healthOverviewMutation = trpc.healthInsights.overview.useMutation();
  const healthChatMutation = trpc.healthInsights.chat.useMutation();
  // Passive mood capture — fire-and-forget, never surfaces in the chat.
  const moodCreateMutation = trpc.mood.create.useMutation();
  const deleteLogMutation = trpc.foodLogs.delete.useMutation({
    onSuccess: () => {
      utils.foodLogs.getByDate.invalidate();
      utils.foodLogs.getAll.invalidate();
      toast.success("Log entry deleted.");
    },
    onError: () => toast.error("Failed to delete log."),
  });
  const updateLogMutation = trpc.foodLogs.update.useMutation({
    onSuccess: () => {
      utils.foodLogs.getByDate.invalidate();
      utils.foodLogs.getAll.invalidate();
      setEditingLogId(null);
      toast.success("Log updated.");
    },
    onError: () => toast.error("Failed to update log."),
  });
  const downgradeToFreeMutation = trpc.billing.downgradeToFree.useMutation({
    onSuccess: () => {
      subscriptionQuery.refetch();
      toast.success("Downgraded to Free plan.");
    },
    onError: () => toast.error("Failed to downgrade. Please try again."),
  });
  const checkoutMutation = trpc.billing.createCheckoutSession.useMutation({
    onSuccess: (data) => {
      if (data.checkoutUrl) window.open(data.checkoutUrl, "_blank");
    },
    onError: () => toast.error("Could not start checkout. Please try again."),
  });
  const applyReferralCodeMutation = trpc.referral.applyCode.useMutation();
  const subscriptionQuery = trpc.billing.getSubscription.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // ---- UI state ----
  const [activeTab, setActiveTab] = useState<"home" | "dashboard" | "voice-logger" | "calendar" | "weekly-report" | "mood" | "settings" | "recipes" | "mealplan" | "travel" | "integrations" | "billing">("home");
  // Beta-Gated tabs must be unreachable, not just unlinked — if state ever
  // points at one while its flag is off, bounce back to the dashboard.
  useEffect(() => {
    if (
      (activeTab === "travel" && !FEATURE_FLAGS.travelSourcing) ||
      (activeTab === "integrations" && !FEATURE_FLAGS.integrations)
    ) {
      setActiveTab("dashboard");
    }
  }, [activeTab]);
  const [editingLogId, setEditingLogId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{ foodName: string; quantity: string; calories: string; protein: string; carbs: string; fat: string; fiber: string }>({ foodName: "", quantity: "", calories: "", protein: "", carbs: "", fat: "", fiber: "" });
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // ---- onboarding wizard (golden path: Welcome → Goal → First log → Notifications) ----
  const [onboardStep, setOnboardStep] = useState<OnboardStep>("welcome");
  const onboardStartedAtRef = useRef<number | null>(null);
  const [onboardGoal, setOnboardGoal] = useState<(typeof GOAL_OPTIONS)[number]["value"] | null>(null);
  const [onboardFirstLogDone, setOnboardFirstLogDone] = useState(false);
  const [onboardLogText, setOnboardLogText] = useState("");
  const [onboardLogBusy, setOnboardLogBusy] = useState(false);
  const [onboardRecording, setOnboardRecording] = useState(false);
  const [onboardLogWasVoice, setOnboardLogWasVoice] = useState(false);
  const [onboardReminderChoice, setOnboardReminderChoice] = useState<"reminder" | "none" | null>(null);
  const [onboardReminderTime, setOnboardReminderTime] = useState("18:00");
  const onboardPhotoInputRef = useRef<HTMLInputElement>(null);

  // ---- instrumentation (fire-and-forget; must never disturb the UX) ----
  const trackEventMutation = trpc.events.track.useMutation();
  const trackEvent = useCallback(
    (eventName: Parameters<typeof trackEventMutation.mutate>[0]["eventName"], properties: Record<string, unknown> = {}) => {
      trackEventMutation.mutate({ eventName, properties }, { onError: () => {} });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  // Batch-logging signal: how many meals landed in one visit to the logger.
  const logSessionCountRef = useRef(0);

  // ---- settings (goal / reminder / export email — spec Part 3) ----
  const settingsQuery = trpc.settings.get.useQuery(undefined, { enabled: isAuthenticated });
  const setGoalMutation = trpc.settings.setGoal.useMutation({
    onSuccess: () => settingsQuery.refetch(),
  });
  const setReminderMutation = trpc.settings.setReminder.useMutation({
    onSuccess: () => settingsQuery.refetch(),
  });
  const setExportEmailMutation = trpc.settings.setWeeklyExportEmail.useMutation({
    onSuccess: () => settingsQuery.refetch(),
  });
  const setMoodExtractionMutation = trpc.settings.setMoodExtraction.useMutation({
    onSuccess: () => settingsQuery.refetch(),
  });

  // ---- health profile editing (moved out of onboarding into Settings) ----
  const [settingsAge, setSettingsAge] = useState("");
  const [settingsWeight, setSettingsWeight] = useState("");
  const [settingsAllergies, setSettingsAllergies] = useState<string[]>([]);
  const [settingsDiet, setSettingsDiet] = useState<string[]>([]);
  const [settingsProfileLoaded, setSettingsProfileLoaded] = useState(false);
  useEffect(() => {
    if (settingsProfileLoaded || !profileQuery.data) return;
    const p = profileQuery.data;
    setSettingsAge(p.age != null ? String(p.age) : "");
    setSettingsWeight(p.weightLbs != null ? String(p.weightLbs) : "");
    setSettingsAllergies(p.allergies ?? []);
    setSettingsDiet(p.dietaryChoices ?? []);
    setSettingsProfileLoaded(true);
  }, [profileQuery.data, settingsProfileLoaded]);

  // ---- weekly report ----
  const weeklyReportQuery = trpc.weeklyExport.getReport.useQuery(undefined, { enabled: isAuthenticated });
  const [reportLastSeen, setReportLastSeen] = useState<number>(() =>
    Number(localStorage.getItem("clover-weekly-report-last-seen") ?? 0)
  );
  const weeklyReport = weeklyReportQuery.data;
  const weeklyReportReady = !!(
    weeklyReport && "periodEnd" in weeklyReport && weeklyReport.periodEnd > reportLastSeen
  );
  const reportViewTrackedRef = useRef(false);
  useEffect(() => {
    if (activeTab !== "weekly-report") {
      reportViewTrackedRef.current = false;
      return;
    }
    if (weeklyReport && "periodEnd" in weeklyReport) {
      localStorage.setItem("clover-weekly-report-last-seen", String(weeklyReport.periodEnd));
      setReportLastSeen(weeklyReport.periodEnd);
      if (!reportViewTrackedRef.current) {
        reportViewTrackedRef.current = true;
        trackEvent("weekly_export_viewed", { channel: "in_app" });
      }
    }
  }, [activeTab, weeklyReport, trackEvent]);

  // ---- voice logger chat ----
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [pendingTranscript, setPendingTranscript] = useState("");
  const [awaitingClarification, setAwaitingClarification] = useState(false);
  const [clarificationRound, setClarificationRound] = useState(0);
  const [clarificationHistory, setClarificationHistory] = useState<string[]>([]);
  const [speechErrorTip, setSpeechErrorTip] = useState<string | null>(null);
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState(false);
  const recognitionRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  // Distinguishes spoken vs typed entries for logMethod (voice-vs-photo metric).
  // Set when speech recognition produces text; cleared the moment the user types.
  const chatInputWasVoiceRef = useRef(false);
  // Method of the entry currently awaiting clarification, so a typed answer
  // to a clarifying question doesn't reclassify a voice log as text.
  const pendingMethodRef = useRef<"voice" | "text">("text");
  // Generation counter for cancelling in-flight analysis: Stop bumps the
  // counter and any pending async work sees the mismatch and discards itself.
  const analysisGenRef = useRef(0);
  // Log ids currently being undone (per-card spinner state).
  const [undoingLogIds, setUndoingLogIds] = useState<number[]>([]);

  // ---- calendar ----
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [calendarDayMs, setCalendarDayMs] = useState<number | null>(null);
  const calendarDayQuery = trpc.foodLogs.getByDate.useQuery(
    { dateMs: calendarDayMs ?? todayMs },
    { enabled: isAuthenticated && calendarDayMs !== null }
  );

  // ---- integrations ----
  const [integrations, setIntegrations] = useState({ appleHealth: false, googleCalendar: false, myFitnessPal: false });

  // ---- AI health overview ----
  const [overviewText, setOverviewText] = useState<string | null>(null);
  const [showOverview, setShowOverview] = useState(false);

  // ---- data-aware AI chat panel ----
  const [showAiChat, setShowAiChat] = useState(false);
  const [aiChatMessages, setAiChatMessages] = useState<{ role: "system" | "user" | "assistant"; content: string }[]>([
    { role: "system", content: "You are Clover, a friendly nutrition coach. Answer questions about the user's food logs." },
  ]);

  const handleAiChatSend = useCallback(async (content: string) => {
    const newMessages = [...aiChatMessages, { role: "user" as const, content }];
    setAiChatMessages(newMessages);
    try {
      const result = await healthChatMutation.mutateAsync({
        messages: newMessages
          .filter(m => m.role !== "system")
          .map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
      });
      setAiChatMessages(prev => [...prev, { role: "assistant" as const, content: String(result.reply) }]);
    } catch {
      setAiChatMessages(prev => [...prev, { role: "assistant" as const, content: "Sorry, I couldn't fetch a response. Please try again." }]);
    }
  }, [aiChatMessages, healthChatMutation]);

  // ---- recording timer ----
  useEffect(() => {
    let t: ReturnType<typeof setInterval>;
    if (isRecording) {
      t = setInterval(() => setRecordingDuration(p => p + 1), 1000);
    } else {
      setRecordingDuration(0);
    }
    return () => clearInterval(t);
  }, [isRecording]);

  // ---- auto-scroll chat ----
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // ---- derived values ----
  const dbLogs = todayLogsQuery.data ?? [];
  const profile = profileQuery.data;
  const calorieTarget = profile?.calorieTarget ?? 2000;
  const proteinTarget = profile?.proteinTarget ?? 120;
  const carbsTarget = profile?.carbsTarget ?? 200;
  const fatTarget = profile?.fatTarget ?? 65;
  const fiberTarget = profile?.fiberTarget ?? 28;

  const dailyTotals = dbLogs.reduce(
    (acc, l) => ({
      calories: acc.calories + Number(l.calories),
      protein: acc.protein + Number(l.protein),
      carbs: acc.carbs + Number(l.carbs),
      fat: acc.fat + Number(l.fat),
      fiber: acc.fiber + Number(l.fiber),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  );

  const pieData = [
    { name: "Protein", value: Math.round(dailyTotals.protein * 4), color: "#10b981" },
    { name: "Carbs", value: Math.round(dailyTotals.carbs * 4), color: "#3b82f6" },
    { name: "Fat", value: Math.round(dailyTotals.fat * 9), color: "#f59e0b" },
  ];

  // ---- chart data from all logs (last 7 days) ----
  const chartData = React.useMemo(() => {
    const days: { name: string; Calories: number; Target: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStart = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
      const dayEnd = dayStart + 86400000;
      const dayLogs = (allLogsQuery.data ?? []).filter(l => {
        const t = typeof l.loggedAt === "number" ? l.loggedAt : new Date(l.loggedAt).getTime();
        return t >= dayStart && t < dayEnd;
      });
      const cal = dayLogs.reduce((s, l) => s + Number(l.calories), 0);
      days.push({
        name: i === 0 ? "Today" : d.toLocaleDateString("en-US", { weekday: "short" }),
        Calories: Math.round(cal),
        Target: calorieTarget,
      });
    }
    return days;
  }, [allLogsQuery.data, calorieTarget]);

  // ---- allergen list from profile ----
  const knownAllergies: string[] = profile?.allergies ?? [];

  // ---- guest demo mode ----
  // Anonymous Supabase session: no onboarding, straight into the logger,
  // hard-capped at 10 AI analyses server-side.
  const isGuest = user?.loginMethod === "anonymous";
  const [guestLimitHit, setGuestLimitHit] = useState(false);
  useEffect(() => {
    if (isGuest) setActiveTab("voice-logger");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGuest]);

  // ---- onboarding check ----
  const needsOnboarding = isAuthenticated && !authLoading && !profileQuery.isLoading && !profile?.onboardingComplete && !isGuest;

  // Top of the onboarding funnel — fires once per wizard entry.
  useEffect(() => {
    if (needsOnboarding && onboardStartedAtRef.current === null) {
      onboardStartedAtRef.current = Date.now();
      trackEvent("onboarding_started");
    }
  }, [needsOnboarding, trackEvent]);

  // New logging session whenever the user enters the logger tab.
  useEffect(() => {
    if (activeTab === "voice-logger") logSessionCountRef.current = 0;
  }, [activeTab]);

  // ---------------------------------------------------------------------------
  // Onboarding handlers
  // ---------------------------------------------------------------------------
  const onboardStepIndex = ONBOARD_STEPS.indexOf(onboardStep);

  const advanceOnboard = async () => {
    const next = ONBOARD_STEPS[onboardStepIndex + 1];
    if (onboardStep === "goal") {
      // Persist goal choice (skip = general_awareness, the DB default — no call needed)
      trackEvent("goal_selected", { goal: onboardGoal ?? "skipped" });
      if (onboardGoal && onboardGoal !== "general_awareness") {
        try {
          await setGoalMutation.mutateAsync({ goal: onboardGoal });
        } catch {
          // Non-blocking — the default goal still produces a valid weekly report
        }
      }
      setOnboardStep("first-log");
    } else if (onboardStep === "notifications") {
      // Persist the explicit notification choice, then complete onboarding.
      try {
        if (onboardReminderChoice === "reminder") {
          await setReminderMutation.mutateAsync({ enabled: true, time: onboardReminderTime });
        }
        trackEvent("notification_preference_set", {
          enabled: onboardReminderChoice === "reminder",
          time: onboardReminderChoice === "reminder" ? onboardReminderTime : null,
        });
        await saveProfileMutation.mutateAsync({ onboardingComplete: 1 });
        if (onboardStartedAtRef.current !== null) {
          trackEvent("onboarding_completed", {
            duration_seconds: Math.round((Date.now() - onboardStartedAtRef.current) / 1000),
          });
        }
        toast.success("Welcome to Clover — you're all set.");
        setOnboardStep("done");
      } catch {
        toast.error("Something went wrong finishing setup. Please try again.");
      }
    } else {
      setOnboardStep(next);
    }
  };

  /**
   * First log inside onboarding — single-shot (no clarification round; the
   * "aha moment" should land in seconds, not a Q&A). The clarification
   * context tells the model to use best estimates instead of asking.
   */
  const handleOnboardingTextLog = async () => {
    const text = onboardLogText.trim();
    if (!text || onboardLogBusy) return;
    setOnboardLogBusy(true);
    try {
      const result = await analyzeTranscript.mutateAsync({
        transcript: text,
        clarificationContext: "First log during onboarding — use best-guess estimates, do not ask follow-up questions.",
        knownAllergies,
      });
      for (const m of result.meals) {
        await saveLogMutation.mutateAsync({
          rawSpeech: text,
          foodName: m.foodName,
          quantity: m.quantity,
          calories: m.calories,
          protein: m.protein,
          carbs: m.carbs,
          fat: m.fat,
          fiber: m.fiber ?? 0,
          allergensDetected: m.allergensDetected,
          micronutrients: m.micronutrients,
          confidence: result.confidence,
          notes: result.notes ?? undefined,
          logMethod: onboardLogWasVoice ? "voice" : "text",
          mealPeriod: m.mealPeriod,
          dayOffset: m.dayOffset as 0 | -1,
        });
      }
      if (result.meals.length === 0) {
        toast.error("That didn't sound like a meal — try describing what you ate, e.g. \"two eggs on toast\".");
        return;
      }
      setOnboardFirstLogDone(true);
      trackEvent("first_log_completed", { method: onboardLogWasVoice ? "voice" : "text" });
      toast.success(`Logged: ${result.meals.map(m => m.foodName).join(", ")}`);
    } catch {
      toast.error("That one didn't go through — try rephrasing, or use a photo instead.");
    } finally {
      setOnboardLogBusy(false);
    }
  };

  const handleOnboardingPhotoLog = (file: File) => {
    setOnboardLogBusy(true);
    const reader = new FileReader();
    reader.onload = async e => {
      try {
        const dataUrl = e.target?.result as string;
        const base64 = dataUrl.split(",")[1];
        if (!base64) throw new Error("encode failed");
        const uploadResult = await uploadImageMutation.mutateAsync({ imageData: base64, fileName: file.name });
        const absoluteUrl = uploadResult.url.startsWith("http")
          ? uploadResult.url
          : `${window.location.origin}${uploadResult.url}`;
        const analysis = await analyzeImageMutation.mutateAsync({ imageUrl: absoluteUrl });
        await logMealFromImageMutation.mutateAsync({
          imageUrl: absoluteUrl,
          foodDescription: analysis.foodDescription,
          calories: analysis.calories,
          protein: analysis.protein,
          carbs: analysis.carbs,
          fat: analysis.fat,
          fiber: analysis.fiber,
          allergens: analysis.allergens,
          confidence: analysis.confidence,
        });
        setOnboardFirstLogDone(true);
        trackEvent("first_log_completed", { method: "photo" });
        toast.success(`Logged: ${analysis.foodDescription}`);
      } catch {
        toast.error("That photo didn't go through — try another, or describe the meal instead.");
      } finally {
        setOnboardLogBusy(false);
      }
    };
    reader.onerror = () => {
      toast.error("Couldn't read that image file.");
      setOnboardLogBusy(false);
    };
    reader.readAsDataURL(file);
  };

  const startOnboardingRecording = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast.error("Voice input isn't supported in this browser — type your meal instead.");
      return;
    }
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";
    let final = "";
    rec.onstart = () => setOnboardRecording(true);
    rec.onerror = () => {
      setOnboardRecording(false);
      toast.error("Voice input hit a snag — you can type your meal instead.");
    };
    rec.onend = () => setOnboardRecording(false);
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript + " ";
        else interim += e.results[i][0].transcript;
      }
      setOnboardLogText(final + interim);
      if (final) setOnboardLogWasVoice(true);
    };
    rec.start();
  };

  const toggleArr = (arr: string[], val: string) =>
    arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];

  // ---------------------------------------------------------------------------
  // Voice logger / chat handlers
  // ---------------------------------------------------------------------------
  const addChatMsg = useCallback((msg: Omit<ChatMessage, "id">) => {
    setChatMessages(prev => [...prev, { ...msg, id: `${Date.now()}-${Math.random()}` }]);
  }, []);

  // We only ever ask ONE clarifying question per meal (bundling every
  // ambiguous detail into it) — the prompt asks the model to comply, and
  // `round` is the client-side backstop: on the second pass we finalize
  // with whatever we have regardless of what the model returns.
  const processText = useCallback(async (text: string, clarificationCtx: string | undefined, round: number, method: "voice" | "text") => {
    const gen = analysisGenRef.current;
    setIsAnalyzing(true);
    try {
      const result = await analyzeTranscript.mutateAsync({
        transcript: text,
        clarificationContext: clarificationCtx,
        knownAllergies,
      });
      // User hit Stop while the model was thinking — discard everything.
      if (analysisGenRef.current !== gen) return;

      // Conversational turn (question, symptom mention, greeting) — the model
      // answers from the user's data. May accompany meals or stand alone.
      if (result.reply) {
        addChatMsg({ role: "ai", text: result.reply });
      }

      if (result.meals.length === 0) {
        // Nothing to log — pure conversation. No log events, no cards.
        if (!result.reply) {
          addChatMsg({ role: "ai", text: "I didn't catch a meal in that — describe what you ate, or ask me anything about your nutrition." });
        }
        // Silent mood capture (retrospective by design — no inline surfacing)
        if (result.moodContext) {
          moodCreateMutation.mutate(
            {
              source: "chat_extracted",
              feelingTags: result.moodContext.feelingTags,
              contextTags: result.moodContext.contextTags,
              energy: result.moodContext.energy,
              ease: result.moodContext.ease,
              sourceText: text,
            },
            { onError: () => {} }
          );
        }
        setIsAnalyzing(false);
        return;
      }

      // Log-attempt funnel events only count messages that carried food.
      if (round === 0) trackEvent("log_attempt_started", { method });

      if (result.clarifyingQuestion && round === 0) {
        setAwaitingClarification(true);
        setClarificationRound(1);
        setPendingTranscript(text);
        pendingMethodRef.current = method;
        addChatMsg({
          role: "ai",
          text: result.clarifyingQuestion,
          confidence: result.confidence,
        });
        setIsAnalyzing(false);
        return;
      }

      // Save each meal (one message can describe several eating occasions)
      const entries: LoggedMealEntry[] = [];
      for (const m of result.meals) {
        const saved = await saveLogMutation.mutateAsync({
          rawSpeech: clarificationCtx ? `${text} | Clarified: ${clarificationCtx}` : text,
          foodName: m.foodName,
          quantity: m.quantity,
          calories: m.calories,
          protein: m.protein,
          carbs: m.carbs,
          fat: m.fat,
          fiber: m.fiber ?? 0,
          allergensDetected: m.allergensDetected,
          micronutrients: m.micronutrients,
          confidence: result.confidence,
          notes: result.notes ?? undefined,
          logMethod: method,
          mealPeriod: m.mealPeriod,
          dayOffset: m.dayOffset as 0 | -1,
        });
        entries.push({
          logId: saved.id,
          foodName: m.foodName,
          calories: m.calories,
          protein: m.protein,
          carbs: m.carbs,
          fat: m.fat,
          fiber: m.fiber ?? 0,
          allergens: m.allergensDetected,
          mealPeriod: m.mealPeriod,
          dayOffset: m.dayOffset,
        });
      }
      setAwaitingClarification(false);
      setPendingTranscript("");
      setClarificationRound(0);
      setClarificationHistory([]);
      logSessionCountRef.current += entries.length;
      trackEvent("log_attempt_succeeded", { method, meal_count_in_session: logSessionCountRef.current });

      // Silent mood capture, linked to the log it came with (retrospective —
      // discoverable in the trends view, never surfaced here)
      if (result.moodContext) {
        moodCreateMutation.mutate(
          {
            source: "chat_extracted",
            feelingTags: result.moodContext.feelingTags,
            contextTags: result.moodContext.contextTags,
            energy: result.moodContext.energy,
            ease: result.moodContext.ease,
            linkedFoodLogId: entries[0]?.logId,
            sourceText: text,
          },
          { onError: () => {} }
        );
      }

      addChatMsg({
        role: "ai",
        text: "",
        confidence: result.confidence,
        logSaved: true,
        loggedMeals: entries,
        notes: result.notes,
      });
    } catch (err: any) {
      if (analysisGenRef.current !== gen) return; // cancelled — stay quiet
      const msg = err?.message ?? "";
      if (msg.includes("guest analyses")) {
        setGuestLimitHit(true);
        trackEvent("log_attempt_failed", { method, reason: "guest_limit" });
        addChatMsg({ role: "ai", text: msg });
      } else if (msg.includes("AI call limit") || msg.includes("Upgrade")) {
        setShowUpgradeModal(true);
        trackEvent("log_attempt_failed", { method, reason: "ai_call_limit" });
        addChatMsg({ role: "ai", text: "You've reached your free tier limit (10 AI logs/month). Upgrade to Clover Plus for unlimited logging! 🌿" });
      } else {
        trackEvent("log_attempt_failed", { method, reason: msg.slice(0, 200) || "unknown" });
        addChatMsg({ role: "ai", text: "Sorry, analysis failed. Please try again." });
      }
    } finally {
      if (analysisGenRef.current === gen) setIsAnalyzing(false);
    }
  }, [analyzeTranscript, saveLogMutation, addChatMsg, knownAllergies, trackEvent]);

  /** Stop button: discard the in-flight analysis. Nothing gets logged. */
  const handleCancelAnalysis = () => {
    analysisGenRef.current += 1;
    setIsAnalyzing(false);
    setIsAnalyzingPhoto(false);
    addChatMsg({ role: "ai", text: "Stopped — nothing was logged. Edit your message and try again whenever you like." });
  };

  /** In-chat undo: delete the saved log and mark its card as removed. */
  const handleUndoLog = async (messageId: string, logId: number) => {
    setUndoingLogIds(prev => [...prev, logId]);
    try {
      await deleteLogMutation.mutateAsync({ id: logId });
      setChatMessages(prev =>
        prev.map(m =>
          m.id === messageId
            ? {
                ...m,
                loggedMeals: m.loggedMeals?.map(e => (e.logId === logId ? { ...e, undone: true } : e)),
              }
            : m
        )
      );
      toast.success("Log removed");
    } catch {
      toast.error("Couldn't remove that log — try again.");
    } finally {
      setUndoingLogIds(prev => prev.filter(id => id !== logId));
    }
  };

  const handleCopyMessage = async (msg: ChatMessage) => {
    const text =
      msg.text ||
      (msg.loggedMeals ?? [])
        .map(m => `${m.foodName} — ${Math.round(m.calories)} kcal, ${Math.round(m.protein)}g protein, ${Math.round(m.carbs)}g carbs, ${Math.round(m.fat)}g fat`)
        .join("\n");
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied");
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  };

  /** Redo: put a previous message back into the input bar for editing/resending. */
  const handleEditMessage = (msg: ChatMessage) => {
    setChatInput(msg.text);
    chatInputWasVoiceRef.current = false;
  };

  const handleSendChat = async () => {
    const text = chatInput.trim();
    if (!text || isAnalyzing) return;
    setChatInput("");

    addChatMsg({ role: "user", text });

    if (awaitingClarification) {
      const history = [...clarificationHistory, text];
      setClarificationHistory(history);
      await processText(pendingTranscript, history.join("; "), clarificationRound, pendingMethodRef.current);
    } else {
      const method = chatInputWasVoiceRef.current ? "voice" : "text";
      chatInputWasVoiceRef.current = false;
      await processText(text, undefined, 0, method);
    }
  };

  const handleSkipClarification = async () => {
    if (!pendingTranscript) return;
    addChatMsg({ role: "user", text: "Log it anyway — use your best guess" });
    const history = [...clarificationHistory, "User chose to log anyway — use best estimates."];
    setClarificationHistory(history);
    await processText(pendingTranscript, history.join("; "), clarificationRound, pendingMethodRef.current);
  };

  const handlePhotoSelected = (file: File) => {
    const gen = analysisGenRef.current;
    setIsAnalyzingPhoto(true);
    trackEvent("log_attempt_started", { method: "photo" });
    const reader = new FileReader();
    reader.onload = async e => {
      try {
        const dataUrl = e.target?.result as string;
        const base64 = dataUrl.split(",")[1];
        if (!base64) throw new Error("Failed to encode image");

        addChatMsg({ role: "user", text: "", imageDataUrl: dataUrl });

        const uploadResult = await uploadImageMutation.mutateAsync({
          imageData: base64,
          fileName: file.name,
        });
        if (analysisGenRef.current !== gen) return;
        const absoluteUrl = uploadResult.url.startsWith("http")
          ? uploadResult.url
          : `${window.location.origin}${uploadResult.url}`;

        const analysis = await analyzeImageMutation.mutateAsync({ imageUrl: absoluteUrl });
        if (analysisGenRef.current !== gen) return;

        const saved = await logMealFromImageMutation.mutateAsync({
          imageUrl: absoluteUrl,
          foodDescription: analysis.foodDescription,
          calories: analysis.calories,
          protein: analysis.protein,
          carbs: analysis.carbs,
          fat: analysis.fat,
          fiber: analysis.fiber,
          allergens: analysis.allergens,
          confidence: analysis.confidence,
        });

        logSessionCountRef.current += 1;
        trackEvent("log_attempt_succeeded", { method: "photo", meal_count_in_session: logSessionCountRef.current });

        addChatMsg({
          role: "ai",
          text: "",
          confidence: analysis.confidence,
          logSaved: true,
          loggedMeals: [
            {
              logId: saved.id,
              foodName: analysis.foodDescription,
              calories: analysis.calories,
              protein: analysis.protein,
              carbs: analysis.carbs,
              fat: analysis.fat,
              fiber: analysis.fiber,
              allergens: analysis.allergens,
              mealPeriod: null,
              dayOffset: 0,
            },
          ],
        });
      } catch (err: any) {
        if (analysisGenRef.current !== gen) return; // cancelled — stay quiet
        const msg = err?.message ?? "";
        if (msg.includes("guest analyses")) {
          setGuestLimitHit(true);
          trackEvent("log_attempt_failed", { method: "photo", reason: "guest_limit" });
          addChatMsg({ role: "ai", text: msg });
        } else if (msg.includes("AI call limit") || msg.includes("Upgrade")) {
          setShowUpgradeModal(true);
          trackEvent("log_attempt_failed", { method: "photo", reason: "ai_call_limit" });
          addChatMsg({ role: "ai", text: "You've reached your free tier limit. Upgrade to Clover Plus for unlimited logging! 🌿" });
        } else {
          trackEvent("log_attempt_failed", { method: "photo", reason: msg.slice(0, 200) || "unknown" });
          addChatMsg({ role: "ai", text: "Sorry, that photo couldn't be analyzed. Please try again." });
        }
      } finally {
        if (analysisGenRef.current === gen) setIsAnalyzingPhoto(false);
      }
    };
    reader.onerror = () => {
      trackEvent("log_attempt_failed", { method: "photo", reason: "file_read_error" });
      toast.error("Failed to read image file");
      setIsAnalyzingPhoto(false);
    };
    reader.readAsDataURL(file);
  };

  /**
   * Voice input, chat-app style: recording buffers the transcript privately —
   * nothing appears while you speak. Tapping the mic again stops recording
   * and drops the full transcript into the input bar, where it waits for the
   * user to press Send. No auto-send, ever.
   */
  const startRecording = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setSpeechErrorTip("Web Speech API not supported in this browser. Use the text input below.");
      toast.error("Microphone not supported — use the text box.");
      return;
    }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = false; // buffer silently; only final results are kept
    rec.lang = "en-US";
    let finalTranscript = "";
    rec.onstart = () => { setIsRecording(true); setSpeechErrorTip(null); };
    rec.onerror = (e: any) => {
      setIsRecording(false);
      if (e.error === "network") {
        setSpeechErrorTip("Chrome's cloud speech service was blocked. Use the text input instead.");
      } else if (e.error !== "aborted") {
        setSpeechErrorTip(`Mic error: ${e.error}. Check browser permissions.`);
      }
    };
    rec.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalTranscript += e.results[i][0].transcript + " ";
      }
    };
    rec.onend = () => {
      setIsRecording(false);
      const spoken = finalTranscript.trim();
      if (spoken) {
        // Append to whatever's already typed, then hand control back to the user.
        setChatInput(prev => (prev.trim() ? `${prev.trim()} ${spoken}` : spoken));
        chatInputWasVoiceRef.current = true;
      } else {
        toast.warning("No speech detected.");
      }
    };
    rec.start();
    recognitionRef.current = rec;
  };

  const stopRecording = () => {
    // Just stop — onend places the transcript in the input bar. Send stays manual.
    recognitionRef.current?.stop();
  };

  // ---------------------------------------------------------------------------
  // Calendar helpers
  // ---------------------------------------------------------------------------
  function calendarDays() {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return { firstDay, daysInMonth, year, month };
  }

  const logsByDay = React.useMemo(() => {
    const map: Record<string, number> = {};
    (allLogsQuery.data ?? []).forEach(l => {
      const d = new Date(typeof l.loggedAt === "number" ? l.loggedAt : Number(l.loggedAt));
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      map[key] = (map[key] ?? 0) + Number(l.calories);
    });
    return map;
  }, [allLogsQuery.data]);

  // ---------------------------------------------------------------------------
  // Auth loading
  // ---------------------------------------------------------------------------
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 1. LOGIN WALL
  // ---------------------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-primary/5 via-transparent to-transparent px-4">
        <div className="w-full max-w-md space-y-8 bg-card border border-border/40 p-8 rounded-2xl shadow-xl">
          <div className="text-center space-y-3">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Leaf className="h-6 w-6" />
            </div>
            <h2 className="text-3xl font-serif font-bold tracking-tight">Clover Wellness</h2>
            <p className="text-sm text-muted-foreground">
              The zero-friction, voice-activated wellness and seasonal meal companion.
            </p>
          </div>
          <Button
            onClick={() => { window.location.href = getLoginUrl(); }}
            className="w-full h-11 gap-3"
          >
            <Leaf className="h-5 w-5" />
            Sign in with GitHub
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            By continuing, you agree to Clover's Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 2. ONBOARDING WIZARD (step-by-step)
  // ---------------------------------------------------------------------------
  if (needsOnboarding) {
    const stepIdx = ONBOARD_STEPS.indexOf(onboardStep);
    const totalSteps = ONBOARD_STEPS.length - 1; // exclude "done"
    const progressPct = Math.round((stepIdx / totalSteps) * 100);

    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20 px-4 py-12">
        <div className="w-full max-w-lg">
          {/* Progress bar */}
          <div className="mb-6 space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Setting up your profile</span>
              <span>{stepIdx} / {totalSteps}</span>
            </div>
            <Progress value={progressPct} className="h-1.5" />
          </div>

          <Card className="border-border/60 shadow-lg">
            <CardContent className="p-6 space-y-6 min-h-[260px]">
              {onboardStep === "welcome" && (
                <div className="space-y-4 text-center py-4">
                  <div className="flex items-center justify-center gap-2 text-primary font-serif font-bold text-2xl">
                    <Leaf className="h-7 w-7" /> Clover
                  </div>
                  <h3 className="font-serif text-xl font-bold">Food, in context — not on trial.</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                    Clover is about understanding what you eat, not judging it. A quick photo or a few
                    spoken words, whenever it suits you — no calorie courtroom, no guilt about missed days.
                  </p>
                </div>
              )}
              {onboardStep === "goal" && (
                <div className="space-y-4">
                  <h3 className="font-serif text-xl font-bold">What matters most to you right now?</h3>
                  <p className="text-sm text-muted-foreground">This shapes what your weekly summary highlights. You can change it anytime.</p>
                  <div className="space-y-2">
                    {GOAL_OPTIONS.map(g => (
                      <button
                        key={g.value}
                        type="button"
                        onClick={() => setOnboardGoal(g.value)}
                        className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${
                          onboardGoal === g.value
                            ? "border-primary bg-primary/5"
                            : "border-border/60 hover:border-border"
                        }`}
                      >
                        <span className="block text-sm font-medium">{g.label}</span>
                        <span className="block text-xs text-muted-foreground mt-0.5">{g.description}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {onboardStep === "first-log" && (
                <div className="space-y-4">
                  <h3 className="font-serif text-xl font-bold">Log your first meal — right now.</h3>
                  <p className="text-sm text-muted-foreground">
                    Whatever you ate last: speak it, type it, or snap it. This is the whole app — it takes seconds.
                  </p>
                  {onboardFirstLogDone ? (
                    <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3">
                      <div className="h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                        <Check className="h-4 w-4 text-white" />
                      </div>
                      <p className="text-sm text-emerald-800 font-medium">First meal logged — that's it, that's the habit.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex gap-2 items-center border border-border/60 rounded-2xl bg-card px-3 py-2">
                        <button
                          type="button"
                          onClick={startOnboardingRecording}
                          disabled={onboardLogBusy}
                          className={`shrink-0 h-9 w-9 rounded-full flex items-center justify-center transition-colors ${
                            onboardRecording
                              ? "bg-destructive text-destructive-foreground animate-pulse"
                              : "bg-primary/10 text-primary hover:bg-primary/20"
                          }`}
                          title="Speak your meal"
                        >
                          <Mic className="h-4 w-4" />
                        </button>
                        <Input
                          value={onboardLogText}
                          onChange={e => { setOnboardLogText(e.target.value); setOnboardLogWasVoice(false); }}
                          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleOnboardingTextLog(); } }}
                          placeholder='e.g. "two eggs on toast and a coffee"'
                          className="border-0 shadow-none focus-visible:ring-0 text-sm bg-transparent"
                          disabled={onboardLogBusy}
                        />
                        <Button
                          size="sm"
                          onClick={handleOnboardingTextLog}
                          disabled={!onboardLogText.trim() || onboardLogBusy}
                          className="shrink-0 h-9 w-9 p-0 rounded-full"
                        >
                          {onboardLogBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="h-px bg-border/60 flex-1" />
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">or</span>
                        <div className="h-px bg-border/60 flex-1" />
                      </div>
                      <input
                        ref={onboardPhotoInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) handleOnboardingPhotoLog(file);
                          e.target.value = "";
                        }}
                      />
                      <Button
                        variant="outline"
                        className="w-full gap-2"
                        disabled={onboardLogBusy}
                        onClick={() => onboardPhotoInputRef.current?.click()}
                      >
                        <Camera className="h-4 w-4" /> Snap a photo of a meal
                      </Button>
                    </div>
                  )}
                </div>
              )}
              {onboardStep === "notifications" && (
                <div className="space-y-4">
                  <h3 className="font-serif text-xl font-bold">Want a daily nudge?</h3>
                  <p className="text-sm text-muted-foreground">
                    Entirely your call — Clover works just as well without one. You can change this anytime in Settings.
                  </p>
                  {/* Both options carry equal visual weight — "no reminders" is a full-size choice, not a buried link. */}
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setOnboardReminderChoice("reminder")}
                      className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${
                        onboardReminderChoice === "reminder" ? "border-primary bg-primary/5" : "border-border/60 hover:border-border"
                      }`}
                    >
                      <span className="block text-sm font-medium">Remind me once a day</span>
                      <span className="block text-xs text-muted-foreground mt-0.5">One reminder at a time you pick. No escalation, no re-prompts.</span>
                      {onboardReminderChoice === "reminder" && (
                        <input
                          type="time"
                          value={onboardReminderTime}
                          onChange={e => setOnboardReminderTime(e.target.value)}
                          onClick={e => e.stopPropagation()}
                          className="mt-2 rounded-md border border-input bg-background px-2 py-1 text-sm"
                        />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setOnboardReminderChoice("none")}
                      className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${
                        onboardReminderChoice === "none" ? "border-primary bg-primary/5" : "border-border/60 hover:border-border"
                      }`}
                    >
                      <span className="block text-sm font-medium">No reminders — I'll log on my own time</span>
                      <span className="block text-xs text-muted-foreground mt-0.5">Clover never pings you. Logging stays entirely on your schedule.</span>
                    </button>
                  </div>
                </div>
              )}
            </CardContent>

            <div className="px-6 pb-6 flex justify-between items-center">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={() => {
                  if (stepIdx > 0) setOnboardStep(ONBOARD_STEPS[stepIdx - 1]);
                }}
                disabled={stepIdx === 0}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <div className="flex items-center gap-3">
                {onboardStep === "goal" && onboardGoal === null && (
                  <button
                    type="button"
                    onClick={() => { trackEvent("goal_selected", { goal: "skipped" }); setOnboardGoal("general_awareness"); setOnboardStep("first-log"); }}
                    className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                  >
                    Skip — just general awareness
                  </button>
                )}
                {onboardStep === "first-log" && !onboardFirstLogDone && (
                  <button
                    type="button"
                    onClick={() => setOnboardStep("notifications")}
                    className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                  >
                    Skip for now
                  </button>
                )}
                <Button
                  onClick={advanceOnboard}
                  disabled={
                    saveProfileMutation.isPending ||
                    setGoalMutation.isPending ||
                    setReminderMutation.isPending ||
                    onboardLogBusy ||
                    (onboardStep === "goal" && onboardGoal === null) ||
                    (onboardStep === "first-log" && !onboardFirstLogDone) ||
                    (onboardStep === "notifications" && onboardReminderChoice === null)
                  }
                  className="gap-2"
                >
                  {saveProfileMutation.isPending || setGoalMutation.isPending || setReminderMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : onboardStep === "welcome" ? (
                    <>Get started <ChevronRight className="h-4 w-4" /></>
                  ) : onboardStep === "notifications" ? (
                    <>Finish <Check className="h-4 w-4" /></>
                  ) : (
                    <>Next <ChevronRight className="h-4 w-4" /></>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 3. MAIN APP
  // ---------------------------------------------------------------------------
  return (
    <SidebarProvider>
    <div className="min-h-screen flex flex-col md:flex-row bg-background text-foreground font-sans w-full">

      {/* ---- Sidebar (desktop fixed, mobile drawer) ---- */}
      <Sidebar collapsible="offcanvas" className="border-r border-border/40">
      <aside className="w-full bg-card flex flex-col justify-between h-full">
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-2 font-serif text-xl font-bold text-primary">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Leaf className="h-5 w-5" />
            </div>
            <span>Clover AI</span>
          </div>

          {/* User summary */}
          <div className="p-4 bg-muted/30 rounded-xl border border-border/40 space-y-1">
            <div className="text-xs font-bold text-foreground">{user?.name ?? "Wellness Explorer"}</div>
            <div className="text-[10px] text-muted-foreground flex flex-wrap gap-1">
              {(profile?.dietaryChoices ?? []).map(d => (
                <span key={d} className="bg-primary/5 px-1.5 py-0.5 rounded text-primary">{d}</span>
              ))}
              {(profile?.allergies ?? []).map(a => (
                <span key={a} className="bg-destructive/10 px-1.5 py-0.5 rounded text-destructive">{a}</span>
              ))}
            </div>
          </div>

          {/* Nav — Core golden-path items only; Peripheral lives under "More"
              and Beta-Gated features (travel, integrations) have no entry at
              all, per clover-feature-exposure-rules.md */}
          <nav className="space-y-1">
            {([
              { id: "home" as const, label: "Home", icon: Leaf, pulse: false, dot: false },
              { id: "voice-logger" as const, label: "Log a Meal", icon: Mic, pulse: true, dot: false },
              { id: "calendar" as const, label: "Past Logs", icon: Calendar, pulse: false, dot: false },
              { id: "weekly-report" as const, label: "Weekly Report", icon: Sparkles, pulse: false, dot: weeklyReportReady },
              { id: "mood" as const, label: "How You've Felt", icon: Heart, pulse: false, dot: false },
              { id: "settings" as const, label: "Settings", icon: Pencil, pulse: false, dot: false },
            ]).map(({ id, label, icon: Icon, pulse, dot }) => (
              <Button
                key={id}
                variant={activeTab === id ? "secondary" : "ghost"}
                className="w-full justify-start gap-2.5 text-xs font-medium relative"
                onClick={() => setActiveTab(id)}
              >
                <Icon className="h-4 w-4" /> {label}
                {pulse && <span className="absolute right-3 top-2.5 h-2 w-2 rounded-full bg-primary animate-pulse" />}
                {/* Low-key "report ready" indicator — deliberately not a notification */}
                {dot && <span className="absolute right-3 top-2.5 h-2 w-2 rounded-full bg-emerald-500" />}
              </Button>
            ))}
          </nav>

          {/* Peripheral features — secondary entry point, low emphasis */}
          <div className="mt-4 pt-3 border-t border-border/30">
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">More</p>
            <nav className="space-y-0.5">
              {([
                { id: "dashboard" as const, label: "My Stats", icon: BarChart3 },
                ...(FEATURE_FLAGS.curatedRecipes ? [{ id: "recipes" as const, label: "Curated Recipes", icon: Apple }] : []),
                ...(FEATURE_FLAGS.mealPlanning ? [{ id: "mealplan" as const, label: "Meal Planning", icon: Wheat }] : []),
                ...(FEATURE_FLAGS.billing ? [{ id: "billing" as const, label: "Manage Plan", icon: CreditCard }] : []),
              ]).map(({ id, label, icon: Icon }) => (
                <Button
                  key={id}
                  variant={activeTab === id ? "secondary" : "ghost"}
                  size="sm"
                  className="w-full justify-start gap-2.5 text-xs font-normal text-muted-foreground"
                  onClick={() => setActiveTab(id)}
                >
                  <Icon className="h-3.5 w-3.5" /> {label}
                </Button>
              ))}
            </nav>
          </div>

          {/* Admin link — only visible to admins */}
          {user?.role === "admin" && (
            <div className="mt-4 pt-4 border-t border-border/30">
              <a
                href="/admin"
                className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium rounded-md text-violet-700 bg-violet-50 hover:bg-violet-100 transition-colors"
              >
                <Shield className="h-4 w-4" />
                Admin Panel
              </a>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-border/40 space-y-3">
          {/* Subscription / guest badge */}
          {isGuest ? (
            <div className="space-y-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2.5">
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-semibold text-primary">Guest demo</span>
                <span className="text-muted-foreground">
                  {Math.min(subscriptionQuery.data?.aiCallsUsed ?? 0, 10)} / 10 free analyses
                </span>
              </div>
              <a
                href={getLoginUrl()}
                className="block text-center text-[11px] font-medium rounded-md bg-primary text-primary-foreground py-1.5 hover:opacity-90 transition-opacity"
              >
                Create a free account
              </a>
            </div>
          ) : subscriptionQuery.data ? (
            <div className="flex items-center justify-between text-[10px] text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
              <span className="flex items-center gap-1.5">
                <Crown className="h-3 w-3 text-amber-500" />
                <span className="font-semibold capitalize">{subscriptionQuery.data.tier}</span>
              </span>
              <span>{subscriptionQuery.data.aiCallsUsed} / {subscriptionQuery.data.aiCallsLimit === Infinity ? "∞" : subscriptionQuery.data.aiCallsLimit} AI calls</span>
            </div>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="w-full justify-start gap-2 text-xs text-muted-foreground hover:text-destructive"
          >
            <LogOut className="h-4 w-4" /> Log Out
          </Button>
        </div>
      </aside>
      </Sidebar>

      {/* ---- Main content ---- */}
      <SidebarInset className="flex-1 bg-muted/10 overflow-y-auto">
        {/* Mobile sticky header with hamburger */}
        <header className="sticky top-0 z-20 flex md:hidden items-center gap-3 bg-background/95 backdrop-blur border-b border-border/40 px-4 py-3">
          <SidebarTrigger className="h-8 w-8" />
          <div className="flex items-center gap-2 font-serif font-bold text-primary">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Leaf className="h-4 w-4" />
            </div>
            <span className="text-sm">Clover AI</span>
          </div>
          <div className="ml-auto text-xs text-muted-foreground capitalize font-medium">{activeTab.replace("-", " ")}</div>
        </header>
        <div className="p-6 md:p-10">

        {/* ===== GOLDEN-PATH HOME ===== */}
        {activeTab === "home" && (
          <div className="max-w-xl mx-auto space-y-8 pt-8">
            {/* One dominant CTA — the whole point of the screen */}
            <div className="text-center space-y-6">
              <h2 className="font-serif text-2xl font-bold">
                {(() => {
                  const h = new Date().getHours();
                  const name = user?.name?.split(" ")[0];
                  const greeting = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
                  return name ? `${greeting}, ${name}` : greeting;
                })()}
              </h2>
              <Button
                size="lg"
                className="h-16 px-10 text-base gap-3 rounded-2xl shadow-md"
                onClick={() => setActiveTab("voice-logger")}
              >
                <Mic className="h-5 w-5" /> Log a meal
              </Button>
              {/* Presence, not judgment: a count, never a progress bar or target */}
              <p className="text-sm text-muted-foreground">
                {(() => {
                  const n = (todayLogsQuery.data ?? []).length;
                  if (n === 0) return "Nothing logged yet today — no rush.";
                  return `${n} meal${n === 1 ? "" : "s"} logged today`;
                })()}
              </p>
            </div>

            {/* Quick mood check-in — optional, no streaks, nothing required */}
            <MoodCheckInCard />

            {/* Quiet access points: past logs + weekly report */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setActiveTab("calendar")}
                className="rounded-xl border border-border/60 bg-card px-4 py-4 text-left hover:border-border transition-colors"
              >
                <Calendar className="h-4 w-4 text-muted-foreground mb-2" />
                <span className="block text-sm font-medium">Past logs</span>
                <span className="block text-xs text-muted-foreground mt-0.5">Everything you've logged</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("weekly-report")}
                className="relative rounded-xl border border-border/60 bg-card px-4 py-4 text-left hover:border-border transition-colors"
              >
                <Sparkles className="h-4 w-4 text-muted-foreground mb-2" />
                <span className="block text-sm font-medium">Weekly report</span>
                <span className="block text-xs text-muted-foreground mt-0.5">
                  {weeklyReportReady ? "A new one is ready" : "Your week, kindly summarized"}
                </span>
                {weeklyReportReady && (
                  <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-emerald-500" />
                )}
              </button>
            </div>
          </div>
        )}

        {/* ===== A. STATS DASHBOARD (Peripheral — reachable via "More" only) ===== */}
        {activeTab === "dashboard" && (
          <div className="space-y-8 max-w-5xl">

            {/* ---- Trial countdown banner ---- */}
            {(() => {
              const sub = subscriptionQuery.data;
              if (!sub?.trialEndsAt) return null;
              const trialEnd = new Date(sub.trialEndsAt);
              const daysLeft = Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / 86400000));
              if (daysLeft <= 0) return null;
              return (
                <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">⏳</span>
                    <div>
                      <p className="text-sm font-semibold text-amber-800">
                        {daysLeft} day{daysLeft !== 1 ? "s" : ""} left on your free Plus trial
                      </p>
                      <p className="text-xs text-amber-600">Upgrade before {trialEnd.toLocaleDateString()} to keep unlimited AI logging.</p>
                    </div>
                  </div>
                  <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white shrink-0" onClick={() => setActiveTab("billing")}>
                    Upgrade Now
                  </Button>
                </div>
              );
            })()}

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight">Your Health Habits</h2>
                <p className="text-xs text-muted-foreground mt-1">Real-time daily tracking powered by AI voice-logging.</p>
              </div>
              <div className="flex gap-2 w-full sm:w-auto flex-col sm:flex-row">
                <ImageMealLogger onSuccess={() => todayLogsQuery.refetch()} />
                <Button onClick={() => setActiveTab("voice-logger")} className="gap-1.5 text-xs h-11 sm:h-auto min-w-11 sm:min-w-0">
                  <Mic className="h-4 w-4" /> Log Food
                </Button>
              </div>
            </div>

            {/* Macro progress cards — 5 cards including fiber */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
              {[
                { label: "Calories", value: Math.round(dailyTotals.calories), target: calorieTarget, unit: "kcal", color: "text-foreground" },
                { label: "Protein", value: Math.round(dailyTotals.protein), target: proteinTarget, unit: "g", color: "text-emerald-600" },
                { label: "Carbs", value: Math.round(dailyTotals.carbs), target: carbsTarget, unit: "g", color: "text-blue-600" },
                { label: "Fat", value: Math.round(dailyTotals.fat), target: fatTarget, unit: "g", color: "text-amber-600" },
                { label: "Fiber", value: Math.round(dailyTotals.fiber), target: fiberTarget, unit: "g", color: "text-violet-600" },
              ].map(({ label, value, target, unit, color }) => (
                <Card key={label} className="border-border/60">
                  <CardHeader className="p-4 pb-2">
                    <CardDescription className={`text-[10px] font-bold uppercase tracking-wider ${color}`}>{label}</CardDescription>
                    <CardTitle className="font-serif text-xl font-bold mt-1">
                      {value}<span className="text-xs text-muted-foreground font-normal ml-1">{unit}</span>
                    </CardTitle>
                    <p className="text-[10px] text-muted-foreground">/ {target} {unit}</p>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <Progress value={Math.min((value / target) * 100, 100)} className="h-1.5" />
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <WaterIntakeCard />
              
              <Card className="border-border/60 md:col-span-2 lg:col-span-2">
                <CardHeader className="p-4 sm:p-5 border-b border-border/40">
                  <CardTitle className="font-serif text-sm sm:text-base font-bold">7-Day Calorie Trend</CardTitle>
                  <CardDescription className="text-xs">Your actual intake vs. daily target.</CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-5 h-48 sm:h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorCal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="name" stroke="#888" fontSize={11} />
                      <YAxis stroke="#888" fontSize={11} />
                      <Tooltip />
                      <Area type="monotone" dataKey="Calories" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorCal)" />
                      <Area type="monotone" dataKey="Target" stroke="#10b981" strokeDasharray="5 5" strokeWidth={1.5} fill="none" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border-border/60">
                <CardHeader className="p-4 sm:p-5 border-b border-border/40">
                  <CardTitle className="font-serif text-sm sm:text-base font-bold">Macro Split (Today)</CardTitle>
                  <CardDescription className="text-xs">Energy distribution in calories.</CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-5 flex flex-col items-center justify-center h-48 sm:h-64">
                  {dailyTotals.calories > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={140}>
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value">
                            {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex gap-4 text-xs mt-4">
                        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-emerald-500" /> Protein</span>
                        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-blue-500" /> Carbs</span>
                        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-amber-500" /> Fat</span>
                      </div>
                    </>
                  ) : (
                    <div className="text-center space-y-2 text-muted-foreground">
                      <BrainCircuit className="h-8 w-8 mx-auto stroke-1" />
                      <p className="text-xs">No food logged today. Use the voice logger!</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Today's log list */}
            <div className="space-y-4">
              <h3 className="font-serif text-lg font-bold">Today's Logs</h3>
              {todayLogsQuery.isLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                </div>
              ) : dbLogs.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-border/60 rounded-xl text-muted-foreground">
                  <Mic className="h-8 w-8 mx-auto mb-3 stroke-1" />
                  <p className="text-sm font-medium">No logs yet today</p>
                  <p className="text-xs mt-1">Tap "Log Food" or visit the Voice Logger to get started.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {dbLogs.map(log => (
                    <Card key={log.id} className="border-border/60">
                      <CardContent className="p-4">
                        {editingLogId === log.id ? (
                          /* ---- Inline edit form ---- */
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                              <div className="col-span-2">
                                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Food Name</label>
                                <Input value={editForm.foodName} onChange={e => setEditForm(p => ({ ...p, foodName: e.target.value }))} className="h-8 text-sm mt-0.5" />
                              </div>
                              <div>
                                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Qty</label>
                                <Input value={editForm.quantity} onChange={e => setEditForm(p => ({ ...p, quantity: e.target.value }))} className="h-8 text-sm mt-0.5" />
                              </div>
                              <div>
                                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Calories</label>
                                <Input type="number" value={editForm.calories} onChange={e => setEditForm(p => ({ ...p, calories: e.target.value }))} className="h-8 text-sm mt-0.5" />
                              </div>
                              <div>
                                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Protein (g)</label>
                                <Input type="number" value={editForm.protein} onChange={e => setEditForm(p => ({ ...p, protein: e.target.value }))} className="h-8 text-sm mt-0.5" />
                              </div>
                              <div>
                                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Carbs (g)</label>
                                <Input type="number" value={editForm.carbs} onChange={e => setEditForm(p => ({ ...p, carbs: e.target.value }))} className="h-8 text-sm mt-0.5" />
                              </div>
                              <div>
                                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Fat (g)</label>
                                <Input type="number" value={editForm.fat} onChange={e => setEditForm(p => ({ ...p, fat: e.target.value }))} className="h-8 text-sm mt-0.5" />
                              </div>
                              <div>
                                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Fiber (g)</label>
                                <Input type="number" value={editForm.fiber} onChange={e => setEditForm(p => ({ ...p, fiber: e.target.value }))} className="h-8 text-sm mt-0.5" />
                              </div>
                            </div>
                            <div className="flex gap-2 justify-end">
                              <Button size="sm" variant="ghost" className="text-xs" onClick={() => setEditingLogId(null)}>
                                <X className="h-3.5 w-3.5 mr-1" /> Cancel
                              </Button>
                              <Button
                                size="sm"
                                className="text-xs"
                                disabled={updateLogMutation.isPending}
                                onClick={() => updateLogMutation.mutate({
                                  id: log.id,
                                  foodName: editForm.foodName,
                                  quantity: editForm.quantity,
                                  calories: parseFloat(editForm.calories) || 0,
                                  protein: parseFloat(editForm.protein) || 0,
                                  carbs: parseFloat(editForm.carbs) || 0,
                                  fat: parseFloat(editForm.fat) || 0,
                                  fiber: parseFloat(editForm.fiber) || 0,
                                })}
                              >
                                {updateLogMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1" />} Save
                              </Button>
                            </div>
                          </div>
                        ) : (
                          /* ---- Normal view ---- */
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            {log.imageUrl && (
                              <div className="shrink-0">
                                <img
                                  src={log.imageUrl}
                                  alt={log.foodName}
                                  className="w-16 h-16 rounded-lg object-cover border border-border/60"
                                />
                              </div>
                            )}
                            <div className="space-y-1 flex-1 min-w-0">
                              <div className="font-bold text-sm flex items-center gap-2 flex-wrap">
                                {log.foodName}
                                {(log.allergensDetected as string[]).length > 0 && (
                                  <Badge variant="destructive" className="text-[9px] px-1.5 py-0.5">
                                    ⚠️ {(log.allergensDetected as string[]).join(", ")}
                                  </Badge>
                                )}
                                {log.confidence && (
                                  <Badge variant="outline" className={`text-[9px] px-1.5 py-0.5 ${confidenceColor(log.confidence as "high" | "medium" | "low")}`}>
                                    {log.confidence}
                                  </Badge>
                                )}
                              </div>
                              {log.quantity && <p className="text-xs text-muted-foreground">Qty: {log.quantity}</p>}
                              {log.rawSpeech && <p className="text-[10px] text-muted-foreground italic truncate max-w-xs">"{log.rawSpeech}"</p>}
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex gap-3 text-xs font-mono shrink-0">
                                <div><strong>{Math.round(Number(log.calories))}</strong> kcal</div>
                                <div><strong>{Math.round(Number(log.protein))}g</strong> P</div>
                                <div className="hidden sm:block"><strong>{Math.round(Number(log.carbs))}g</strong> C</div>
                                <div className="hidden sm:block"><strong>{Math.round(Number(log.fat))}g</strong> F</div>
                                <div className="hidden sm:block text-violet-600"><strong>{Math.round(Number(log.fiber))}g</strong> Fb</div>
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                  onClick={() => {
                                    setEditingLogId(log.id);
                                    setEditForm({
                                      foodName: log.foodName,
                                      quantity: log.quantity ?? "",
                                      calories: String(Math.round(Number(log.calories))),
                                      protein: String(Math.round(Number(log.protein))),
                                      carbs: String(Math.round(Number(log.carbs))),
                                      fat: String(Math.round(Number(log.fat))),
                                      fiber: String(Math.round(Number(log.fiber))),
                                    });
                                  }}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  disabled={deleteLogMutation.isPending}
                                  onClick={() => deleteLogMutation.mutate({ id: log.id })}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* ===== AI Health Overview Panel ===== */}
            <div className="mt-2">
              <Card className="border-border/60">
                <CardHeader className="p-5 border-b border-border/40 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="font-serif text-base font-bold flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" /> AI Health Overview
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">A personalised daily summary and improvement tips from Clover AI.</CardDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      setShowOverview(true);
                      try {
                        const result = await healthOverviewMutation.mutateAsync();
                        setOverviewText(String(result.overview));
                      } catch {
                        setOverviewText("Failed to generate overview. Please try again.");
                      }
                    }}
                    disabled={healthOverviewMutation.isPending}
                    className="gap-1.5 text-xs"
                  >
                    {healthOverviewMutation.isPending ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating...</>
                    ) : (
                      <><RefreshCw className="h-3.5 w-3.5" /> {overviewText ? "Refresh" : "Generate"}</>
                    )}
                  </Button>
                </CardHeader>
                {showOverview && (
                  <CardContent className="p-5">
                    {healthOverviewMutation.isPending && !overviewText ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Analysing your food logs...
                      </div>
                    ) : overviewText ? (
                      <div className="prose prose-sm max-w-none text-foreground text-sm leading-relaxed">
                        {overviewText.split("\n").map((line, i) => (
                          <p key={i} className={line.startsWith("**") ? "font-semibold mt-3 mb-1" : "mb-1"}>
                            {line.replace(/\*\*/g, "")}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Click "Generate" to get your personalised daily overview.</p>
                    )}
                  </CardContent>
                )}
              </Card>
            </div>

            {/* ===== Nutrients (rough estimates across categories) ===== */}
            <NutrientPanel />

            {/* ===== Referral Card ===== */}
            <ReferralCard />

          </div>
        )}

        {/* ===== Floating AI Chat Button (Peripheral — flag-gated, dashboard only) ===== */}
        {FEATURE_FLAGS.aiNutritionChat && isAuthenticated && activeTab === "dashboard" && (
          <>
            {/* Floating button */}
            <button
              onClick={() => setShowAiChat(prev => !prev)}
              className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-transform duration-150"
              title="Ask Clover AI about your nutrition"
            >
              <BrainCircuit className="h-6 w-6" />
            </button>

            {/* Chat panel */}
            {showAiChat && (
              <div className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 shadow-2xl rounded-2xl overflow-hidden border border-border/60 bg-card flex flex-col" style={{ height: "420px" }}>
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-muted/30">
                  <div className="flex items-center gap-2">
                    <BrainCircuit className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">Ask Clover AI</span>
                  </div>
                  <button onClick={() => setShowAiChat(false)} className="text-muted-foreground hover:text-foreground text-lg leading-none">&times;</button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <AIChatBox
                    messages={aiChatMessages}
                    onSendMessage={handleAiChatSend}
                    isLoading={healthChatMutation.isPending}
                    height="100%"
                    placeholder="Ask about your nutrition..."
                    emptyStateMessage="Ask me anything about your food logs!"
                    suggestedPrompts={[
                      "I've been feeling tired lately — anything in my data?",
                      "How's my iron and magnesium looking?",
                      "What was my highest-protein meal this week?",
                    ]}
                  />
                </div>
              </div>
            )}
          </>
        )}

        {/* ===== B. VOICE LOGGER (chat-style) ===== */}
        {activeTab === "voice-logger" && (
          <div className="max-w-2xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
            <div className="mb-4">
              <h2 className="text-2xl font-serif font-bold">Voice Food Logger</h2>
              <p className="text-xs text-muted-foreground mt-1">Speak or type what you ate — or ask about your nutrition. Clover logs meals and answers from your own data.</p>
            </div>

            {/* Chat area */}
            <div className="flex-1 overflow-y-auto space-y-3 pb-4 pr-1">
              {chatMessages.length === 0 && (
                <div className="text-center py-16 text-muted-foreground">
                  <Mic className="h-10 w-10 mx-auto mb-3 stroke-1" />
                  <p className="text-sm font-medium">Log a meal — or just ask</p>
                  <p className="text-xs mt-1">Try: "I had oatmeal with banana and a coffee" · "How's my protein this week?" · "I've been feeling tired lately"</p>
                </div>
              )}
              {chatMessages.map(msg => {
                const hasCards = !!msg.loggedMeals?.length;
                return (
                  <div
                    key={msg.id}
                    className={`group flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`${hasCards ? "max-w-[92%]" : "max-w-[80%]"} rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-card border border-border/60 text-foreground rounded-bl-sm"
                      } ${hasCards ? "!p-0 overflow-hidden !bg-transparent !border-0 space-y-2 w-full" : ""}`}
                    >
                      {msg.role === "ai" && msg.confidence && !hasCards && (
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <BrainCircuit className="h-3.5 w-3.5 text-primary" />
                          <Badge variant="outline" className={`text-[9px] ${confidenceColor(msg.confidence)}`}>
                            {msg.confidence} confidence
                          </Badge>
                        </div>
                      )}
                      {msg.imageDataUrl && (
                        <img
                          src={msg.imageDataUrl}
                          alt="Uploaded meal"
                          className="rounded-xl mb-2 max-h-48 w-auto object-cover"
                        />
                      )}
                      {hasCards ? (
                        <>
                          {msg.loggedMeals!.map(entry => (
                            <LoggedMealCard
                              key={entry.logId}
                              meal={entry}
                              confidence={msg.confidence}
                              onUndo={() => handleUndoLog(msg.id, entry.logId)}
                              undoing={undoingLogIds.includes(entry.logId)}
                            />
                          ))}
                          {msg.notes && (
                            <p className="text-xs text-muted-foreground italic px-1">{msg.notes}</p>
                          )}
                          {/* What else Clover can do from here */}
                          {msg.loggedMeals!.some(e => !e.undone) && (
                            <div className="flex flex-wrap gap-1.5 px-1 pt-0.5">
                              <button
                                type="button"
                                onClick={() => setActiveTab("dashboard")}
                                className="text-[11px] rounded-full border border-border/60 px-2.5 py-1 text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                              >
                                See today's totals
                              </button>
                              <button
                                type="button"
                                onClick={() => setActiveTab("weekly-report")}
                                className="text-[11px] rounded-full border border-border/60 px-2.5 py-1 text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                              >
                                View weekly report
                              </button>
                              <button
                                type="button"
                                onClick={() => { setActiveTab("dashboard"); setShowAiChat(true); }}
                                className="text-[11px] rounded-full border border-border/60 px-2.5 py-1 text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                              >
                                Ask about my nutrition
                              </button>
                            </div>
                          )}
                        </>
                      ) : (
                        msg.text && <p className="whitespace-pre-line">{msg.text}</p>
                      )}
                    </div>
                    {/* Message actions — copy for everything, edit/redo for your own messages */}
                    {(msg.text || hasCards) && (
                      <div className="flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => handleCopyMessage(msg)}
                          title="Copy"
                          className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground/70 hover:text-foreground hover:bg-muted/60 transition-colors"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                        {msg.role === "user" && msg.text && (
                          <button
                            type="button"
                            onClick={() => handleEditMessage(msg)}
                            title="Edit & resend"
                            className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground/70 hover:text-foreground hover:bg-muted/60 transition-colors"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {(isAnalyzing || isAnalyzingPhoto) && (
                <div className="flex justify-start">
                  <div className="bg-card border border-border/60 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analyzing with USDA data...
                    </span>
                    <button
                      type="button"
                      onClick={handleCancelAnalysis}
                      className="flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5 text-[11px] hover:text-foreground hover:border-border transition-colors"
                    >
                      <X className="h-3 w-3" /> Stop
                    </button>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* "Log it anyway" — the clarifying question always offers this out */}
            {awaitingClarification && !isAnalyzing && (
              <div className="mb-2 flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground gap-1.5"
                  onClick={handleSkipClarification}
                >
                  <SkipForward className="h-3.5 w-3.5" /> Log it anyway — best estimates
                </Button>
              </div>
            )}

            {/* Guest demo limit reached — the one hard sell in the app */}
            {guestLimitHit && (
              <div className="mb-2 p-4 rounded-xl border border-primary/30 bg-primary/5 text-center space-y-2">
                <p className="text-sm font-medium">That's the guest demo — 10 AI analyses, all real.</p>
                <p className="text-xs text-muted-foreground">A free account gets you 10 AI logs a month, weekly reports, and nutrient tracking — no credit card.</p>
                <a
                  href={getLoginUrl()}
                  className="inline-block text-xs font-medium rounded-lg bg-primary text-primary-foreground px-4 py-2 hover:opacity-90 transition-opacity"
                >
                  Create a free account
                </a>
              </div>
            )}

            {/* Speech error tip */}
            {speechErrorTip && (
              <div className="mb-2 p-3 bg-destructive/5 border border-destructive/10 rounded-lg text-xs text-muted-foreground flex gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                {speechErrorTip}
              </div>
            )}

            {/* Input bar */}
            <div className="flex gap-2 items-center border border-border/60 rounded-2xl bg-card px-3 py-2">
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handlePhotoSelected(file);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={isAnalyzing || isAnalyzingPhoto}
                className="shrink-0 h-8 w-8 rounded-full flex items-center justify-center bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                title="Log from a photo"
              >
                <Camera className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center transition-colors ${
                  isRecording
                    ? "bg-destructive text-destructive-foreground animate-pulse"
                    : "bg-primary/10 text-primary hover:bg-primary/20"
                }`}
                title={isRecording ? `Stop (${recordingDuration}s)` : "Start recording"}
              >
                {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
              <Input
                value={chatInput}
                onChange={e => { setChatInput(e.target.value); chatInputWasVoiceRef.current = false; }}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
                placeholder={awaitingClarification ? "Answer the question above..." : "Log a meal or ask me anything..."}
                className="border-0 shadow-none focus-visible:ring-0 text-sm bg-transparent"
                disabled={isAnalyzing || isAnalyzingPhoto}
              />
              <Button
                size="sm"
                onClick={handleSendChat}
                disabled={!chatInput.trim() || isAnalyzing || isAnalyzingPhoto}
                className="shrink-0 h-8 w-8 p-0 rounded-full"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ===== WEEKLY COMPASSIONATE EXPORT ===== */}
        {activeTab === "weekly-report" && (
          <div className="max-w-2xl mx-auto space-y-6" id="weekly-report-page">
            {!weeklyReport ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-16 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" /> Putting your week together...
              </div>
            ) : !("periodEnd" in weeklyReport) ? (
              <div className="text-center py-16 space-y-3">
                <Sparkles className="h-10 w-10 mx-auto stroke-1 text-muted-foreground" />
                <h2 className="font-serif text-xl font-bold">Your first weekly report is on its way</h2>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  It arrives after your first full week
                  {weeklyReport.firstReportAt
                    ? ` — around ${new Date(weeklyReportQuery.data!.firstReportAt!).toLocaleDateString("en-US", { month: "long", day: "numeric" })}`
                    : ""}
                  . Until then, just keep logging whenever it's natural.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4 print:hidden">
                  <div>
                    <h2 className="text-2xl font-serif font-bold">Your Week with Clover</h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(weeklyReport.periodStart).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – {new Date(weeklyReport.periodEnd - 1).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 shrink-0"
                    onClick={() => {
                      trackEvent("weekly_export_downloaded");
                      window.print();
                    }}
                  >
                    <Share2 className="h-3.5 w-3.5" /> Download / Print PDF
                  </Button>
                </div>

                {/* The one-page export itself (print-friendly) */}
                <Card className="border-border/60 print:border-0 print:shadow-none">
                  <CardContent className="p-6 space-y-6">
                    {/* Header — warm framing that reflects something real */}
                    <div className="space-y-1">
                      <div className="hidden print:flex items-center gap-2 text-primary font-serif font-bold pb-2">
                        <Leaf className="h-4 w-4" /> Clover — Weekly Summary
                      </div>
                      <p className="font-serif text-lg font-bold">{weeklyReport.headerLine}</p>
                      {weeklyReport.caption && (
                        <p className="text-[11px] text-muted-foreground">{weeklyReport.caption}</p>
                      )}
                    </div>

                    {/* Stats — averages over logged days only, no targets anywhere */}
                    {weeklyReport.stats.daysLogged > 0 && (
                      <div className="grid grid-cols-3 gap-px bg-border/40 rounded-xl overflow-hidden border border-border/40">
                        <div className="bg-card px-3 py-3 text-center">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Days logged</div>
                          <div className="text-lg font-semibold mt-0.5">{weeklyReport.stats.daysLogged}</div>
                        </div>
                        <div className="bg-card px-3 py-3 text-center">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Avg calories</div>
                          <div className="text-lg font-semibold mt-0.5">{weeklyReport.stats.avgCalories ?? "—"}</div>
                        </div>
                        <div className="bg-card px-3 py-3 text-center">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Avg protein</div>
                          <div className="text-lg font-semibold mt-0.5">{weeklyReport.stats.avgProtein != null ? `${weeklyReport.stats.avgProtein}g` : "—"}</div>
                        </div>
                      </div>
                    )}

                    {/* Highlights */}
                    <div className="space-y-3">
                      {weeklyReport.highlights.map((h, i) => (
                        <div key={i} className="flex gap-3">
                          <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          <p className="text-sm leading-relaxed">{h}</p>
                        </div>
                      ))}
                    </div>

                    {/* Habit-forming note — positive frame, never a missed-day count */}
                    {weeklyReport.habitNote && (
                      <div className="rounded-xl bg-muted/40 px-4 py-3">
                        <p className="text-sm leading-relaxed">{weeklyReport.habitNote}</p>
                      </div>
                    )}

                    {/* Gentle suggestion — an option, not an instruction */}
                    {weeklyReport.gentleSuggestion && (
                      <div className="flex gap-3">
                        <Heart className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <p className="text-sm leading-relaxed text-muted-foreground">{weeklyReport.gentleSuggestion}</p>
                      </div>
                    )}

                    {/* Footer — route to humans */}
                    <div className="pt-4 border-t border-border/40 space-y-3">
                      <p className="text-[11px] text-muted-foreground leading-relaxed">{weeklyReport.footerNote}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs gap-1.5 print:hidden"
                        onClick={() => setActiveTab("calendar")}
                      >
                        <Calendar className="h-3.5 w-3.5" /> View full history
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}

        {/* ===== MOOD TRENDS ===== */}
        {activeTab === "mood" && <MoodTrendsView />}

        {/* ===== SETTINGS (goal / reminder / export email + health profile) ===== */}
        {activeTab === "settings" && (
          <div className="max-w-2xl space-y-6">
            <h2 className="text-2xl font-serif font-bold">Settings</h2>

            {/* Primary goal — same fixed enum as onboarding */}
            <Card className="border-border/60">
              <CardHeader className="p-5 border-b border-border/40">
                <CardTitle className="font-serif text-base font-bold">Primary goal</CardTitle>
                <CardDescription className="text-xs">Shapes what your weekly report highlights. Changes apply going forward — past reports stay as they were.</CardDescription>
              </CardHeader>
              <CardContent className="p-5 space-y-2">
                {GOAL_OPTIONS.map(g => (
                  <button
                    key={g.value}
                    type="button"
                    disabled={setGoalMutation.isPending}
                    onClick={() => {
                      if (settingsQuery.data?.primaryGoal !== g.value) {
                        setGoalMutation.mutate({ goal: g.value }, { onSuccess: () => toast.success("Goal updated") });
                      }
                    }}
                    className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${
                      settingsQuery.data?.primaryGoal === g.value ? "border-primary bg-primary/5" : "border-border/60 hover:border-border"
                    }`}
                  >
                    <span className="block text-sm font-medium">{g.label}</span>
                    <span className="block text-xs text-muted-foreground mt-0.5">{g.description}</span>
                  </button>
                ))}
              </CardContent>
            </Card>

            {/* Daily reminder — independent toggle, off by default */}
            <Card className="border-border/60">
              <CardHeader className="p-5 border-b border-border/40">
                <CardTitle className="font-serif text-base font-bold">Daily reminder</CardTitle>
                <CardDescription className="text-xs">One reminder at a time you pick — no escalation, no re-prompts. Off unless you turn it on.</CardDescription>
              </CardHeader>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Remind me once a day</span>
                  <Button
                    variant={settingsQuery.data?.reminderEnabled ? "default" : "outline"}
                    size="sm"
                    disabled={setReminderMutation.isPending}
                    onClick={() => {
                      const enabled = !settingsQuery.data?.reminderEnabled;
                      setReminderMutation.mutate(
                        { enabled, time: enabled ? (settingsQuery.data?.reminderTime ?? "18:00") : null },
                        { onSuccess: () => toast.success(enabled ? "Reminder on" : "Reminder off") }
                      );
                    }}
                  >
                    {settingsQuery.data?.reminderEnabled ? "On" : "Off"}
                  </Button>
                </div>
                {settingsQuery.data?.reminderEnabled && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">At</span>
                    <input
                      type="time"
                      value={settingsQuery.data?.reminderTime ?? "18:00"}
                      onChange={e =>
                        setReminderMutation.mutate({ enabled: true, time: e.target.value })
                      }
                      className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Weekly export email — separate from the reminder, never bundled */}
            <Card className="border-border/60">
              <CardHeader className="p-5 border-b border-border/40">
                <CardTitle className="font-serif text-base font-bold">Weekly report by email</CardTitle>
                <CardDescription className="text-xs">The in-app report is always available either way.</CardDescription>
              </CardHeader>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Email me my weekly report</span>
                  <Button
                    variant={settingsQuery.data?.weeklyExportEmail ? "default" : "outline"}
                    size="sm"
                    disabled={setExportEmailMutation.isPending}
                    onClick={() => {
                      const enabled = !settingsQuery.data?.weeklyExportEmail;
                      setExportEmailMutation.mutate(
                        { enabled },
                        { onSuccess: () => toast.success(enabled ? "Email on" : "Email off") }
                      );
                    }}
                  >
                    {settingsQuery.data?.weeklyExportEmail ? "On" : "Off"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Mood & feelings — passive extraction toggle */}
            <Card className="border-border/60">
              <CardHeader className="p-5 border-b border-border/40">
                <CardTitle className="font-serif text-base font-bold">Mood & feelings</CardTitle>
                <CardDescription className="text-xs">
                  When you mention how you're feeling in the chat ("stress ate a whole sleeve of crackers"), Clover can quietly note the context for your trends view — it never comments on it in the chat. Manual check-ins work either way.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Notice feelings mentioned in chat</span>
                  <Button
                    variant={settingsQuery.data?.moodExtractionEnabled ? "default" : "outline"}
                    size="sm"
                    disabled={setMoodExtractionMutation.isPending}
                    onClick={() => {
                      const enabled = !settingsQuery.data?.moodExtractionEnabled;
                      setMoodExtractionMutation.mutate(
                        { enabled },
                        { onSuccess: () => toast.success(enabled ? "Clover will quietly notice context you mention" : "Chat extraction off — manual check-ins still work") }
                      );
                    }}
                  >
                    {settingsQuery.data?.moodExtractionEnabled ? "On" : "Off"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Health profile — moved here from onboarding to keep the golden path short */}
            <Card className="border-border/60">
              <CardHeader className="p-5 border-b border-border/40">
                <CardTitle className="font-serif text-base font-bold">Health profile</CardTitle>
                <CardDescription className="text-xs">Allergies are flagged in every meal analysis. All optional.</CardDescription>
              </CardHeader>
              <CardContent className="p-5 space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Age</label>
                    <Input type="number" placeholder="—" value={settingsAge} onChange={e => setSettingsAge(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Weight (lbs)</label>
                    <Input type="number" placeholder="—" value={settingsWeight} onChange={e => setSettingsWeight(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Allergies & sensitivities</label>
                  <div className="flex flex-wrap gap-2">
                    {ALLERGEN_OPTIONS.map(a => (
                      <Button
                        key={a}
                        type="button"
                        variant={settingsAllergies.includes(a) ? "destructive" : "outline"}
                        size="sm"
                        onClick={() => setSettingsAllergies(toggleArr(settingsAllergies, a))}
                        className="rounded-full h-8 px-4 text-xs"
                      >{a}</Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Dietary style</label>
                  <div className="flex flex-wrap gap-2">
                    {DIET_OPTIONS.map(d => (
                      <Button
                        key={d}
                        type="button"
                        variant={settingsDiet.includes(d) ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSettingsDiet(toggleArr(settingsDiet, d))}
                        className="rounded-full h-8 px-4 text-xs"
                      >{d}</Button>
                    ))}
                  </div>
                </div>
                <Button
                  size="sm"
                  disabled={saveProfileMutation.isPending}
                  onClick={() =>
                    saveProfileMutation.mutate(
                      {
                        age: settingsAge ? parseInt(settingsAge) : undefined,
                        weightLbs: settingsWeight ? parseFloat(settingsWeight) : undefined,
                        allergies: settingsAllergies,
                        dietaryChoices: settingsDiet,
                      },
                      { onSuccess: () => toast.success("Profile saved") }
                    )
                  }
                >
                  {saveProfileMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save profile"}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ===== C. CALENDAR VIEW ===== */}
        {activeTab === "calendar" && (
          <div className="max-w-4xl space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-serif font-bold">
                {calendarDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setCalendarDate(d => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n; })}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCalendarDate(d => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n; })}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Calendar grid */}
            <Card className="border-border/60">
              <CardContent className="p-4">
                {/* Day headers */}
                <div className="grid grid-cols-7 mb-2">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
                    <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1">{d}</div>
                  ))}
                </div>
                {/* Day cells */}
                <div className="grid grid-cols-7 gap-1">
                  {(() => {
                    const { firstDay, daysInMonth, year, month } = calendarDays();
                    const cells = [];
                    for (let i = 0; i < firstDay; i++) {
                      cells.push(<div key={`empty-${i}`} />);
                    }
                    for (let day = 1; day <= daysInMonth; day++) {
                      const key = `${year}-${month}-${day}`;
                      const cal = logsByDay[key] ?? 0;
                      const isToday = new Date().getDate() === day && new Date().getMonth() === month && new Date().getFullYear() === year;
                      const dayMs = Date.UTC(year, month, day);
                      const isSelected = calendarDayMs === dayMs;
                      cells.push(
                        <button
                          key={day}
                          onClick={() => setCalendarDayMs(isSelected ? null : dayMs)}
                          className={`relative rounded-lg p-1 text-center text-xs transition-colors hover:bg-muted/50 ${
                            isToday ? "ring-1 ring-primary" : ""
                          } ${isSelected ? "bg-primary/10" : ""}`}
                        >
                          <span className={`block text-sm font-medium ${isToday ? "text-primary" : ""}`}>{day}</span>
                          {cal > 0 && (
                            <span className="block text-[9px] text-muted-foreground">{Math.round(cal)} kcal</span>
                          )}
                          {cal > 0 && (
                            <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary" />
                          )}
                        </button>
                      );
                    }
                    return cells;
                  })()}
                </div>
              </CardContent>
            </Card>

            {/* Day detail */}
            {calendarDayMs !== null && (
              <Card className="border-border/60">
                <CardHeader className="p-5 border-b border-border/40">
                  <CardTitle className="font-serif text-base font-bold">
                    {new Date(calendarDayMs).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5">
                  {calendarDayQuery.isLoading ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                    </div>
                  ) : (calendarDayQuery.data ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground">No logs for this day.</p>
                  ) : (
                    <div className="space-y-3">
                      {(calendarDayQuery.data ?? []).map(log => (
                        <div key={log.id} className="flex justify-between items-center text-sm border-b border-border/30 pb-2 last:border-0 last:pb-0">
                          <div>
                            <span className="font-medium">{log.foodName}</span>
                            {log.quantity && <span className="text-xs text-muted-foreground ml-2">({log.quantity})</span>}
                          </div>
                          <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground">
                            <span>{Math.round(Number(log.calories))} kcal</span>
                            <span className="text-emerald-600">{Math.round(Number(log.protein))}g P</span>
                            <span className="text-violet-600">{Math.round(Number(log.fiber))}g Fb</span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              disabled={deleteLogMutation.isPending}
                              onClick={() => deleteLogMutation.mutate({ id: log.id })}
                              title="Remove this log"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      {/* Day totals */}
                      <div className="pt-2 flex gap-4 text-xs font-mono font-semibold border-t border-border/40">
                        {["calories", "protein", "carbs", "fat", "fiber"].map(k => {
                          const sum = (calendarDayQuery.data ?? []).reduce((s, l) => s + Number((l as any)[k] ?? 0), 0);
                          return <span key={k}>{Math.round(sum)}{k === "calories" ? " kcal" : "g " + k.charAt(0).toUpperCase()}</span>;
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

                {/* ===== D. CURATED RECIPES ===== */}
        {activeTab === "recipes" && (
          <RecipesTab profile={profile} />
        )}
        {/* ===== E. MEAL PLANNING ===== */}
        {activeTab === "mealplan" && (
          <MealPlanningTab />
        )}
        {/* ===== F. TRAVEL SOURCING ===== */}
        {FEATURE_FLAGS.travelSourcing && activeTab === "travel" && (
          <div className="space-y-8 max-w-4xl">
            <div>
              <h2 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight">Travel Sourcing</h2>
              <p className="text-xs text-muted-foreground mt-1">Diet-compliant eatery recommendations cross-referenced with your travel calendar.</p>
            </div>
            {MOCK_TRAVEL_CALENDAR.map(travel => (
              <Card key={travel.id} className="border-border/60">
                <CardHeader className="p-5 border-b border-border/40 flex flex-row justify-between items-center">
                  <div>
                    <CardTitle className="font-serif text-base font-bold">Travel to {travel.city}</CardTitle>
                    <CardDescription className="text-xs mt-0.5">{travel.dateRange}</CardDescription>
                  </div>
                  <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[10px]">Calendar Sync Active</Badge>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {travel.eateries.map((eat, idx) => (
                      <div key={idx} className="p-4 bg-muted/30 rounded-xl border border-border/40 space-y-2">
                        <div className="font-bold text-xs">{eat.name}</div>
                        <div className="text-[10px] text-muted-foreground">{eat.type} • {eat.distance} away</div>
                        <div className="flex flex-wrap gap-1">
                          {eat.dietMatches.map(m => (
                            <span key={m} className="bg-emerald-50 text-emerald-700 text-[9px] px-1.5 py-0.5 rounded border border-emerald-100 font-medium">{m}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* ===== F. INTEGRATIONS ===== */}
        {FEATURE_FLAGS.integrations && activeTab === "integrations" && (
          <div className="max-w-3xl mx-auto space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-2xl sm:text-3xl font-serif font-bold">Connected Integrations</h2>
              <p className="text-xs text-muted-foreground">Sync with your existing health ecosystem.</p>
            </div>
            <div className="space-y-4">
              {[
                { key: "appleHealth" as const, icon: Heart, color: "bg-pink-50 text-pink-600", title: "Apple Health & iPhone Fitness Sync", desc: "Import daily activity, active calories burned, and sync profile weight automatically." },
                { key: "googleCalendar" as const, icon: Calendar, color: "bg-blue-50 text-blue-600", title: "Google Calendar Integration", desc: "Scan upcoming travel destinations to prepare dietary eatery recommendations." },
                { key: "myFitnessPal" as const, icon: Activity, color: "bg-orange-50 text-orange-600", title: "MyFitnessPal Sync", desc: "Push voice-logged food and macro metrics directly into your MyFitnessPal journal." },
              ].map(({ key, icon: Icon, color, title, desc }) => (
                <Card key={key} className="border-border/60">
                  <CardContent className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex gap-4 items-start">
                      <div className={`h-12 w-12 rounded-xl ${color} flex items-center justify-center shrink-0`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-serif text-sm font-bold">{title}</h3>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                      </div>
                    </div>
                    <Button
                      variant={integrations[key] ? "destructive" : "default"}
                      size="sm"
                      onClick={() => {
                        setIntegrations(p => ({ ...p, [key]: !p[key] }));
                        toast.info(integrations[key] ? "Disconnected." : "Feature coming soon — integration not yet live.");
                      }}
                      className="text-xs"
                    >
                      {integrations[key] ? "Disconnect" : "Link Account"}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* ===== G. BILLING / MANAGE PLAN ===== */}
        {activeTab === "billing" && (
          <div className="max-w-3xl space-y-8">
            <div>
              <h2 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight">Manage Your Plan</h2>
              <p className="text-xs text-muted-foreground mt-1">Upgrade or manage your Clover subscription.</p>
            </div>

            {/* Current plan status */}
            {subscriptionQuery.data && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Crown className="h-5 w-5 text-amber-500" />
                      <span className="font-serif font-bold text-base capitalize">Current Plan: Clover {subscriptionQuery.data.tier}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      AI logs used this month: <strong>{subscriptionQuery.data.aiCallsUsed}</strong> / {subscriptionQuery.data.aiCallsLimit === Infinity ? "Unlimited" : subscriptionQuery.data.aiCallsLimit}
                    </p>
                  </div>
                  {subscriptionQuery.data.tier !== "free" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs text-destructive border-destructive/30 hover:bg-destructive/5"
                      onClick={() => {
                        if (confirm("Downgrade to the free plan? You will lose unlimited AI logging.")) {
                          downgradeToFreeMutation.mutate(undefined);
                        }
                      }}
                    >
                      Downgrade to Free
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Plan cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {([
                {
                  tier: "free" as const,
                  name: "Clover Free",
                  price: "$0",
                  period: "forever",
                  features: ["10 AI voice logs / month", "Basic dashboard", "7-day history"],
                  cta: "Current Plan",
                  highlight: false,
                },
                {
                  tier: "plus" as const,
                  name: "Clover Plus",
                  price: "$7.99",
                  period: "/ month",
                  features: ["Unlimited AI voice logs", "Full history & calendar", "AI health overview", "Recipe recommendations"],
                  cta: "Upgrade to Plus",
                  highlight: true,
                },
                {
                  tier: "pro" as const,
                  name: "Clover Pro",
                  price: "$14.99",
                  period: "/ month",
                  features: ["Everything in Plus", "Travel sourcing", "Weekly email digest", "Priority AI", "CSV export"],
                  cta: "Upgrade to Pro",
                  highlight: false,
                },
              ]).map(plan => (
                <Card key={plan.tier} className={`border-border/60 relative ${plan.highlight ? "border-primary ring-1 ring-primary/30" : ""}`}>
                  {plan.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground text-[10px] px-3">Most Popular</Badge>
                    </div>
                  )}
                  <CardHeader className="p-5 border-b border-border/40">
                    <CardTitle className="font-serif text-base font-bold">{plan.name}</CardTitle>
                    <div className="mt-2">
                      <span className="text-3xl font-bold">{plan.price}</span>
                      <span className="text-xs text-muted-foreground ml-1">{plan.period}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-5 space-y-4">
                    <ul className="space-y-2">
                      {plan.features.map(f => (
                        <li key={f} className="flex items-center gap-2 text-xs">
                          <Check className="h-3.5 w-3.5 text-primary shrink-0" /> {f}
                        </li>
                      ))}
                    </ul>
                    {plan.tier === "free" ? (
                      <Button variant="outline" size="sm" className="w-full text-xs" disabled>
                        {subscriptionQuery.data?.tier === "free" ? "Current Plan" : "Downgraded"}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="w-full text-xs"
                        variant={plan.highlight ? "default" : "outline"}
                        disabled={checkoutMutation.isPending || subscriptionQuery.data?.tier === plan.tier}
                        onClick={() => {
                          if (subscriptionQuery.data?.tier === plan.tier) return;
                          toast.info("Opening secure checkout...");
                          checkoutMutation.mutate({ tier: plan.tier, billingCycle: "monthly" });
                        }}
                      >
                        {checkoutMutation.isPending ? (
                          <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Processing...</>
                        ) : subscriptionQuery.data?.tier === plan.tier ? (
                          "Current Plan"
                        ) : (
                          plan.cta
                        )}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <p className="text-[10px] text-muted-foreground text-center">
              Test card: 4242 4242 4242 4242 · Any future date · Any CVC. Payments are processed securely by Stripe.
            </p>
          </div>
        )}

      </div>{/* end p-6 inner div */}
      </SidebarInset>

      {/* ===== UPGRADE MODAL ===== */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md border-primary/30 shadow-2xl">
            <CardHeader className="p-6 border-b border-border/40">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="font-serif text-xl font-bold flex items-center gap-2">
                    <Crown className="h-5 w-5 text-amber-500" /> Unlock Unlimited Logging
                  </CardTitle>
                  <CardDescription className="text-xs">
                    You've used all 10 free AI logs this month. Upgrade to keep tracking.
                  </CardDescription>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 -mt-1 -mr-1" onClick={() => setShowUpgradeModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-2">
                  <div className="font-serif font-bold text-sm">Clover Plus</div>
                  <div className="text-2xl font-bold">$7.99<span className="text-xs text-muted-foreground font-normal">/mo</span></div>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    <li className="flex items-center gap-1"><Check className="h-3 w-3 text-primary" /> Unlimited AI logs</li>
                    <li className="flex items-center gap-1"><Check className="h-3 w-3 text-primary" /> Full history</li>
                    <li className="flex items-center gap-1"><Check className="h-3 w-3 text-primary" /> AI health overview</li>
                  </ul>
                  <Button
                    size="sm"
                    className="w-full text-xs mt-2"
                    disabled={checkoutMutation.isPending}
                    onClick={() => {
                      setShowUpgradeModal(false);
                      toast.info("Opening secure checkout...");
                      checkoutMutation.mutate({ tier: "plus", billingCycle: "monthly" });
                    }}
                  >
                    {checkoutMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Upgrade to Plus"}
                  </Button>
                </div>
                <div className="p-4 rounded-xl border border-border/60 space-y-2">
                  <div className="font-serif font-bold text-sm">Clover Pro</div>
                  <div className="text-2xl font-bold">$14.99<span className="text-xs text-muted-foreground font-normal">/mo</span></div>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    <li className="flex items-center gap-1"><Check className="h-3 w-3 text-primary" /> Everything in Plus</li>
                    <li className="flex items-center gap-1"><Check className="h-3 w-3 text-primary" /> Travel sourcing</li>
                    <li className="flex items-center gap-1"><Check className="h-3 w-3 text-primary" /> Priority AI</li>
                  </ul>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs mt-2"
                    disabled={checkoutMutation.isPending}
                    onClick={() => {
                      setShowUpgradeModal(false);
                      toast.info("Opening secure checkout...");
                      checkoutMutation.mutate({ tier: "pro", billingCycle: "monthly" });
                    }}
                  >
                    Upgrade to Pro
                  </Button>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground text-center">
                Payments processed securely by Stripe. Cancel anytime.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

    </div>{/* end flex row */}
    </SidebarProvider>
  );
}
