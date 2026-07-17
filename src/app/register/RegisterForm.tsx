"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";

export default function RegisterForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setIsSubmitting(false);
      return;
    }

    setSuccess(true);
    setIsSubmitting(false);
  }

  if (success) {
    return (
      <div className="rounded-lg border border-[#27272A] bg-[#111111] p-6">
        <h2 className="text-lg font-mono font-semibold text-[#FFFFFF]">Check your email</h2>
        <p className="mt-2 font-mono text-sm text-[#A1A1AA]">
          We sent a confirmation link to <strong className="text-[#FFFFFF]">{email}</strong>.
          Click the link to activate your account.
        </p>
      </div>
    );
  }

  return (
    <form className="space-y-4 font-mono" onSubmit={handleSubmit}>
      <div>
        <label className="mb-1 block text-sm font-medium text-[#A1A1AA]" htmlFor="fullName">
          Full name
        </label>
        <input
          id="fullName"
          name="fullName"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full rounded-md border border-[#27272A] bg-[#111111] px-3 py-2 text-sm text-[#FFFFFF] placeholder-[#A1A1AA] outline-none transition duration-150 focus:border-[#FFD60A] focus:ring-1 focus:ring-[#FFD60A]"
          autoComplete="name"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-[#A1A1AA]" htmlFor="reg-email">
          Email
        </label>
        <input
          id="reg-email"
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-[#27272A] bg-[#111111] px-3 py-2 text-sm text-[#FFFFFF] placeholder-[#A1A1AA] outline-none transition duration-150 focus:border-[#FFD60A] focus:ring-1 focus:ring-[#FFD60A]"
          autoComplete="email"
          required
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-[#A1A1AA]" htmlFor="reg-password">
          Password
        </label>
        <input
          id="reg-password"
          name="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-[#27272A] bg-[#111111] px-3 py-2 text-sm text-[#FFFFFF] placeholder-[#A1A1AA] outline-none transition duration-150 focus:border-[#FFD60A] focus:ring-1 focus:ring-[#FFD60A]"
          autoComplete="new-password"
          required
          minLength={6}
        />
      </div>
      {error ? <p className="text-sm text-[#EF4444]" role="alert">{error}</p> : null}
      <button
        type="submit"
        className="w-full rounded-md bg-[#FFD60A] px-4 py-2 text-sm font-semibold text-[#000000] transition duration-150 hover:bg-[#FFD60A]/90 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Creating account..." : "Create account"}
      </button>
      <p className="text-center font-mono text-xs text-[#A1A1AA]">
        Already have an account?{" "}
        <a href="/login" className="text-[#FFD60A] underline">Sign in</a>
      </p>
    </form>
  );
}
