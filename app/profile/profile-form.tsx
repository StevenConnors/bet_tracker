"use client";

import { useEffect, useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { DISPLAY_NAME_MAX_LENGTH } from "@/lib/profile-constants";

export default function ProfileForm({ initialName, onboarding, returnTo }: { initialName?: string; onboarding: boolean; returnTo: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName || "");
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => setHydrated(true), []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submittedName = String(new FormData(event.currentTarget).get("name") || "");
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: submittedName }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save your profile.");
      setName(data.user.name);
      if (onboarding) {
        router.replace(returnTo as Route);
      } else {
        setNotice("Your visible name has been updated.");
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
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="notice" role="status">{notice}</p>}
    <div className="profile-actions">
      {!onboarding && <a href="/">Cancel</a>}
      <button className="primary" disabled={busy || !hydrated}>{busy ? "Saving…" : onboarding ? "Save and continue" : "Save changes"}</button>
    </div>
  </form>;
}
