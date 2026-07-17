import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import UpdatePasswordForm from "./UpdatePasswordForm";

export const dynamic = "force-dynamic";

export default async function UpdatePasswordPage() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");
  } catch {
    redirect("/login");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#000000] px-4 py-12 font-mono">
      <section className="w-full max-w-md rounded-lg border border-[#27272A] bg-[#111111] p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-[#A1A1AA]">Private Workspace</p>
        <h1 className="mt-2 text-xl font-semibold text-[#FFFFFF]">Set new password</h1>
        <p className="mt-2 text-sm text-[#A1A1AA]">
          Enter your new password below.
        </p>
        <div className="mt-6">
          <Suspense>
            <UpdatePasswordForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
