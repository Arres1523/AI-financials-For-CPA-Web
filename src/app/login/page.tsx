import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseAuthConfigured } from "@/lib/auth";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (isSupabaseAuthConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      redirect("/");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-4 py-10 font-mono">
      <section className="w-full max-w-sm border border-line bg-white p-5">
        <p className="text-xs font-semibold text-sage">Private Workspace</p>
        <h1 className="mt-2 text-xl font-semibold text-ink">Protected financial data</h1>
        <p className="mt-2 text-xs leading-5 text-slate-500">
          Sign in with a Supabase Auth user to continue.
        </p>
        <div className="mt-5">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
