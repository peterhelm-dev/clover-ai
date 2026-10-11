import { CalendarCheck, Check, Gift, Loader2, MessageSquareText, Mic } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getSignInPageUrl } from "@/const";

/**
 * /join — the public link for the paid 7-day beta (shared on social media,
 * not linked from the app). Signed-out visitors sign in and come back here;
 * joining is always an explicit "Join beta" tap.
 */
export default function JoinBetaPage() {
  const { isAuthenticated, loading, user } = useAuth();
  const isGuest = user?.loginMethod === "anonymous";
  const availability = trpc.betaProgram.availability.useQuery(undefined, { retry: 1 });
  const status = trpc.betaProgram.status.useQuery(undefined, { enabled: isAuthenticated && !isGuest, retry: false });
  const join = trpc.betaProgram.join.useMutation({
    onSuccess: () => {
      toast.success("You're in! Welcome to the Clover beta.");
      window.location.href = "/";
    },
    onError: (err) => {
      toast.error(err.message);
      availability.refetch();
    },
  });

  const a = availability.data;
  const payout = a?.payout ?? 25;
  const days = a?.days ?? 7;
  const needed = a?.activeDaysRequired ?? 5;

  const steps = [
    { icon: Mic, title: "Log what you eat", body: "Say it, type it or snap a photo. About a minute a day." },
    { icon: CalendarCheck, title: `Use Clover on ${needed} of ${days} days`, body: "Any days you like. We'll send a short email each day with something new to try." },
    { icon: MessageSquareText, title: "Tell us what you think", body: `A 2-minute form at the end of your week, then $${payout} by PayPal or Venmo.` },
  ];

  const action = () => {
    if (loading || availability.isLoading || (isAuthenticated && !isGuest && status.isLoading)) {
      return (
        <div className="flex items-center justify-center gap-2 text-sm text-gray-500 py-4">
          <Loader2 className="h-4 w-4 animate-spin" /> One moment...
        </div>
      );
    }
    if (status.data) {
      return (
        <div className="space-y-3 text-center">
          <p className="font-medium text-gray-900">
            {status.data.status === "active"
              ? `You're in the beta — day ${status.data.day} of ${status.data.days}.`
              : "Your beta week is finished. Thank you!"}
          </p>
          <a
            href={status.data.status === "active" || status.data.feedbackSubmitted ? "/" : "/beta/feedback"}
            className="inline-flex w-full items-center justify-center rounded-xl bg-green-700 px-6 py-4 font-semibold text-white hover:bg-green-800"
          >
            {status.data.status === "active" || status.data.feedbackSubmitted ? "Open Clover" : "Give your final feedback"}
          </a>
        </div>
      );
    }
    if (!a?.open) {
      return (
        <div className="space-y-3 text-center">
          <p className="font-medium text-gray-900">The beta is full right now.</p>
          <p className="text-sm text-gray-600">Thanks so much for your interest. You can still use Clover free, no card needed.</p>
          <a href="/" className="inline-flex w-full items-center justify-center rounded-xl border-2 border-green-700/20 px-6 py-4 font-semibold text-green-800 hover:bg-green-50">
            Try Clover free
          </a>
        </div>
      );
    }
    if (!isAuthenticated || isGuest) {
      return (
        <div className="space-y-2">
          <a
            href={getSignInPageUrl("/join")}
            className="inline-flex w-full items-center justify-center rounded-xl bg-green-700 px-6 py-4 text-lg font-semibold text-white shadow-md hover:bg-green-800"
          >
            Join beta
          </a>
          <p className="text-center text-xs text-gray-500">
            {isGuest ? "You'll need a free account (not the guest demo) so we can reach you." : "First you'll sign in with your email. No password, no card."}
          </p>
        </div>
      );
    }
    return (
      <div className="space-y-2">
        <button
          type="button"
          disabled={join.isPending}
          onClick={() => join.mutate()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-green-700 px-6 py-4 text-lg font-semibold text-white shadow-md hover:bg-green-800 disabled:opacity-70"
        >
          {join.isPending && <Loader2 className="h-5 w-5 animate-spin" />} Join beta
        </button>
        <p className="text-center text-xs text-gray-500">Signed in as {user?.email}. Your 7 days start when you tap Join.</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#FAF6EE]">
      <div className="mx-auto max-w-md px-4 pt-8 pb-12">
        <a href="/" className="inline-flex items-center gap-2 font-serif text-xl font-semibold text-green-900">
          <img src="/clover-mark.png" alt="" className="h-7 w-auto" /> Clover
        </a>

        <img
          src="/images/feature-voice.webp"
          alt="A person relaxing on a couch, telling their phone what they're eating"
          className="mt-6 w-full rounded-3xl object-cover aspect-[4/3] shadow-sm"
        />

        <div className="mt-8 space-y-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
            <Gift className="h-3.5 w-3.5" /> Paid beta
            {a?.open && <span className="font-normal">· {a.spotsLeft} of {a.spots} spots left</span>}
          </span>
          <h1 className="font-serif text-4xl font-semibold leading-tight text-gray-900">
            Get ${payout} to test Clover for a week
          </h1>
          <p className="text-lg leading-relaxed text-gray-700">
            Clover is a calm AI food and mood companion: tell it what you ate, and it quietly builds an honest picture of how you
            eat and feel. No streaks, no guilt. We'd love your honest take before we launch.
          </p>
        </div>

        <ol className="mt-8 space-y-5">
          {steps.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-green-100 text-green-700">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold text-gray-900">{title}</p>
                <p className="text-sm leading-relaxed text-gray-600">{body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-8 rounded-2xl border border-green-900/10 bg-white p-5 shadow-sm">{action()}</div>

        <ul className="mt-8 space-y-2 text-xs leading-relaxed text-gray-500">
          {[
            "One beta week per person. You must be 18+ and use an account with a real email address.",
            `After ${days} days your account moves to the free plan automatically. Nothing to cancel, and we never ask for a card.`,
            `Fair use: up to ${a?.dailyCap ?? 20} AI analyses a day and ${a?.weeklyCap ?? 100} for the week.`,
            "You'll get one short email a day during your week; you can stop them anytime.",
            "We may decline payment for duplicate or fraudulent accounts. Payments are sent within 7 days of your final feedback.",
          ].map((t) => (
            <li key={t} className="flex gap-2">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-700" /> {t}
            </li>
          ))}
        </ul>
        <p className="mt-6 text-center text-xs text-gray-400">
          <a href="/privacy" className="underline">Privacy</a> · <a href="/tos" className="underline">Terms</a>
        </p>
      </div>
    </div>
  );
}
