"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export default function UpdatePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setIsSubmitting(false);
      return;
    }

    router.replace("/login?password_updated=true");
    router.refresh();
  }

  return (
    <form className="space-y-4 font-mono" onSubmit={handleSubmit}>
      <div>
        <label className="mb-1 block text-sm font-medium text-[#A1A1AA]" htmlFor="new-password">
          New password
        </label>
        <input
          id="new-password"
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
        {isSubmitting ? "Updating..." : "Update password"}
      </button>
    </form>
  );
}
