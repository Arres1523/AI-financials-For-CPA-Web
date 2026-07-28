"use client";

import React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

const FALLBACK_ERROR_MESSAGE = "Check your connection and Supabase Auth settings, then try again.";

function isReadableErrorMessage(message: string): boolean {
  const normalized = message.trim();
  return Boolean(normalized) && !["{}", "[]", "null", "undefined"].includes(normalized);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && isReadableErrorMessage(error.message)) return error.message;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string" &&
    isReadableErrorMessage(error.message)
  ) {
    return error.message;
  }
  if (
    error &&
    typeof error === "object" &&
    "error" in error &&
    typeof error.error === "string" &&
    isReadableErrorMessage(error.error)
  ) {
    return error.error;
  }
  return FALLBACK_ERROR_MESSAGE;
}

function getSignUpErrorMessage(error: unknown): string {
  const message = getErrorMessage(error);
  return message === FALLBACK_ERROR_MESSAGE ? `Account creation failed. ${message}` : message;
}

export default function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const trimmedEmail = email.trim();
      const trimmedFullName = fullName.trim();
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          password,
          fullName: trimmedFullName,
        }),
      });

      if (!response.ok) {
        let registerError: unknown = null;
        try {
          registerError = await response.json();
        } catch {}
        setError(getSignUpErrorMessage(registerError));
        return;
      }

      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (signInError) {
        setError(getSignUpErrorMessage(signInError));
        return;
      }

      router.replace("/");
      router.refresh();
    } catch (error) {
      setError(`Account creation failed: ${getErrorMessage(error)}`);
    } finally {
      setIsSubmitting(false);
    }
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
