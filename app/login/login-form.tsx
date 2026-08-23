"use client";
import { useState } from "react";
import { safeNext } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/client";
const GENERIC_ERROR = "Google sign-in could not be started. Please try again.";

export default function LoginForm({ authError = false, requestedNext }: { authError?: boolean; requestedNext?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(authError ? "Google sign-in was cancelled or could not be completed." : "");

  async function signInWithGoogle() {
    setBusy(true);
    setError("");
    const next = safeNext(requestedNext);
    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", next);
    try {
      const { error: oauthError } = await createClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callback.toString() },
      });
      if (oauthError) throw oauthError;
    } catch {
      setError(GENERIC_ERROR);
      setBusy(false);
    }
  }

  return <main className="auth"><section className="auth-card"><p className="eyebrow">STAKEOUT</p><h1>Friendly stakes.<br />No loose ends.</h1><p>Track the bets you make with friends, without involving money or awkward reminders.</p>{error && <p className="error" role="alert">{error}</p>}<button className="google-sign-in" type="button" disabled={busy} onClick={signInWithGoogle}><span aria-hidden="true">G</span>{busy ? "Opening Google…" : "Continue with Google"}</button><p className="auth-disclaimer">Use the Google account whose email address your friends invite.</p></section></main>;
}
