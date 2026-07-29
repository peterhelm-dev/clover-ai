import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

/**
 * Anonymous Supabase session — the guest demo path. Shared by every entry
 * point (landing hero, login screen) so there's exactly one place that
 * knows how to start a guest session.
 */
export function useGuestSignIn() {
  const [busy, setBusy] = useState(false);

  const startGuestSession = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInAnonymously();
    if (error) {
      setBusy(false);
      // Surface the real reason — almost always "Anonymous sign-ins are
      // disabled" until it's turned on in the Supabase dashboard — instead
      // of a generic message that hides the actual fix needed.
      console.error("[Guest sign-in] Supabase error:", error.message, error);
      toast.error(`Guest demo unavailable: ${error.message}`);
      return;
    }
    window.location.href = "/";
  };

  return { startGuestSession, busy };
}
