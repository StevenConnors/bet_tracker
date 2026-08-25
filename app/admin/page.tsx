import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth-helpers";
import { needsProfileSetup, profileSetupPath } from "@/lib/profile";
import AdminPanel from "@/components/admin-panel";
export default async function Admin() { const user = await currentUser(); if (!user || user.role !== "admin") redirect("/"); if (needsProfileSetup(user)) redirect(profileSetupPath("/admin")); return <AdminPanel />; }
