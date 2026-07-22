"use client";
import React from "react";

type Step = { id: number; label: string; status: "active" | "completed" | "pending" | "warning" };

export default function StepIndicator({ steps }: { steps: Step[] }) {
  return (
    <nav aria-label="Workflow progress" className="mb-4">
      <ol className="grid gap-px text-xs md:grid-cols-6">
        {steps.map((step) => (
          <li
            key={step.id}
            className={`flex min-h-11 items-center gap-2 border border-line px-3 py-2 ${
              step.status === "active" ? "bg-sage text-black" : step.status === "completed" ? "bg-sage/10" : "bg-white"
            }`}
          >
            <span
              className={`inline-flex h-5 min-w-5 items-center justify-center border text-[11px] font-bold ${
                step.status === "completed"
                  ? "border-sage bg-sage text-black"
                  : step.status === "active"
                  ? "border-black bg-black text-white"
                  : step.status === "warning"
                  ? "border-brass bg-brass text-black"
                  : "border-line bg-line text-slate-500"
              }`}
            >
              {step.status === "completed" ? "OK" : step.id}
            </span>
            <span
              className={`${
                step.status === "active" ? "font-semibold text-black" : step.status === "completed" ? "text-sage" : "text-slate-400"
              }`}
            >
              {step.label}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
