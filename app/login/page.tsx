import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LoginForm from "./login-form";
export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
  const params = await searchParams;
  if (user) redirect("/");
  return <LoginForm authError={params.error === "oauth"} requestedNext={params.next} />;
}
