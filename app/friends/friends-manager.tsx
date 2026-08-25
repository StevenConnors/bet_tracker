"use client";

import { useEffect, useState } from "react";
import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from "@/lib/profile-constants";

type Friend = { id: string; name?: string; username: string };

export default function FriendsManager({ ownUsername }: { ownUsername?: string }) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function refresh() {
    try {
      const response = await fetch("/api/friends");
      if (!response.ok) throw new Error();
      setFriends((await response.json()).friends || []);
      setError("");
    } catch {
      setError("Could not load your friends. Refresh to try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function addFriend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/friends", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not add that friend.");
      setFriends(current => [data.friend, ...current]);
      setUsername("");
      setNotice(`${data.friend.name || `@${data.friend.username}`} is now in your friends.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add that friend.");
    } finally {
      setBusy(false);
    }
  }

  async function removeFriend(friend: Friend) {
    if (!window.confirm(`Remove ${friend.name || `@${friend.username}`} from your friends?`)) return;
    setError("");
    setNotice("");
    const response = await fetch(`/api/friends/${friend.id}`, { method: "DELETE" });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      return setError(data?.error || "Could not remove that friend.");
    }
    setFriends(current => current.filter(item => item.id !== friend.id));
    setNotice("Friend removed.");
  }

  return <div className="friends-layout">
    <section className="friend-add-card">
      <h2>Add a friend</h2>
      <p>Enter their complete username. Stakeout will not suggest or show other accounts.</p>
      <form onSubmit={addFriend}>
        <label>Username
          <span className="username-input"><span aria-hidden="true">@</span><input value={username} onChange={event => setUsername(event.target.value.toLowerCase())} minLength={USERNAME_MIN_LENGTH} maxLength={USERNAME_MAX_LENGTH} pattern="[a-z0-9_]+" placeholder="their_username" disabled={busy} required /></span>
        </label>
        <button className="primary" disabled={busy}>{busy ? "Adding…" : "Add friend"}</button>
      </form>
      {ownUsername ? <p className="share-username">Friends can add you as <strong>@{ownUsername}</strong>.</p> : <p className="share-username">Set a username on your <a href="/profile">profile</a> so friends can add you.</p>}
    </section>
    <section className="friend-list" aria-labelledby="friend-list-title">
      <h2 id="friend-list-title">Your friends <span>{friends.length}</span></h2>
      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p className="notice" role="status">{notice}</p>}
      {loading ? <p className="muted">Loading friends…</p> : friends.length ? <ul>{friends.map(friend => <li key={friend.id}><span><strong>{friend.name || `@${friend.username}`}</strong>{friend.name && <small>@{friend.username}</small>}</span><button className="text-button" onClick={() => removeFriend(friend)}>Remove</button></li>)}</ul> : <div className="empty">No friends yet. Add someone with the username they shared with you.</div>}
    </section>
  </div>;
}
