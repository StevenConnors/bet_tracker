import { notFound, redirect } from "next/navigation";
import { ObjectId } from "mongodb";
import { currentUser } from "@/lib/auth-helpers";
import { canReadBet, resolveBetParticipants } from "@/lib/bets";
import { db } from "@/lib/mongodb";
import { needsProfileSetup, profileSetupPath } from "@/lib/profile";
import type { AppUser, Bet } from "@/lib/types";

const dateTime = (value: Date) => new Intl.DateTimeFormat("en", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" }).format(value);

export default async function BetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ObjectId.isValid(id)) notFound();
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/bets/${id}`)}`);
  if (needsProfileSetup(user)) redirect(profileSetupPath(`/bets/${id}`));
  const database = await db();
  const bet = await database.collection<Bet>("bets").findOne({ _id: new ObjectId(id) });
  if (!bet || !canReadBet(user, bet)) notFound();
  const users = await database.collection<AppUser>("appUsers").find({ $or: [
    { _id: { $in: bet.participantIds } },
    { email: { $in: bet.participantEmails || [] } },
  ] }).toArray();
  const participants = resolveBetParticipants(bet, users);

  return <main className="shell"><header><a className="brand" href="/">STAKEOUT</a><div className="profile"><a href="/friends">Friends</a><a className="profile-name" href="/profile">{user.name || user.email}</a><a href="/">Back to your bets</a></div></header><section className="bet-detail"><div className="card-top"><span className={`badge ${bet.status}`}>{bet.status}</span><time>Due {dateTime(bet.deadline)} UTC</time></div><p className="eyebrow">PRIVATE BET</p><h1>{bet.condition}</h1><p className="detail-wager">At stake: {bet.wager}</p><div className="detail-participants"><h2>Participants</h2><ul>{participants.map(participant => <li key={participant.id || participant.email}><span>{participant.name || (participant.username ? `@${participant.username}` : participant.email)}{participant.name && <small>{participant.username ? `@${participant.username}` : participant.email}</small>}</span></li>)}</ul></div>{bet.resolutionNote && <p className="note">{bet.resolutionNote}</p>}</section></main>;
}
