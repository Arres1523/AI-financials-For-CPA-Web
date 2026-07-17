import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      redirect("/");
    }
  } catch {
    // Missing environment variables are handled by the login form message.
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-4 py-12">
      <section className="w-full max-w-md rounded-2xl border border-line bg-white p-8 shadow-sm">
        <p className="text-xs uppercase tracking-[0.24em] text-sage">Private Workspace</p>
        <h1 className="mt-2 text-2xl font-semibold text-ink">Protected financial data</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Sign in with a Supabase Auth user to continue. Keep public signups disabled and invite approved users only.
        </p>
        <div className="mt-6">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
