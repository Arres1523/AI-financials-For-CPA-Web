"use client";

import React from "react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/update-password`,
    });

    if (resetError) {
      setError(resetError.message);
      setIsSubmitting(false);
      return;
    }

    setSent(true);
    setIsSubmitting(false);
  }

  if (sent) {
    return (
      <div className="rounded-lg border border-[#27272A] bg-[#111111] p-6 font-mono">
        <h2 className="text-lg font-semibold text-[#FFFFFF]">Check your email</h2>
        <p className="mt-2 text-sm text-[#A1A1AA]">
          We sent a password reset link to <strong className="text-[#FFFFFF]">{email}</strong>.
        </p>
      </div>
    );
  }

  return (
    <form className="space-y-4 font-mono" onSubmit={handleSubmit}>
      <div>
        <label className="mb-1 block text-sm font-medium text-[#A1A1AA]" htmlFor="reset-email">
          Email
        </label>
        <input
          id="reset-email"
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-[#27272A] bg-[#111111] px-3 py-2 text-sm text-[#FFFFFF] placeholder-[#A1A1AA] outline-none transition duration-150 focus:border-[#FFD60A] focus:ring-1 focus:ring-[#FFD60A]"
          autoComplete="email"
          required
        />
      </div>
      {error ? <p className="text-sm text-[#EF4444]" role="alert">{error}</p> : null}
      <button
        type="submit"
        className="w-full rounded-md bg-[#FFD60A] px-4 py-2 text-sm font-semibold text-[#000000] transition duration-150 hover:bg-[#FFD60A]/90 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Sending..." : "Send reset link"}
      </button>
      <p className="text-center text-xs text-[#A1A1AA]">
        <a href="/login" className="text-[#FFD60A] underline">Back to sign in</a>
      </p>
    </form>
  );
}
