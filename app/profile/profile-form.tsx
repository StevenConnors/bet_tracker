"use client";

import { useEffect, useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { DISPLAY_NAME_MAX_LENGTH, USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from "@/lib/profile-constants";

export default function ProfileForm({ initialName, initialUsername, onboarding, returnTo }: { initialName?: string; initialUsername: string; onboarding: boolean; returnTo: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName || "");
  const [username, setUsername] = useState(initialUsername);
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => setHydrated(true), []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submittedName = String(new FormData(event.currentTarget).get("name") || "");
    const submittedUsername = String(new FormData(event.currentTarget).get("username") || "");
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: submittedName, username: submittedUsername }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save your profile.");
      setName(data.user.name);
      setUsername(data.user.username);
      if (onboarding) {
        router.replace(returnTo as Route);
      } else {
        setNotice("Your profile has been updated.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save your profile.");
    } finally {
      setBusy(false);
    }
  }

  return <form className="profile-form" onSubmit={submit}>
    <label>Visible name
      <input name="name" value={name} onChange={event => setName(event.target.value)} autoComplete="name" maxLength={DISPLAY_NAME_MAX_LENGTH} autoFocus={onboarding} placeholder="What should your friends call you?" disabled={busy || !hydrated} required />
      <small>This is the name friends will see on bets and activity.</small>
    </label>
    <label>Username
      <span className="username-input"><span aria-hidden="true">@</span><input name="username" value={username} onChange={event => setUsername(event.target.value.toLowerCase())} autoComplete="username" minLength={USERNAME_MIN_LENGTH} maxLength={USERNAME_MAX_LENGTH} pattern="[a-z0-9_]+" placeholder="your_username" disabled={busy || !hydrated} required /></span>
      <small>Friends add you with this exact username. Letters, numbers, and underscores only.</small>
    </label>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="notice" role="status">{notice}</p>}
    <div className="profile-actions">
      {!onboarding && <a href="/">Cancel</a>}
      <button className="primary" disabled={busy || !hydrated}>{busy ? "Saving…" : onboarding ? "Save and continue" : "Save changes"}</button>
    </div>
  </form>;
}
