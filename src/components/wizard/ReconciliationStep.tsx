"use client";
import React from "react";

import { useState, useEffect, useMemo } from "react";
import type { Workspace, BankAccount, Transaction, Classification, ReconciliationResult } from "@/domain/types";
import { reconcileAccountPeriod } from "@/domain/reconciliation";

type Props = {
  workspace: Workspace;
  accounts: BankAccount[];
  onComplete: (results: ReconciliationResult[]) => void;
  onBack?: () => void;
  onReviewAccount?: (accountId: string) => void;
};

export default function ReconciliationStep({ workspace, accounts, onComplete, onBack, onReviewAccount }: Props) {
  const [results, setResults] = useState<ReconciliationResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingEntries, setOpeningEntries] = useState<Array<{accountName: string; accountType: string; amount: number}>>([]);
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/opening-balances?workspaceId=${workspace.id}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.length > 0) {
        setOpeningEntries(data.map((e: any) => ({
          accountName: e.accountName,
          accountType: e.accountType,
          amount: e.amount,
        })));
      }
    }
    load();
  }, [workspace.id]);

  const hasUnreconciled = results.some((r) => r.status === "unreconciled");
  const hasNoBalances = results.some((r) => r.openingBalance === 0 && r.closingBalance === 0);

  const totals = useMemo(() => {
    const assets = openingEntries.filter(e => e.accountType === "asset").reduce((s, e) => s + e.amount, 0);
    const liabilities = openingEntries.filter(e => e.accountType === "liability").reduce((s, e) => s + e.amount, 0);
    const equity = openingEntries.filter(e => e.accountType === "equity").reduce((s, e) => s + e.amount, 0);
    const diff = Math.round((assets - liabilities - equity) * 100) / 100;
    return { assets, liabilities, equity, diff, isValid: Math.abs(diff) <= 0.01 };
  }, [openingEntries]);

  function addEntry(type: string) {
    setOpeningEntries(prev => [...prev, { accountName: "", accountType: type, amount: 0 }]);
  }

  function removeEntry(index: number) {
    setOpeningEntries(prev => prev.filter((_, i) => i !== index));
  }

  function updateEntry(index: number, field: string, value: string | number) {
    setOpeningEntries(prev => prev.map((e, i) => i === index ? { ...e, [field]: value } : e));
  }

  async function handleSaveOpeningBalances() {
    setSaving(true);
    await fetch("/api/opening-balances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId: workspace.id,
        entries: openingEntries.map(e => ({
          accountName: e.accountName,
          accountType: e.accountType,
          amount: e.amount,
          source: "manual",
          supportStatus: "provided",
        })),
      }),
    });
    setSaving(false);
  }

  if (loading) return <p className="text-sm text-slate-500">Loading reconciliation data...</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Reconciliation by Account</h2>

      {hasNoBalances && (
        <div className="rounded border border-brass/30 bg-brass/5 p-4 text-sm text-brass">
          Some accounts have opening/closing balances of $0.00. Update account balances for accurate reconciliation.
        </div>
      )}

      {hasUnreconciled && (
        <div className="rounded border border-red-200 bg-red-50 p-4 space-y-1 text-sm text-red-700">
          <p className="font-medium">One or more accounts could not be reconciled</p>
          <p>These reports are preliminary and generated solely from uploaded bank statement data.</p>
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
              <th className="px-3 py-2">Action</th>
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
                    {r.status === "reconciled" ? "Reconciled" : "Unreconciled"}
                  </span>
                </td>
                <td className="px-3 py-2">
                  {r.status === "unreconciled" && onReviewAccount ? (
                    <button
                      type="button"
                      onClick={() => onReviewAccount(r.accountId)}
                      className="rounded border border-line px-2 py-1 text-xs hover:bg-paper"
                    >
                      Review transactions
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400">No action</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded border border-line p-4">
        <h3 className="mb-2 text-sm font-semibold">Opening Balance Sheet</h3>
        <p className="mb-3 text-xs text-slate-500">Enter opening balances to enable Balance Sheet mode.</p>
        {["asset", "liability", "equity"].map(type => {
          const typeEntries = openingEntries.filter(e => e.accountType === type);
          const total = type === "asset" ? totals.assets : type === "liability" ? totals.liabilities : totals.equity;
          return (
            <div key={type} className="mb-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-medium capitalize">{type}s</span>
                <span className="text-sm text-slate-600">Total: ${total.toFixed(2)}</span>
              </div>
              <div className="space-y-1">
                {typeEntries.map((entry, i) => {
                  const globalIndex = openingEntries.indexOf(entry);
                  return (
                    <div key={globalIndex} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Account name"
                        value={entry.accountName}
                        onChange={e => updateEntry(globalIndex, "accountName", e.target.value)}
                        className="w-48 rounded border border-line p-2 text-sm"
                      />
                      <input
                        type="number"
                        placeholder="Amount"
                        value={entry.amount}
                        onChange={e => updateEntry(globalIndex, "amount", parseFloat(e.target.value) || 0)}
                        className="w-28 rounded border border-line p-2 text-sm"
                      />
                      <button onClick={() => removeEntry(globalIndex)} className="text-xs text-red-500">Remove</button>
                    </div>
                  );
                })}
              </div>
              <button onClick={() => addEntry(type)} className="mt-1 text-xs text-slate-500 hover:text-ink">Add {type}</button>
            </div>
          );
        })}
        <div className="mt-3 border-t border-line pt-3">
          <div className="text-sm">
            <span>Assets: ${totals.assets.toFixed(2)}</span>
            <span className="mx-2">−</span>
            <span>Liabilities: ${totals.liabilities.toFixed(2)}</span>
            <span className="mx-2">−</span>
            <span>Equity: ${totals.equity.toFixed(2)}</span>
            <span className="mx-2">=</span>
            <span className={totals.isValid ? "text-sage font-semibold" : "text-red-600 font-semibold"}>
              ${totals.diff.toFixed(2)}
            </span>
            {totals.isValid ? (
              <span className="ml-2 text-xs text-sage">Balanced</span>
            ) : (
              <span className="ml-2 text-xs text-red-600">Does not balance</span>
            )}
          </div>
        </div>
        <button
          onClick={handleSaveOpeningBalances}
          disabled={saving}
          className="mt-3 rounded bg-ink px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Opening Balances"}
        </button>
      </div>

      <div className="rounded border border-brass/30 bg-brass/5 p-4 text-sm text-brass space-y-1">
        <p className="font-medium">Important accounting notice</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>These financial statements are <strong>preliminary</strong>.</li>
          <li>They are generated solely from the uploaded bank statement data.</li>
          <li>The Balance Sheet may be incomplete. Missing assets, liabilities, or equity are not invented.</li>
          <li>If the Balance Sheet does not balance, the actual difference is shown (not adjusted).</li>
          <li>This report does not substitute a review by a qualified CPA.</li>
          <li>Do not use for tax filing or financial decisions without professional verification.</li>
        </ul>
      </div>

      <div className="flex justify-between border-t border-line pt-4">
        {onBack && (
          <button onClick={onBack} className="rounded border border-line px-4 py-2 text-sm">Back</button>
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
