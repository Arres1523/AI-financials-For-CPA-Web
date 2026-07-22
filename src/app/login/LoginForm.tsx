"use client";

import React from "react";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const setupError = searchParams.get("error") === "setup";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (setupError) {
      setError("Supabase auth is not configured.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    let signInError: { message: string } | null = null;
    try {
      const supabase = createClient();
      const result = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      signInError = result.error;
    } catch {
      signInError = { message: "Supabase auth is not configured." };
    }

    if (signInError) {
      setError(signInError.message);
      setIsSubmitting(false);
      return;
    }

    router.replace(next);
    router.refresh();
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <label className="mb-1 block text-sm font-medium text-ink" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-ink"
          autoComplete="email"
          required
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-ink" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-ink"
          autoComplete="current-password"
          required
        />
      </div>
      {setupError ? (
        <p className="text-sm text-amber-700">
          Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> in <code>.env.local</code> first.
        </p>
      ) : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button
        type="submit"
        className="w-full rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Signing in..." : "Sign in"}
      </button>
      <p className="text-center text-sm text-slate-600">
        New here?{" "}
        <a href="/register" className="font-medium text-sage underline">
          Create account
        </a>
      </p>
    </form>
  );
}
