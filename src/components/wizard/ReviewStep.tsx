"use client";
import React from "react";

import { useState, useEffect, useCallback } from "react";
import type { ReviewAction, ReviewStatus, TransactionCorrection, TransactionWithClassification, Workspace } from "@/domain/types";
import { requiresReview } from "@/domain/reviewPolicy";
import { getCategoriesByReport, isValidCategory } from "@/domain/categoryOptions";

type Props = {
  workspace: Workspace;
  initialAccountId?: string | null;
  initialTab?: "exceptions" | "all" | "related" | "credit_cards" | "low" | "unreconciled" | null;
  onComplete: () => void;
  onBack?: () => void;
};

function CategorySelect({ currentCategory, onChange }: { currentCategory: string; onChange: (cat: string) => void }) {
  const [displayValue, setDisplayValue] = React.useState("");
  const isKnown = isValidCategory(currentCategory);

  React.useEffect(() => {
    setDisplayValue(isKnown ? currentCategory : "__unknown__");
  }, [currentCategory, isKnown]);

  return (
    <select
      className="rounded border border-line px-2 py-1 text-xs max-w-[160px]"
      value={displayValue}
      onChange={(e) => onChange(e.target.value)}
    >
      {!isKnown && currentCategory && (
        <option value="__unknown__" disabled>
          {currentCategory} (unknown. Select one)
        </option>
      )}
      <optgroup label="P&L">
        {getCategoriesByReport("P&L").map((cat) => (
          <option key={cat} value={cat}>{cat}</option>
        ))}
      </optgroup>
      <optgroup label="Balance Sheet">
        {getCategoriesByReport("Balance Sheet").map((cat) => (
          <option key={cat} value={cat}>{cat}</option>
        ))}
      </optgroup>
    </select>
  );
}

export default function ReviewStep({ workspace, initialAccountId, initialTab, onComplete, onBack }: Props) {
  const [items, setItems] = useState<TransactionWithClassification[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"exceptions" | "all" | "related" | "credit_cards" | "low" | "unreconciled">("exceptions");
  const [filter, setFilter] = useState("");
  const [accountFilter, setAccountFilter] = useState(initialAccountId ?? "");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statementFilter, setStatementFilter] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [note, setNote] = useState("");

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
    load(activeTab !== "exceptions");
    loadCounts();
  }, [load, loadCounts, activeTab]);

  useEffect(() => {
    if (initialAccountId) {
      setAccountFilter(initialAccountId);
      setActiveTab("all");
    }
  }, [initialAccountId]);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  async function handleAction(action: ReviewAction, transactionIds: string[], newCategory?: string, reviewStatus?: ReviewStatus, correction?: TransactionCorrection) {
    await fetch("/api/classifications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ transactionIds, action, newCategory, reviewStatus, note, correction }),
    });
    setSelected(new Set());
    setNote("");
    await load(activeTab !== "exceptions");
  }

  async function correctTransaction(t: TransactionWithClassification) {
    const date = window.prompt("Correct date (YYYY-MM-DD)", t.date) || undefined;
    const description = window.prompt("Correct description", t.description) || undefined;
    const amountText = window.prompt("Correct amount", String(t.amount));
    const amount = amountText === null || amountText.trim() === "" ? undefined : Number(amountText);
    await handleAction("correct_transaction", [t.id], undefined, undefined, {
      date,
      description,
      amount: Number.isFinite(amount) ? amount : undefined,
    });
  }

  async function createRuleFromTransaction(t: TransactionWithClassification) {
    if (!t.classification) return;
    await fetch("/api/classification-rules", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        companyId: workspace.companyId,
        pattern: t.description,
        finalCategory: t.classification.finalCategory,
        direction: t.amount < 0 ? "out" : t.amount > 0 ? "in" : "any",
        priority: 10,
      }),
    });
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
    if (accountFilter && t.bankAccountId !== accountFilter) return false;
    if (statementFilter && t.statementId !== statementFilter) return false;
    if (statusFilter && t.classification?.reviewStatus !== statusFilter) return false;
    if (categoryFilter && t.classification?.finalCategory !== categoryFilter) return false;
    if (minAmount && t.amount < Number(minAmount)) return false;
    if (maxAmount && t.amount > Number(maxAmount)) return false;
    if (activeTab === "related") {
      const haystack = `${t.description} ${t.classification?.finalCategory ?? ""} ${t.classification?.ruleUsed ?? ""}`.toLowerCase();
      if (!/(valoris|related party|intercompany|affiliate|due from related|due to related|member distributions)/.test(haystack)) return false;
    }
    if (activeTab === "low") {
      if (!["low", "medium"].includes(t.classification?.confidence ?? "")) return false;
    }
    if (activeTab === "credit_cards") {
      const haystack = `${t.description} ${t.classification?.finalCategory ?? ""} ${t.classification?.reviewStatus ?? ""}`.toLowerCase();
      if (!/(credit card|card statements|card payable|amex|citi|autopay)/.test(haystack)) return false;
    }
    if (activeTab === "unreconciled" && !accountFilter) return false;
    if (!filter) return true;
    const q = filter.toLowerCase();
    return t.description.toLowerCase().includes(q) || (t.classification?.finalCategory ?? "").toLowerCase().includes(q);
  });

  const itemsNeedingReview = items.filter((t) => requiresReview(t.classification));
  const pendingCount = itemsNeedingReview.length;
  const allResolved = itemsNeedingReview.length === 0;
  const accountTotals = filtered.reduce((acc, t) => {
    acc.count += 1;
    acc.total += t.amount;
    if (t.balance !== null && t.balance !== undefined) acc.lastBalance = t.balance;
    return acc;
  }, { count: 0, total: 0, lastBalance: null as number | null });
  const accountOptions = Array.from(new Map(items.map((t: any) => [t.bankAccountId, t.accountName ? `${t.accountName} (${t.bankName ?? ""} ${t.lastFour ?? ""})` : t.bankAccountId])).entries());
  const statementOptions = Array.from(new Set(items.map((t) => t.statementId)));
  const categoryOptions = Array.from(new Set(items.map((t) => t.classification?.finalCategory).filter(Boolean))) as string[];

  if (loading) return <p className="text-sm text-slate-500">Loading transactions...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Resolve Exceptions</h2>
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
          <button
            onClick={() => setActiveTab("related")}
            className={`text-sm px-3 py-1 rounded ${activeTab === "related" ? "bg-ink text-white" : "text-slate-500 hover:text-ink"}`}
          >
            Related Parties
          </button>
          <button
            onClick={() => setActiveTab("credit_cards")}
            className={`text-sm px-3 py-1 rounded ${activeTab === "credit_cards" ? "bg-ink text-white" : "text-slate-500 hover:text-ink"}`}
          >
            Credit Cards
          </button>
          <button
            onClick={() => setActiveTab("low")}
            className={`text-sm px-3 py-1 rounded ${activeTab === "low" ? "bg-ink text-white" : "text-slate-500 hover:text-ink"}`}
          >
            Low Confidence
          </button>
          <button
            onClick={() => setActiveTab("unreconciled")}
            className={`text-sm px-3 py-1 rounded ${activeTab === "unreconciled" ? "bg-ink text-white" : "text-slate-500 hover:text-ink"}`}
          >
            Unreconciled Account
          </button>
        </div>
      </div>

      {allResolved && activeTab === "exceptions" ? (
        <div className="rounded border border-sage/30 bg-sage/5 p-6 text-center">
          <p className="text-sage font-medium">No exceptions. All transactions are classified.</p>
          <p className="mt-1 text-sm text-slate-500">You can proceed to results.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <input
              className="flex-1 min-w-[200px] rounded border border-line px-3 py-2 text-sm"
              placeholder="Search description or category"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <select
              className="w-56 rounded border border-line px-3 py-2 text-sm"
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
            >
              <option value="">All accounts</option>
              {accountOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
            <select className="w-44 rounded border border-line px-3 py-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              {["pending", "approved", "excluded", "support_needed", "cpa_review", "card_statements_needed"].map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            <select className="w-52 rounded border border-line px-3 py-2 text-sm" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="">All categories</option>
              {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
            <select className="w-44 rounded border border-line px-3 py-2 text-sm" value={statementFilter} onChange={(e) => setStatementFilter(e.target.value)}>
              <option value="">All statements</option>
              {statementOptions.map((id) => <option key={id} value={id}>{id.slice(0, 8)}</option>)}
            </select>
            <input className="w-28 rounded border border-line px-3 py-2 text-sm" placeholder="Min $" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} />
            <input className="w-28 rounded border border-line px-3 py-2 text-sm" placeholder="Max $" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} />
            <input className="min-w-[220px] flex-1 rounded border border-line px-3 py-2 text-sm" placeholder="Review note" value={note} onChange={(e) => setNote(e.target.value)} />
            {accountFilter && (
              <button onClick={() => setAccountFilter("")} className="text-xs text-slate-500 underline">Clear account</button>
            )}
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
                <button onClick={() => handleAction("mark_cpa_review", Array.from(selected))} className="rounded border border-line px-3 py-1.5 text-xs">
                  CPA Review ({selected.size})
                </button>
                <button onClick={() => handleAction("mark_support_needed", Array.from(selected))} className="rounded border border-line px-3 py-1.5 text-xs">
                  Support Needed ({selected.size})
                </button>
              </>
            )}
          </div>

          {accountFilter && (
            <div className="rounded border border-line bg-paper p-3 text-sm">
              <p className="font-medium">Account Activity</p>
              <div className="mt-1 flex flex-wrap gap-4 text-xs text-slate-600">
                <span>Transactions: {accountTotals.count}</span>
                <span>Filtered movement: ${accountTotals.total.toFixed(2)}</span>
                <span>Last running balance: {accountTotals.lastBalance === null ? "Not available" : `$${accountTotals.lastBalance.toFixed(2)}`}</span>
              </div>
            </div>
          )}

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
                        <CategorySelect
                          currentCategory={c?.finalCategory ?? ""}
                          onChange={(cat) => handleAction("approve", [t.id], cat)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-xs font-medium ${
                          c?.confidence === "high" ? "text-sage" : c?.confidence === "medium" ? "text-brass" : "text-red-600"
                        }`}>
                          {c?.confidence ?? "Pending"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500 max-w-[200px] truncate" title={c?.ruleUsed ?? ""}>
                        {c?.ruleUsed ?? "Pending"}
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
                          <span className="text-xs text-slate-400">Approved</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleAction("approve", [t.id])}
                            className="rounded bg-sage/10 px-2 py-1 text-xs text-sage"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleAction("exclude", [t.id])}
                            className="rounded border border-line px-2 py-1 text-xs text-slate-500"
                          >
                            Exclude
                          </button>
                          <button
                            onClick={() => handleAction("mark_cpa_review", [t.id])}
                            className="rounded border border-line px-2 py-1 text-xs text-brass"
                          >
                            CPA
                          </button>
                          <button
                            onClick={() => handleAction("mark_support_needed", [t.id])}
                            className="rounded border border-line px-2 py-1 text-xs text-slate-500"
                          >
                            Support
                          </button>
                          <button
                            onClick={() => createRuleFromTransaction(t)}
                            className="rounded border border-line px-2 py-1 text-xs text-slate-500"
                          >
                            Save rule
                          </button>
                          <button
                            onClick={() => correctTransaction(t)}
                            className="rounded border border-line px-2 py-1 text-xs text-slate-500"
                          >
                            Correct
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
          <button onClick={onBack} className="rounded border border-line px-4 py-2 text-sm">Back</button>
        )}
        <button onClick={onComplete} className="rounded bg-ink px-6 py-2.5 text-sm text-white">
          Continue to Reconciliation
        </button>
      </div>
    </div>
  );
}
