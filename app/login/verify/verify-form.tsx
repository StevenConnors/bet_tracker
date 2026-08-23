"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { safeNext } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/client";
const GENERIC_ERROR = "This sign-in code or link is invalid or has expired.";
export default function VerifyForm({ tokenHash, type, requestedNext }: { tokenHash?: string; type?: string; requestedNext?: string }) {
  const router = useRouter(); const [email, setEmail] = useState(""); const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [seconds, setSeconds] = useState(60);
  useEffect(() => { setEmail(sessionStorage.getItem("pending-auth-email") || ""); const tick = () => setSeconds(Math.max(0, Math.ceil((Number(sessionStorage.getItem("auth-resend-after")) - Date.now()) / 1000))); tick(); const timer = window.setInterval(tick, 1000); return () => window.clearInterval(timer); }, []);
  async function verify(payload: Record<string, string>) {
    setBusy(true); setError("");
    try { const response = await fetch("/api/auth/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...payload, next: safeNext(requestedNext) }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || GENERIC_ERROR); sessionStorage.removeItem("pending-auth-email"); sessionStorage.removeItem("auth-resend-after"); router.replace(data.next); router.refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : GENERIC_ERROR); setBusy(false); }
  }
  async function resend() { if (!email || seconds > 0) return; setBusy(true); setError(""); const callback = `${window.location.origin}/login/verify?next=${encodeURIComponent(safeNext(requestedNext))}`; try { await createClient().auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: callback } }); } catch { /* Keep delivery failures indistinguishable. */ } finally { sessionStorage.setItem("auth-resend-after", String(Date.now() + 60_000)); setSeconds(60); setBusy(false); } }
  const linkReady = Boolean(tokenHash && type === "email");
  return <main className="auth"><section className="auth-card verify-card"><p className="eyebrow">CHECK YOUR EMAIL</p><h1>{linkReady ? "Ready to sign in?" : "Enter your code"}</h1><p>{linkReady ? "Continue below to finish signing in. This extra step keeps automated email scanners from using your link." : "We sent a six-digit code and sign-in link. The message is the same whether or not this email was registered before."}</p>{error && <p className="error" role="alert">{error}</p>}{linkReady ? <button className="auth-action" disabled={busy} onClick={() => verify({ tokenHash: tokenHash!, type: "email" })}>{busy ? "Signing in…" : "Continue to Stakeout"}</button> : <form onSubmit={e => { e.preventDefault(); verify({ email, token }); }}><label>Email address<input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required /></label><label>Six-digit code<input className="otp-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={token} onChange={e => setToken(e.target.value.replace(/\D/g, "").slice(0, 6))} required /></label><button disabled={busy || token.length !== 6}>{busy ? "Checking…" : "Sign in"}</button></form>}<div className="auth-secondary"><button className="text-button" type="button" disabled={busy || seconds > 0 || !email} onClick={resend}>{seconds > 0 ? `Send again in ${seconds}s` : "Send a new code"}</button><a href="/login">Use another email</a></div></section></main>;
}
