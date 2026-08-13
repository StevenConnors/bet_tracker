import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth-helpers";
import AdminPanel from "@/components/admin-panel";
export default async function Admin() { const user = await currentUser(); if (!user || user.role !== "admin") redirect("/"); return <AdminPanel />; }
