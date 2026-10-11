import { useState } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

const WOULD_PAY: Record<string, string> = { no: "Nothing", under_5: "Under $5", "5_to_10": "$5–10", over_10: "Over $10" };

/** Admin: the shareable /join link, spot limit, every tester's progress, and who to pay. */
export function PaidBetaTab() {
  const utils = trpc.useUtils();
  const overview = trpc.betaProgram.adminOverview.useQuery();
  const update = trpc.betaProgram.adminUpdateSettings.useMutation({
    onSuccess: () => utils.betaProgram.adminOverview.invalidate(),
    onError: (e) => toast.error(e.message),
  });
  const setPaid = trpc.betaProgram.adminSetPaid.useMutation({
    onSuccess: () => utils.betaProgram.adminOverview.invalidate(),
    onError: (e) => toast.error(e.message),
  });
  const [spots, setSpots] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  const link = `${window.location.origin}/join`;
  const d = overview.data;
  if (overview.isLoading || !d) {
    return (
      <div className="flex justify-center py-16 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const toPay = d.testers.filter((t) => t.qualified && !t.paidAt);
  const active = d.testers.filter((t) => t.status === "active").length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Share link</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input readOnly value={link} className="font-mono text-sm" />
            <Button
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(link);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-3 text-sm">
              <Switch checked={d.open} onCheckedChange={(open) => update.mutate({ open })} />
              {d.open ? "Accepting testers" : "Closed"}
            </label>
            <form
              className="flex items-center gap-2 text-sm"
              onSubmit={(e) => {
                e.preventDefault();
                const n = Number(spots);
                if (Number.isInteger(n) && n >= 0) update.mutate({ spots: n }, { onSuccess: () => setSpots("") });
              }}
            >
              Spots
              <Input className="w-20" inputMode="numeric" placeholder={String(d.spots)} value={spots} onChange={(e) => setSpots(e.target.value)} />
              <Button size="sm" variant="outline" disabled={!spots}>
                Save
              </Button>
            </form>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            {[
              ["Joined", `${d.taken} / ${d.spots}`],
              ["In their week", active],
              ["Qualified, unpaid", toPay.length],
              ["Owed", `$${toPay.reduce((sum, t) => sum + t.payout, 0)}`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-500">{k}</p>
                <p className="text-lg font-semibold text-gray-900">{v}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Testers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {d.testers.length === 0 && <p className="text-sm text-gray-500">No one has joined yet.</p>}
          {d.testers.map((t) => (
            <div key={t.id} className="rounded-xl border border-gray-200 bg-white">
              <button type="button" onClick={() => setExpanded(expanded === t.id ? null : t.id)} className="w-full p-4 text-left">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-medium text-gray-900">{t.name || t.email}</span>
                  <span className="text-xs text-gray-500">{t.email}</span>
                  <span className="ml-auto flex flex-wrap gap-1.5">
                    {t.status === "active" ? (
                      <Badge variant="secondary">Day {t.day} of {t.days}</Badge>
                    ) : (
                      <Badge variant="outline">Week ended</Badge>
                    )}
                    <Badge variant={t.activeDays >= t.activeDaysRequired ? "default" : "outline"}>
                      {t.activeDays}/{t.activeDaysRequired} days
                    </Badge>
                    {t.feedbackSubmitted && <Badge variant="secondary">Feedback ✓</Badge>}
                    {t.paidAt ? <Badge className="bg-emerald-600">Paid</Badge> : t.qualified && <Badge className="bg-amber-500">To pay</Badge>}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {t.aiUsedTotal}/{t.aiWeeklyCap} AI this week · joined {new Date(t.startedAt).toLocaleDateString()}
                  {t.emailOptOut && " · emails off"}
                </p>
              </button>
              {expanded === t.id && (
                <div className="space-y-3 border-t border-gray-100 p-4 text-sm">
                  {t.feedback ? (
                    <dl className="grid gap-2">
                      <div><dt className="text-xs text-gray-500">Rating</dt><dd>{"★".repeat(Number(t.feedback.overallRating ?? 0))}</dd></div>
                      <div><dt className="text-xs text-gray-500">Keep using</dt><dd className="capitalize">{t.feedback.keepUsing}</dd></div>
                      <div><dt className="text-xs text-gray-500">Would pay</dt><dd>{WOULD_PAY[String(t.feedback.wouldPay)] ?? "—"}</dd></div>
                      {(["likedMost", "frustrating", "confusing", "anythingElse"] as const).map(
                        (k) =>
                          t.feedback?.[k] && (
                            <div key={k}>
                              <dt className="text-xs text-gray-500">{{ likedMost: "Liked most", frustrating: "Frustrating", confusing: "Confusing", anythingElse: "Anything else" }[k]}</dt>
                              <dd className="whitespace-pre-wrap">{String(t.feedback[k])}</dd>
                            </div>
                          )
                      )}
                    </dl>
                  ) : (
                    <p className="text-gray-500">No final feedback yet.</p>
                  )}
                  {t.qualified && (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-amber-50 p-3">
                      <span>
                        Pay <strong>${t.payout}</strong> via <span className="capitalize">{t.payoutMethod}</span>: <strong className="font-mono">{t.payoutHandle}</strong>
                      </span>
                      <Button size="sm" variant={t.paidAt ? "outline" : "default"} onClick={() => setPaid.mutate({ enrollmentId: t.id, paid: !t.paidAt })}>
                        {t.paidAt ? "Mark unpaid" : "Mark paid"}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
