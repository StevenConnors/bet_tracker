import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth-helpers";
import { needsProfileSetup, profileSetupPath } from "@/lib/profile";
import Dashboard from "@/components/dashboard";
export default async function Home() { const user = await currentUser(); if (!user) redirect("/login"); if (needsProfileSetup(user)) redirect(profileSetupPath("/")); return <Dashboard user={{ id: user._id.toString(), email: user.email, name: user.name, username: user.username, role: user.role }} />; }
