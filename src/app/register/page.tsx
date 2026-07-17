import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import RegisterForm from "./RegisterForm";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) redirect("/");
  } catch {}

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#000000] px-4 py-12 font-mono">
      <section className="w-full max-w-md rounded-lg border border-[#27272A] bg-[#111111] p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-[#A1A1AA]">Private Workspace</p>
        <h1 className="mt-2 text-xl font-semibold text-[#FFFFFF]">Create account</h1>
        <p className="mt-2 text-sm text-[#A1A1AA]">
          Register to access the financial workflow platform.
        </p>
        <div className="mt-6">
          <Suspense>
            <RegisterForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
