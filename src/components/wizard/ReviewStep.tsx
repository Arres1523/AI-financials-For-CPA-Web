"use client";
import React from "react";

import { useState, useEffect, useCallback } from "react";
import type { TransactionWithClassification, Workspace } from "@/domain/types";
import { requiresReview } from "@/domain/reviewPolicy";

const CATEGORIES_BY_REPORT: Record<string, string[]> = {
  "P&L": ["Rental Income", "Other Income", "Repairs & Maintenance", "Utilities", "Insurance", "Property Taxes", "Legal & Accounting", "Management Fees", "Bank Fees", "Interest Expense", "Rent Expense", "Other Expense"],
  "Balance Sheet": ["Cash", "Credit Card Liability", "Loan Liability", "Owner Contributions", "Owner Distributions", "Due To Related Parties", "Due From Related Parties", "Transfer Clearing", "Capital Improvements"],
};

type Props = {
  workspace: Workspace;
  onComplete: () => void;
  onBack?: () => void;
};

export default function ReviewStep({ workspace, onComplete, onBack }: Props) {
  const [items, setItems] = useState<TransactionWithClassification[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"exceptions" | "all">("exceptions");
  const [filter, setFilter] = useState("");

  const loadCounts = useCallback(async () => {
    const res = await fetch(`/api/transactions?workspaceId=${workspace.id}`);
    if (res.ok) {
      const all = await res.json();
      setTotalCount(all.length);
    }
  }, [workspace.id]);

  const load = useCallback(async (all?: boolean) => {
    setLoading(true);
    const url = `/api/transactions?workspaceId=${workspace.id}${all ? "" : "&needsReview=true"}`;
    const res = await fetch(url);
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }, [workspace.id]);

  useEffect(() => {
    load(activeTab === "all");
    loadCounts();
  }, [load, loadCounts, activeTab]);

  async function handleAction(action: "approve" | "exclude", transactionIds: string[], newCategory?: string) {
    await fetch("/api/classifications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ transactionIds, action, newCategory }),
    });
    setSelected(new Set());
    await load();
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    const allIds = filtered.map((t) => t.id);
    setSelected(new Set(allIds));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  const filtered = items.filter((t) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return t.description.toLowerCase().includes(q) || (t.classification?.finalCategory ?? "").toLowerCase().includes(q);
  });

  const itemsNeedingReview = items.filter((t) => requiresReview(t.classification));
  const pendingCount = itemsNeedingReview.length;
  const allResolved = itemsNeedingReview.length === 0;

  if (loading) return <p className="text-sm text-slate-500">Loading transactions…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Review Exceptions</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("exceptions")}
            className={`text-sm px-3 py-1 rounded ${activeTab === "exceptions" ? "bg-ink text-white" : "text-slate-500 hover:text-ink"}`}
          >
            Exceptions {pendingCount > 0 ? `(${pendingCount})` : ""}
          </button>
          <button
            onClick={() => setActiveTab("all")}
            className={`text-sm px-3 py-1 rounded ${activeTab === "all" ? "bg-ink text-white" : "text-slate-500 hover:text-ink"}`}
          >
            All Transactions ({totalCount})
          </button>
        </div>
      </div>

      {allResolved ? (
        <div className="rounded border border-sage/30 bg-sage/5 p-6 text-center">
          <p className="text-sage font-medium">No exceptions — all transactions are classified.</p>
          <p className="mt-1 text-sm text-slate-500">You can proceed to results.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <input
              className="flex-1 min-w-[200px] rounded border border-line px-3 py-2 text-sm"
              placeholder="Search description or category…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <button onClick={selectAll} className="text-xs text-sage underline">Select all</button>
            <button onClick={clearSelection} className="text-xs text-slate-500 underline">Clear</button>
            {selected.size > 0 && (
              <>
                <button
                  onClick={() => handleAction("approve", Array.from(selected))}
                  className="rounded bg-sage px-3 py-1.5 text-xs text-white"
                >
                  Approve ({selected.size})
                </button>
                <button
                  onClick={() => handleAction("exclude", Array.from(selected))}
                  className="rounded border border-line px-3 py-1.5 text-xs"
                >
                  Exclude ({selected.size})
                </button>
              </>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="w-8 px-2 py-2"></th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2">Confidence</th>
                  <th className="px-3 py-2">Rule</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const c = t.classification;
                  const isLowConfidence = c?.confidence === "low" || c?.confidence === "medium";
                  return (
                    <tr key={t.id} className={`border-b border-line ${isLowConfidence ? "bg-brass/5" : ""}`}>
                      <td className="px-2 py-2">
                        <input
                          type="checkbox"
                          checked={selected.has(t.id)}
                          onChange={() => toggleSelect(t.id)}
                        />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{t.date}</td>
                      <td className="px-3 py-2 max-w-[280px] truncate" title={t.description}>{t.description}</td>
                      <td className={`px-3 py-2 money ${t.amount < 0 ? "text-red-600" : "text-sage"}`}>${t.amount.toFixed(2)}</td>
                      <td className="px-3 py-2">
                        <select
                          className="rounded border border-line px-2 py-1 text-xs max-w-[160px]"
                          value={c?.finalCategory ?? ""}
                          onChange={(e) => handleAction("approve", [t.id], e.target.value)}
                        >
                          <optgroup label="P&L">
                            {CATEGORIES_BY_REPORT["P&L"].map((cat) => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </optgroup>
                          <optgroup label="Balance Sheet">
                            {CATEGORIES_BY_REPORT["Balance Sheet"].map((cat) => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </optgroup>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-xs font-medium ${
                          c?.confidence === "high" ? "text-sage" : c?.confidence === "medium" ? "text-brass" : "text-red-600"
                        }`}>
                          {c?.confidence ?? "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500 max-w-[200px] truncate" title={c?.ruleUsed ?? ""}>
                        {c?.ruleUsed ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        {c?.reviewStatus && c.reviewStatus !== "approved" && c.reviewStatus !== "excluded" ? (
                          <span className="text-xs font-medium text-brass">
                            {c.reviewStatus === "card_statements_needed" ? "Card statements needed" :
                             c.reviewStatus === "cpa_review" ? "CPA review required" :
                             c.reviewStatus === "support_needed" ? "Support needed" :
                             "Pending"}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleAction("approve", [t.id])}
                            className="rounded bg-sage/10 px-2 py-1 text-xs text-sage"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => handleAction("exclude", [t.id])}
                            className="rounded border border-line px-2 py-1 text-xs text-slate-500"
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filtered.length === 0 && <p className="py-6 text-center text-sm text-slate-400">No transactions match your filter</p>}
        </>
      )}

      <div className="flex justify-between border-t border-line pt-4">
        {onBack && (
          <button onClick={onBack} className="rounded border border-line px-4 py-2 text-sm">← Back</button>
        )}
        <button onClick={onComplete} className="rounded bg-ink px-6 py-2.5 text-sm text-white">
          Continue to Reconciliation
        </button>
      </div>
    </div>
  );
}
