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
      toast.error("The guest demo is taking a breather — try signing in instead.");
      return;
    }
    window.location.href = "/";
  };

  return { startGuestSession, busy };
}
