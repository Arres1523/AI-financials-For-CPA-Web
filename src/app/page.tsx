import { redirect } from "next/navigation";
import { isSupabaseAuthConfigured } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AuthenticatedHome from "./AuthenticatedHome";

export const dynamic = "force-dynamic";

export default async function Page() {
  if (!isSupabaseAuthConfigured()) {
    redirect("/login?error=setup");
  }

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return <AuthenticatedHome />;
}
