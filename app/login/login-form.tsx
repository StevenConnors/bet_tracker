"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { safeNext } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/client";
export default function LoginForm({ requestedNext }: { requestedNext?: string }) {
  const router = useRouter(); const [email, setEmail] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true);
    const normalized = String(new FormData(event.currentTarget as HTMLFormElement).get("email") || "").trim().toLowerCase();
    const next = safeNext(requestedNext);
    const callback = `${window.location.origin}/login/verify?next=${encodeURIComponent(next)}`;
    try { await createClient().auth.signInWithOtp({ email: normalized, options: { shouldCreateUser: true, emailRedirectTo: callback } }); }
    catch { /* Keep account and delivery state private. */ }
    finally { sessionStorage.setItem("pending-auth-email", normalized); sessionStorage.setItem("auth-resend-after", String(Date.now() + 60_000)); router.push(`/login/verify?next=${encodeURIComponent(next)}&sent=1`); }
  }
  return <main className="auth"><section className="auth-card"><p className="eyebrow">STAKEOUT</p><h1>Friendly stakes.<br />No loose ends.</h1><p>Track the bets you make with friends, without involving money or awkward reminders.</p><form onSubmit={submit}><label>Email address<input name="email" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" required /></label><button disabled={busy}>{busy ? "Sending…" : "Send my sign-in code"}</button></form></section></main>;
}
