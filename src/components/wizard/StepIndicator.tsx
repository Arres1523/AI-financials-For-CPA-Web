"use client";
import React from "react";

type Step = { id: number; label: string; status: "active" | "completed" | "pending" | "warning" };

export default function StepIndicator({ steps }: { steps: Step[] }) {
  return (
    <nav aria-label="Workflow progress" className="mb-8">
      <ol className="flex flex-wrap items-center gap-2 text-sm">
        {steps.map((step, i) => (
          <li key={step.id} className="flex items-center gap-2">
            <span
              className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                step.status === "completed"
                  ? "bg-sage text-white"
                  : step.status === "active"
                  ? "bg-ink text-white ring-2 ring-offset-2 ring-ink"
                  : step.status === "warning"
                  ? "bg-brass text-white"
                  : "bg-line text-slate-500"
              }`}
            >
              {step.status === "completed" ? "✓" : step.id}
            </span>
            <span
              className={`${
                step.status === "active" ? "font-semibold text-ink" : step.status === "completed" ? "text-sage" : "text-slate-400"
              }`}
            >
              {step.label}
            </span>
            {i < steps.length - 1 && <span className="text-line mx-1">—</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
