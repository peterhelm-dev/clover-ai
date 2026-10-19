import { useState } from "react";
import { Check, Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getSignInPageUrl } from "@/const";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

type Choice<T extends string> = { value: T; label: string };

function Choices<T extends string>({ options, value, onChange, label }: { options: Choice<T>[]; value: T | null; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-11 rounded-full border px-4 text-sm transition-colors ${
            value === o.value ? "border-green-700 bg-green-700 text-white" : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div className="space-y-2">
    <p className="font-medium text-gray-900">{label}</p>
    {hint && <p className="-mt-1 text-xs text-gray-500">{hint}</p>}
    {children}
  </div>
);

/** /beta/feedback — the end-of-week survey. Opens on day 7. Payout fields only when a payout is configured. */
export default function BetaFeedbackPage() {
  const { isAuthenticated, loading } = useAuth();
  const status = trpc.betaProgram.status.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const utils = trpc.useUtils();
  const submit = trpc.betaProgram.submitFeedback.useMutation({
    onSuccess: (s) => utils.betaProgram.status.setData(undefined, s),
    onError: (err) => toast.error(err.message),
  });

  const [rating, setRating] = useState(0);
  const [keepUsing, setKeepUsing] = useState<"yes" | "maybe" | "no" | null>(null);
  const [likedMost, setLikedMost] = useState("");
  const [frustrating, setFrustrating] = useState("");
  const [confusing, setConfusing] = useState("");
  const [wouldPay, setWouldPay] = useState<"no" | "under_5" | "5_to_10" | "over_10" | null>(null);
  const [anythingElse, setAnythingElse] = useState("");
  const [payoutMethod, setPayoutMethod] = useState<"paypal" | "venmo" | null>(null);
  const [payoutHandle, setPayoutHandle] = useState("");

  const s = status.data;
  const payoutOn = !!s && s.payout > 0;
  const eligible = payoutOn && !!s && s.activeDays >= s.activeDaysRequired;
  const ready =
    rating > 0 && keepUsing && likedMost.trim() && frustrating.trim() && wouldPay && (!eligible || (payoutMethod && payoutHandle.trim().length >= 2));

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-[#FAF6EE]">
      <div className="mx-auto max-w-lg px-4 pt-8 pb-16">
        <a href="/" className="inline-flex items-center gap-2 font-serif text-xl font-semibold text-green-900">
          <img src="/clover-mark.png" alt="" className="h-7 w-auto" /> Clover
        </a>
        <div className="mt-8">{children}</div>
      </div>
    </div>
  );

  if (loading || (isAuthenticated && status.isLoading)) {
    return shell(
      <div className="flex justify-center py-16 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (!isAuthenticated) {
    return shell(
      <div className="space-y-4 text-center">
        <h1 className="font-serif text-3xl font-semibold">Your beta feedback</h1>
        <p className="text-gray-600">Sign in with the email you used for the beta.</p>
        <a href={getSignInPageUrl("/beta/feedback")} className="inline-flex rounded-xl bg-green-700 px-6 py-3 font-semibold text-white">
          Sign in
        </a>
      </div>
    );
  }
  if (!s) {
    return shell(
      <div className="space-y-3 text-center">
        <h1 className="font-serif text-3xl font-semibold">This form is for beta testers</h1>
        <p className="text-gray-600">This account isn't in the beta. If you joined with a different email, sign in with that one.</p>
      </div>
    );
  }
  if (s.feedbackSubmitted) {
    return shell(
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-700">
          <Check className="h-7 w-7" />
        </div>
        <h1 className="font-serif text-3xl font-semibold">Thank you!</h1>
        <p className="text-gray-700">
          {payoutOn && s.paid
            ? `Your $${s.payout} has been sent.`
            : payoutOn && s.qualified
              ? `You've earned your $${s.payout}. We'll send it within 7 days.`
              : "Your feedback genuinely helps shape Clover before launch."}
        </p>
        <a href="/" className="inline-flex rounded-xl bg-green-700 px-6 py-3 font-semibold text-white">
          Back to Clover
        </a>
      </div>
    );
  }
  if (!s.feedbackOpen) {
    return shell(
      <div className="space-y-3 text-center">
        <h1 className="font-serif text-3xl font-semibold">Almost there</h1>
        <p className="text-gray-600">
          You're on day {s.day} of {s.days}. This form opens on day {s.days}, and we'll email you the link.
        </p>
        <a href="/" className="inline-flex rounded-xl bg-green-700 px-6 py-3 font-semibold text-white">
          Open Clover
        </a>
      </div>
    );
  }

  return shell(
    <form
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready) return;
        submit.mutate({
          overallRating: rating,
          keepUsing: keepUsing!,
          likedMost,
          frustrating,
          confusing: confusing || undefined,
          wouldPay: wouldPay!,
          anythingElse: anythingElse || undefined,
          ...(eligible ? { payoutMethod: payoutMethod!, payoutHandle } : {}),
        });
      }}
    >
      <div className="space-y-2">
        <h1 className="font-serif text-3xl font-semibold leading-tight">How was your week with Clover?</h1>
        <p className="text-gray-600">
          {eligible
            ? `You used Clover on ${s.activeDays} days, so this is the last step for your $${s.payout}. About 2 minutes.`
            : payoutOn
              ? `You used Clover on ${s.activeDays} of the ${s.activeDaysRequired} days the payout needed, so this round doesn't include the $${s.payout}. Your honest feedback still helps a lot.`
              : s.status === "active"
                ? `You're on day ${s.day} of your early access. This takes about 2 minutes.`
                : "Your early-access week is wrapped up. This takes about 2 minutes, and it shapes what we build next."}
        </p>
      </div>

      <Field label="Overall, how would you rate Clover?">
        <div className="flex gap-1" role="radiogroup" aria-label="Overall rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} of 5`} onClick={() => setRating(n)} className="h-11 w-11 flex items-center justify-center">
              <Star className={`h-8 w-8 ${n <= rating ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} />
            </button>
          ))}
        </div>
      </Field>

      <Field label="Would you keep using it?">
        <Choices label="Keep using" value={keepUsing} onChange={setKeepUsing} options={[{ value: "yes", label: "Yes" }, { value: "maybe", label: "Maybe" }, { value: "no", label: "No" }]} />
      </Field>

      <Field label="What did you like most?">
        <Textarea value={likedMost} onChange={(e) => setLikedMost(e.target.value)} rows={3} className="bg-white" />
      </Field>

      <Field label="What frustrated you or got in the way?">
        <Textarea value={frustrating} onChange={(e) => setFrustrating(e.target.value)} rows={3} className="bg-white" />
      </Field>

      <Field label="Was anything confusing?" hint="Optional">
        <Textarea value={confusing} onChange={(e) => setConfusing(e.target.value)} rows={2} className="bg-white" />
      </Field>

      <Field label="What would you pay per month for Clover?">
        <Choices
          label="Willingness to pay"
          value={wouldPay}
          onChange={setWouldPay}
          options={[
            { value: "no", label: "Nothing" },
            { value: "under_5", label: "Under $5" },
            { value: "5_to_10", label: "$5–10" },
            { value: "over_10", label: "Over $10" },
          ]}
        />
      </Field>

      <Field label="Anything else?" hint="Optional">
        <Textarea value={anythingElse} onChange={(e) => setAnythingElse(e.target.value)} rows={2} className="bg-white" />
      </Field>

      {eligible && (
        <div className="space-y-4 rounded-2xl border border-green-900/10 bg-white p-5">
          <p className="font-medium text-gray-900">Where should we send your ${s.payout}?</p>
          <Choices label="Payout method" value={payoutMethod} onChange={setPayoutMethod} options={[{ value: "paypal", label: "PayPal" }, { value: "venmo", label: "Venmo" }]} />
          {payoutMethod && (
            <Input
              value={payoutHandle}
              onChange={(e) => setPayoutHandle(e.target.value)}
              placeholder={payoutMethod === "venmo" ? "@your-venmo" : "PayPal email or @username"}
              autoComplete="off"
              className="h-11 bg-white text-base"
            />
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={!ready || submit.isPending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-green-700 px-6 py-4 text-lg font-semibold text-white disabled:opacity-50"
      >
        {submit.isPending && <Loader2 className="h-5 w-5 animate-spin" />} Send feedback
      </button>
    </form>
  );
}
