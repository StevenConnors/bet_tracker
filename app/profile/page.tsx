import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth-helpers";
import { safeNext } from "@/lib/auth/redirect";
import { needsProfileSetup } from "@/lib/profile";
import { usernameSuggestion } from "@/lib/identity";
import ProfileForm from "./profile-form";

export default async function Profile({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login?next=%2Fprofile");
  const onboarding = needsProfileSetup(user);
  const returnTo = safeNext((await searchParams).next);
  const card = <section className={onboarding ? "auth-card profile-card" : "profile-page"}>
    <p className="eyebrow">{onboarding ? "WELCOME TO STAKEOUT" : "YOUR PROFILE"}</p>
    <h1>{onboarding ? "Set up your profile." : "Make it yours."}</h1>
    <p className="profile-copy">Choose the name friends see and a unique username they can use to add you. Changing your username later will not break existing friendships.</p>
    <div className="profile-email"><span>Signed in as</span><strong>{user.email}</strong></div>
    <ProfileForm initialName={user.name} initialUsername={user.username || usernameSuggestion(user.name || user.email.split("@")[0])} onboarding={onboarding} returnTo={returnTo} />
  </section>;

  if (onboarding) return <main className="auth profile-onboarding">{card}</main>;
  return <main className="shell"><header><a className="brand" href="/">STAKEOUT</a><div className="profile"><a href="/friends">Friends</a><a href="/">Back to your bets</a><form action="/api/auth/signout" method="post"><button className="text-button">Sign out</button></form></div></header>{card}</main>;
}
