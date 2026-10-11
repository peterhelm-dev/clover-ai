import { useState } from "react";
import { ArrowLeft, Github, Loader2, Mail, MailCheck } from "lucide-react";
import { getAuthRedirectUrl, getLoginUrl, INVITE_CODE_STORAGE_KEY, safeReturnPath } from "@/const";
import { supabase } from "@/lib/supabaseClient";
import { GuestSignInButton } from "@/components/GuestSignInButton";
import { Input } from "@/components/ui/input";

function readInviteCode(): string | null {
  // main.tsx moves ?inviteCode= from the URL into localStorage on page load.
  try {
    return localStorage.getItem(INVITE_CODE_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * A real sign-in screen — not an immediate redirect into an OAuth page.
 * Every "Sign in" entry point lands here (with ?next= for where to return),
 * so the email and guest options are always visible.
 */
export default function LoginPage() {
  const returnPath = safeReturnPath(new URLSearchParams(window.location.search).get("next"));
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const address = email.trim();
    if (!address) return;
    setSending(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: address,
      options: { emailRedirectTo: getAuthRedirectUrl(returnPath, readInviteCode()) },
    });
    setSending(false);
    if (error) {
      setError(
        error.status === 429
          ? "Too many sign-in emails just now. Please wait a minute and try again."
          : error.message
      );
      return;
    }
    setSentTo(address);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF6EE] px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <a href="/" className="inline-flex items-center justify-center gap-2 text-green-900 font-serif font-semibold text-2xl">
            <img src="/clover-mark.png" alt="" className="h-8 w-auto" /> Clover
          </a>
          <p className="text-sm text-gray-600">Sign in to keep tracking, or try it free first.</p>
        </div>

        <div className="bg-white border border-green-900/10 rounded-2xl shadow-sm p-6 space-y-4">
          {sentTo ? (
            <div className="text-center space-y-3 py-2" role="status">
              <div className="mx-auto h-12 w-12 rounded-full bg-green-100 text-green-700 flex items-center justify-center">
                <MailCheck className="h-6 w-6" />
              </div>
              <p className="font-semibold text-gray-900">Check your email</p>
              <p className="text-sm text-gray-600">
                We sent a sign-in link to <span className="font-medium text-gray-900">{sentTo}</span>. Open it to
                continue. It may take a minute to arrive.
              </p>
              <button
                type="button"
                onClick={() => setSentTo(null)}
                className="text-sm text-green-700 hover:underline"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <form onSubmit={sendLink} className="space-y-3">
              <label htmlFor="email" className="text-sm font-medium text-gray-700">
                Email
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11"
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={sending}
                className="w-full px-4 py-3 bg-green-700 text-white rounded-lg hover:bg-green-800 transition font-semibold flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                Email me a sign-in link
              </button>
              <p className="text-[11px] text-center text-gray-400">No password needed. New here? This creates your account.</p>
            </form>
          )}

          <div className="flex items-center gap-3">
            <div className="h-px bg-gray-200 flex-1" />
            <span className="text-xs uppercase tracking-wider text-gray-400">or</span>
            <div className="h-px bg-gray-200 flex-1" />
          </div>

          <GuestSignInButton className="w-full px-4 py-3 bg-white border border-green-200 text-green-700 rounded-lg hover:bg-green-50 transition font-semibold flex items-center justify-center gap-2 disabled:opacity-70" />
          <a
            href={getLoginUrl(returnPath, readInviteCode())}
            className="w-full px-4 py-2.5 text-sm text-gray-600 rounded-lg hover:bg-gray-50 transition font-medium flex items-center justify-center gap-2"
          >
            <Github className="h-4 w-4" /> Continue with GitHub
          </a>
        </div>

        <a
          href="/"
          className="flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-green-700 transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to home
        </a>
      </div>
    </div>
  );
}
