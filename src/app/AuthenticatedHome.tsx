import React from "react";
import Wizard from "@/components/wizard/Wizard";
import LogoutButton from "@/components/auth/LogoutButton";

export default function AuthenticatedHome() {
  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line bg-[#050505]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-xs font-semibold text-sage">AI Financials for CPA Web</p>
            <p className="mt-0.5 text-xs text-slate-500">Annual financial workflow</p>
          </div>
          <LogoutButton />
        </div>
      </header>
      <Wizard />
    </div>
  );
}
