import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth-helpers";
import Dashboard from "@/components/dashboard";
export default async function Home() { const user = await currentUser(); if (!user) redirect("/login"); return <Dashboard user={{ id: user._id.toString(), email: user.email, name: user.name, role: user.role }} />; }
