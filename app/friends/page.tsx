import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth-helpers";
import { needsProfileSetup, profileSetupPath } from "@/lib/profile";
import FriendsManager from "./friends-manager";

export default async function FriendsPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=%2Ffriends");
  if (needsProfileSetup(user)) redirect(profileSetupPath("/friends"));
  return <main className="shell">
    <header><a className="brand" href="/">STAKEOUT</a><div className="profile"><a href="/profile">Profile</a><a href="/">Back to your bets</a></div></header>
    <section className="friends-page">
      <div className="friends-heading"><p className="eyebrow">YOUR PEOPLE</p><h1>Friends.</h1><p>Add someone using the exact username they shared with you. Friend lists are private and one-way—they do not need to add you back.</p></div>
      <FriendsManager ownUsername={user.username} />
    </section>
  </main>;
}
