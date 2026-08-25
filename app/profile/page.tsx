import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth-helpers";
import { safeNext } from "@/lib/auth/redirect";
import { needsProfileSetup } from "@/lib/profile";
import ProfileForm from "./profile-form";

export default async function Profile({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login?next=%2Fprofile");
  const onboarding = needsProfileSetup(user);
  const returnTo = safeNext((await searchParams).next);
  const card = <section className={onboarding ? "auth-card profile-card" : "profile-page"}>
    <p className="eyebrow">{onboarding ? "WELCOME TO STAKEOUT" : "YOUR PROFILE"}</p>
    <h1>{onboarding ? "What should we call you?" : "Make it yours."}</h1>
    <p className="profile-copy">We start with the name from your account, but friendly bets do not need formal introductions. Choose the name that feels like you.</p>
    <div className="profile-email"><span>Signed in as</span><strong>{user.email}</strong></div>
    <ProfileForm initialName={user.name} onboarding={onboarding} returnTo={returnTo} />
  </section>;

  if (onboarding) return <main className="auth profile-onboarding">{card}</main>;
  return <main className="shell"><header><a className="brand" href="/">STAKEOUT</a><div className="profile"><a href="/">Back to your bets</a><form action="/api/auth/signout" method="post"><button className="text-button">Sign out</button></form></div></header>{card}</main>;
}
