"use client";
import React from "react";

import type { ColumnMapping } from "@/domain/types";

type Props = {
  columns: string[];
  detected: Partial<ColumnMapping>;
  onChange: (mapping: ColumnMapping) => void;
};

const FIELDS: { key: keyof ColumnMapping; label: string; required: boolean }[] = [
  { key: "date" as const, label: "Date", required: true },
  { key: "description" as const, label: "Description", required: true },
  { key: "payee" as const, label: "Payee / Vendor", required: false },
  { key: "merchantCategory" as const, label: "Merchant Category", required: false },
  { key: "transactionType" as const, label: "Transaction Type", required: false },
  { key: "amount" as const, label: "Amount (single column)", required: false },
  { key: "debit" as const, label: "Debit (if separate)", required: false },
  { key: "credit" as const, label: "Credit (if separate)", required: false },
  { key: "balance" as const, label: "Balance", required: false },
];

export default function ColumnMapper({ columns, detected, onChange }: Props) {
  const current: ColumnMapping = {
    date: detected.date || columns[0] || "",
    description: detected.description || columns[1] || "",
    payee: detected.payee,
    merchantCategory: detected.merchantCategory,
    transactionType: detected.transactionType,
    amount: detected.amount || "",
    debit: detected.debit,
    credit: detected.credit,
    balance: detected.balance,
  };

  function update(key: keyof ColumnMapping, value: string) {
    const next = { ...current, [key]: value || undefined };
    onChange(next);
  }

  const hasAmount = !!current.amount;
  const hasDebitCredit = !!current.debit && !!current.credit;

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Column Mapping: match each field to a column</p>
      <div className="flex flex-wrap gap-2 text-xs">
        {FIELDS.filter(({ key }) => current[key]).map(({ key, label }) => (
          <span key={key} className="rounded border border-sage/30 bg-sage/10 px-2 py-1 text-sage">
            {label}: {current[key]}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-[1fr_2fr] gap-2 text-sm">
        {FIELDS.map(({ key, label, required }) => {
          if (key === "debit" || key === "credit") {
            if (hasAmount && !current.debit && !current.credit) return null;
          }
          if (key === "amount" && hasDebitCredit) return null;
          return (
            <div key={key} className="contents">
              <label className="flex items-center gap-1 text-slate-600">
                {label}
                {required && <span className="text-red-500">*</span>}
              </label>
              <select
                className={`rounded border px-3 py-1.5 text-sm ${current[key] ? "border-sage bg-sage/5" : "border-line"}`}
                value={current[key] || ""}
                onChange={(e) => update(key, e.target.value)}
              >
                <option value="">Select</option>
                {columns.map((col) => (
                  <option key={col} value={col}>
                    {col} {detected[key] === col ? "(detected)" : ""}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
}
