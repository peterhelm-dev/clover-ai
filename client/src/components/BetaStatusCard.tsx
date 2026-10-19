import { useEffect, useState } from "react";
import { Gift } from "lucide-react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const PROMPTED_KEY = "clover-beta-feedback-prompted";

/**
 * Early-access status on Home: day of the week and today's AI allowance.
 * From day 7, if feedback isn't in yet, the card becomes the survey prompt
 * and a one-time dialog asks too. Renders nothing for people who never joined.
 */
export function BetaStatusCard() {
  const { data: s } = trpc.betaProgram.status.useQuery(undefined, { retry: false, refetchOnWindowFocus: true });
  const needsFeedback = !!s && s.feedbackOpen && !s.feedbackSubmitted;
  const payoutOn = !!s && s.payout > 0;
  const [promptOpen, setPromptOpen] = useState(false);

  useEffect(() => {
    if (!needsFeedback) return;
    try {
      if (sessionStorage.getItem(PROMPTED_KEY)) return;
      sessionStorage.setItem(PROMPTED_KEY, "1");
    } catch {
      /* storage unavailable: still prompt */
    }
    setPromptOpen(true);
  }, [needsFeedback]);

  if (!s || (s.status === "ended" && s.feedbackSubmitted)) return null;

  if (needsFeedback) {
    return (
      <>
        <a
          href="/beta/feedback"
          className="block rounded-2xl border border-amber-300 bg-amber-50 p-4 transition-colors hover:bg-amber-100/70"
        >
          <p className="flex items-center gap-2 font-semibold text-amber-900">
            <Gift className="h-4 w-4" /> {s.status === "ended" ? "Your beta week is done" : `Day ${s.day} of ${s.days}`}
          </p>
          <p className="mt-1 text-sm text-amber-900/80">
            {payoutOn && s.activeDays >= s.activeDaysRequired
              ? `Give your final feedback (about 2 minutes) to get your $${s.payout}.`
              : s.status === "ended"
                ? "We'd love your final feedback. It takes about 2 minutes."
                : "You're on day 7. A 2-minute feedback form helps us before the week wraps up."}
          </p>
        </a>
        <Dialog open={promptOpen} onOpenChange={setPromptOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-serif">Thanks for testing Clover!</DialogTitle>
              <DialogDescription>
                {s.status === "ended"
                  ? "Your beta week has ended and your account is now on the free plan, with all your logs still here."
                  : `You're on day ${s.day} of your early access. Your logs stay either way.`}
                {payoutOn && s.activeDays >= s.activeDaysRequired
                  ? ` One last step for your $${s.payout}: a 2-minute feedback form.`
                  : " Would you share 2 minutes of honest feedback?"}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <a href="/beta/feedback" className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary font-semibold text-primary-foreground">
                Give feedback
              </a>
              <button type="button" onClick={() => setPromptOpen(false)} className="h-10 text-sm text-muted-foreground">
                Later
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  const met = s.activeDays >= s.activeDaysRequired;
  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Gift className="h-4 w-4" /> Beta tester · Day {s.day} of {s.days}
        </p>
        <span className="text-xs text-muted-foreground">{s.aiUsedToday}/{s.aiDailyCap} AI today</span>
      </div>
      <div>
        <div className="flex gap-1.5" aria-label={`${s.activeDays} of ${s.activeDaysRequired} active days`}>
          {Array.from({ length: s.activeDaysRequired }, (_, i) => (
            <span key={i} className={`h-2 flex-1 rounded-full ${i < s.activeDays ? "bg-primary" : "bg-primary/15"}`} />
          ))}
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {payoutOn
            ? met
              ? `You've used Clover on ${s.activeDays} days. That covers the payout; the final form arrives when your week ends.`
              : `${s.activeDays} of ${s.activeDaysRequired} active days toward your $${s.payout}. Any AI log or question counts for the day.`
            : met
              ? `You've used Clover on ${s.activeDays} days. Thank you — a short feedback form opens on day ${s.days}.`
              : `${s.activeDays} of ${s.activeDaysRequired} days with Clover so far. Any AI log or question counts for the day.`}
        </p>
      </div>
    </div>
  );
}
