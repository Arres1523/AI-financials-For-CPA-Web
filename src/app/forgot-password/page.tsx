import { Suspense } from "react";
import ForgotPasswordForm from "./ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#000000] px-4 py-12 font-mono">
      <section className="w-full max-w-md rounded-lg border border-[#27272A] bg-[#111111] p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-[#A1A1AA]">Private Workspace</p>
        <h1 className="mt-2 text-xl font-semibold text-[#FFFFFF]">Reset password</h1>
        <p className="mt-2 text-sm text-[#A1A1AA]">
          Enter your email and we will send you a reset link.
        </p>
        <div className="mt-6">
          <Suspense>
            <ForgotPasswordForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
