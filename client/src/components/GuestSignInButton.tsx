import { Loader2, Sparkles } from "lucide-react";
import { useGuestSignIn } from "@/hooks/useGuestSignIn";

export function GuestSignInButton({ className }: { className?: string }) {
  const { startGuestSession, busy } = useGuestSignIn();
  return (
    <button
      type="button"
      disabled={busy}
      onClick={startGuestSession}
      className={
        className ??
        "px-8 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold flex items-center justify-center gap-2 group disabled:opacity-70"
      }
    >
      {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
      Try it right now — no signup
    </button>
  );
}
