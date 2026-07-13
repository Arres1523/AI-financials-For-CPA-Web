"use client";
import React from "react";

import { useState, useEffect } from "react";
import type { Workspace, BankAccount, Transaction, Classification, ReconciliationResult } from "@/domain/types";
import { reconcileAccountPeriod } from "@/domain/reconciliation";

type Props = {
  workspace: Workspace;
  accounts: BankAccount[];
  onComplete: (results: ReconciliationResult[]) => void;
  onBack?: () => void;
};

export default function ReconciliationStep({ workspace, accounts, onComplete, onBack }: Props) {
  const [results, setResults] = useState<ReconciliationResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/transactions?workspaceId=${workspace.id}`);
      if (!res.ok) { setLoading(false); return; }
      const allTx: Transaction[] = await res.json();
      const byAccount = groupBy(allTx, "bankAccountId");
      const recs: ReconciliationResult[] = accounts.map((a) => {
        const txs = byAccount[a.id] ?? [];
        return reconcileAccountPeriod(a.openingBalance, a.closingBalance, txs);
      });
      recs.forEach((r) => {
        const a = accounts.find((x) => x.id === r.accountId);
        r.accountName = a?.accountName ?? "Unknown";
        r.accountId = a?.id ?? "";
      });
      setResults(recs);
      setLoading(false);
    }
    load();
  }, [workspace.id, accounts]);

  const hasUnreconciled = results.some((r) => r.status === "unreconciled");
  const hasNoBalances = results.some((r) => r.openingBalance === 0 && r.closingBalance === 0);

  if (loading) return <p className="text-sm text-slate-500">Loading reconciliation data…</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Reconciliation by Account</h2>

      {hasNoBalances && (
        <div className="rounded border border-brass/30 bg-brass/5 p-4 text-sm text-brass">
          ⚠ Some accounts have opening/closing balances of $0.00. Update account balances for accurate reconciliation.
        </div>
      )}

      {hasUnreconciled && (
        <div className="rounded border border-red-200 bg-red-50 p-4 space-y-1 text-sm text-red-700">
          <p className="font-medium">⚠ One or more accounts could not be reconciled</p>
          <p>These reports are PRELIMINARY — generated solely from uploaded bank statement data.</p>
          <p>The Balance Sheet may be incomplete. This does not substitute a professional CPA review.</p>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="px-3 py-2">Account</th>
              <th className="px-3 py-2">Opening</th>
              <th className="px-3 py-2">Movement</th>
              <th className="px-3 py-2">Expected Close</th>
              <th className="px-3 py-2">Closing</th>
              <th className="px-3 py-2">Variance</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.accountId} className="border-b border-line">
                <td className="px-3 py-2 font-medium">{r.accountName}</td>
                <td className="px-3 py-2 money">${r.openingBalance.toFixed(2)}</td>
                <td className="px-3 py-2 money">{r.movementTotal >= 0 ? "+" : ""}${r.movementTotal.toFixed(2)}</td>
                <td className="px-3 py-2 money">${r.expectedClosingBalance.toFixed(2)}</td>
                <td className="px-3 py-2 money">${r.closingBalance.toFixed(2)}</td>
                <td className={`px-3 py-2 money ${Math.abs(r.variance) > 0.01 ? "text-red-600 font-semibold" : ""}`}>
                  ${r.variance.toFixed(2)}
                </td>
                <td className="px-3 py-2">
                  <span className={`text-xs font-medium ${r.status === "reconciled" ? "text-sage" : "text-red-600"}`}>
                    {r.status === "reconciled" ? "✓ Reconciled" : "✕ Unreconciled"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded border border-brass/30 bg-brass/5 p-4 text-sm text-brass space-y-1">
        <p className="font-medium">⚠ Important accounting notice</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>These financial statements are <strong>preliminary</strong>.</li>
          <li>They are generated solely from the uploaded bank statement data.</li>
          <li>The Balance Sheet may be incomplete — we never invent missing assets, liabilities, or equity.</li>
          <li>If the Balance Sheet does not balance, the actual difference is shown (not adjusted).</li>
          <li>This report does not substitute a review by a qualified CPA.</li>
          <li>Do not use for tax filing or financial decisions without professional verification.</li>
        </ul>
      </div>

      <div className="flex justify-between border-t border-line pt-4">
        {onBack && (
          <button onClick={onBack} className="rounded border border-line px-4 py-2 text-sm">← Back</button>
        )}
        <button onClick={() => onComplete(results)} className="rounded bg-ink px-6 py-2.5 text-sm text-white">
          Continue to Results
        </button>
      </div>
    </div>
  );
}

function groupBy<T extends Record<string, any>>(arr: T[], key: string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = item[key];
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}
