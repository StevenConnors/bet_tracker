"use client";

import { useEffect, useMemo, useState } from "react";

type User = { id: string; email: string; name?: string; role: "user" | "admin" };
type Bet = { _id: string; creatorId: string; participantIds: string[]; participants?: { email: string; name?: string }[]; condition: string; wager: string; deadline: string; status: "open" | "completed" | "cancelled" | "unresolved"; resolutionNote?: string };
type Activity = { _id: string; message: string; createdAt: string };
type Draft = { condition: string; wager: string; deadline: string; participantEmails: string[] };
type ParticipantReview = { email: string; name?: string; registered: boolean };
type Review = { draft: Draft; participants: ParticipantReview[]; missingEmails: string[] };

const dateTime = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const dateTimeInput = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const label = (bet: Bet) => bet.status === "open" && new Date(bet.deadline) < new Date() ? "overdue" : bet.status;
const errorMessage = (value: unknown, fallback: string) => typeof value === "string" ? value : fallback;

export default function Dashboard({ user }: { user: User }) {
  const [bets, setBets] = useState<Bet[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [tab, setTab] = useState<"active" | "history">("active");
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Bet | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = async () => {
    try {
      const [betsResponse, activityResponse] = await Promise.all([fetch("/api/bets"), fetch("/api/activities")]);
      if (!betsResponse.ok || !activityResponse.ok) throw new Error("Dashboard request failed");
      const [betsData, activityData] = await Promise.all([betsResponse.json(), activityResponse.json()]);
      setBets(betsData.bets ?? []);
      setActivity(activityData.activities ?? []);
      setError("");
    } catch {
      setError("Could not load your bets and recent activity. Refresh to try again.");
    }
  };

  useEffect(() => { refresh(); }, []);
  const shown = useMemo(() => bets.filter(bet => tab === "active" ? bet.status === "open" : bet.status !== "open"), [bets, tab]);

  function closeComposer() {
    setShowForm(false);
    setDraft(null);
    setReview(null);
    setBusy(false);
    setError("");
  }

  async function prepareReview(form: HTMLFormElement) {
    setBusy(true);
    setError("");
    setNotice("");
    const formData = new FormData(form);
    try {
      const nextDraft: Draft = {
        condition: String(formData.get("condition") || ""),
        wager: String(formData.get("wager") || ""),
        deadline: new Date(String(formData.get("deadline") || "")).toISOString(),
        participantEmails: String(formData.get("participants") || "").split(",").map(value => value.trim().toLowerCase()).filter(Boolean),
      };
      const response = await fetch("/api/bets/preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(nextDraft) });
      const data = await response.json();
      if (!response.ok) return setError(errorMessage(data.error, "Check the bet details and try again."));
      setDraft(data.draft);
      setReview(data);
    } catch {
      setError("Check the deadline and bet details, then try again.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmCreate() {
    if (!review) return;
    setBusy(true);
    setError("");
    const response = await fetch("/api/bets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...review.draft, confirmed: true, invitedEmails: review.missingEmails }),
    });
    const data = await response.json();
    if (!response.ok) {
      if (data.code === "REVIEW_REQUIRED" && data.review) {
        setDraft(data.review.draft);
        setReview(data.review);
      }
      setBusy(false);
      return setError(errorMessage(data.error, "Could not create the bet."));
    }
    const failed = Number(data.invitations?.failed || 0);
    setNotice(failed ? "Bet created, but an invitation email could not be delivered." : review.missingEmails.length ? "Bet created and invitation sent." : "Bet created.");
    setShowForm(false);
    setDraft(null);
    setReview(null);
    setBusy(false);
    await refresh();
  }

  async function close(status: "completed" | "cancelled" | "unresolved") {
    if (!selected) return;
    const response = await fetch(`/api/bets/${selected._id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status, resolutionNote }) });
    if (!response.ok) return setError((await response.json()).error);
    setResolutionNote("");
    setSelected(null);
    refresh();
  }

  return <main className="shell"><header><a className="brand" href="/">STAKEOUT</a><div className="profile"><span>{user.name || user.email}</span>{user.role === "admin" && <a href="/admin">Admin</a>}<form action="/api/auth/signout" method="post"><button className="text-button">Sign out</button></form></div></header>
    <section className="hero"><div><p className="eyebrow">YOUR BETS</p><h1>Keep the score.</h1><p>Every friendly wager, clear and accounted for.</p></div><button className="primary" onClick={() => { setShowForm(true); setNotice(""); }}>+ New bet</button></section>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="notice" role="status">{notice}</p>}
    {showForm && <section className="form-card" aria-labelledby="bet-composer-title"><div className="row"><h2 id="bet-composer-title">{review ? "Review your bet" : "Make a new bet"}</h2><button className="text-button" onClick={closeComposer}>Close</button></div>{review ? <div className="bet-review"><dl><div><dt>What needs to happen?</dt><dd>{review.draft.condition}</dd></div><div><dt>What’s at stake?</dt><dd>{review.draft.wager}</dd></div><div><dt>Deadline</dt><dd>{dateTime(review.draft.deadline)}</dd></div></dl><div><h3>Participants</h3><ul className="participant-review">{review.participants.map(participant => <li key={participant.email}><span>{participant.name || participant.email}{participant.name && <small>{participant.email}</small>}</span><span className={`participant-state ${participant.registered ? "registered" : "invite"}`}>{participant.registered ? "Registered" : "Invite"}</span></li>)}</ul></div>{review.missingEmails.length > 0 && <div className="invite-callout" role="note"><strong>We did not find an account for {review.missingEmails.join(", ")}.</strong><p>Would you like to invite them? Confirming will create the bet and email each invitee a private link. They must continue with the Google account for that email before they can view it.</p></div>}<div className="review-actions"><button className="text-button" disabled={busy} onClick={() => setReview(null)}>Back to edit</button><button className="primary" disabled={busy} onClick={confirmCreate}>{busy ? "Creating…" : review.missingEmails.length ? "Confirm, create, and send invite" : "Confirm and create bet"}</button></div></div> : <form onSubmit={event => { event.preventDefault(); prepareReview(event.currentTarget); }}><label>What needs to happen?<textarea name="condition" required minLength={3} defaultValue={draft?.condition} placeholder="The exact condition you both agree to" /></label><label>What’s at stake?<input name="wager" required minLength={2} defaultValue={draft?.wager} placeholder="Loser brings coffee next week" /></label><label>Deadline<input name="deadline" type="datetime-local" required defaultValue={dateTimeInput(draft?.deadline)} /></label><label>Friends’ emails <small>Separate multiple addresses with commas.</small><input name="participants" type="text" required defaultValue={draft?.participantEmails.join(", ")} placeholder="friend@example.com" /></label><button className="primary" disabled={busy}>{busy ? "Checking…" : "Review bet"}</button></form>}</section>}
    <nav className="tabs"><button className={tab === "active" ? "active" : ""} onClick={() => setTab("active")}>Active <span>{bets.filter(bet => bet.status === "open").length}</span></button><button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>History</button></nav>
    <section className="grid"><div className="bets">{shown.length ? shown.map(bet => <button className={`bet-card ${label(bet)}`} key={bet._id} onClick={() => setSelected(bet)}><div className="card-top"><span className={`badge ${label(bet)}`}>{label(bet)}</span><time>{dateTime(bet.deadline)}</time></div><h2>{bet.condition}</h2><p className="wager">{bet.wager}</p><p className="people">with {bet.participants?.filter(participant => participant?.email !== user.email).map(participant => participant?.name || participant?.email).join(", ") || "you"}</p></button>) : <div className="empty">No {tab} bets yet.</div>}</div><aside><p className="eyebrow">RECENT ACTIVITY</p>{activity.length ? activity.slice(0, 6).map(item => <div className="activity" key={item._id}><p>{item.message}</p><time>{dateTime(item.createdAt)}</time></div>) : <p className="muted">Your updates will appear here.</p>}</aside></section>
    {selected && <div className="modal-backdrop" onClick={() => setSelected(null)}><section className="modal" onClick={event => event.stopPropagation()}><div className="row"><span className={`badge ${label(selected)}`}>{label(selected)}</span><button className="text-button" onClick={() => setSelected(null)}>Close</button></div><h2>{selected.condition}</h2><p className="wager">{selected.wager}</p><p>Due {dateTime(selected.deadline)}</p><p><a href={`/bets/${selected._id}`}>Open private bet page</a></p>{selected.resolutionNote && <p className="note">{selected.resolutionNote}</p>}{selected.status === "open" && selected.creatorId === user.id && <><label className="resolution">Outcome note <small>Optional; visible to participants.</small><textarea value={resolutionNote} onChange={event => setResolutionNote(event.target.value)} placeholder="What was the outcome?" /></label><div className="actions"><button onClick={() => close("completed")}>Complete</button><button onClick={() => close("unresolved")}>Unresolved</button><button className="danger" onClick={() => close("cancelled")}>Cancel bet</button></div></>}</section></div>}
  </main>;
}
