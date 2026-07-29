import { Leaf, ArrowLeft, Github } from "lucide-react";
import { getLoginUrl } from "@/const";
import { GuestSignInButton } from "@/components/GuestSignInButton";

/**
 * A real sign-in screen — not an immediate redirect straight into GitHub's
 * OAuth page. Every "Sign in" entry point in the app lands here so the
 * guest option is always visible before anyone leaves the site.
 */
export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-50 to-white px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-green-700 font-bold text-2xl">
            <Leaf className="h-7 w-7" /> Clover AI
          </div>
          <p className="text-sm text-gray-600">Sign in to keep tracking, or try it free first.</p>
        </div>

        <div className="bg-white border border-green-100 rounded-2xl shadow-sm p-6 space-y-4">
          <a
            href={getLoginUrl()}
            className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold flex items-center justify-center gap-2"
          >
            <Github className="h-4 w-4" /> Sign in with GitHub
          </a>

          <div className="flex items-center gap-3">
            <div className="h-px bg-gray-200 flex-1" />
            <span className="text-xs uppercase tracking-wider text-gray-400">or</span>
            <div className="h-px bg-gray-200 flex-1" />
          </div>

          <GuestSignInButton className="w-full px-4 py-3 bg-white border border-green-200 text-green-700 rounded-lg hover:bg-green-50 transition font-semibold flex items-center justify-center gap-2 disabled:opacity-70" />

          <p className="text-[11px] text-center text-gray-400">10 free AI analyses, no account needed</p>
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
