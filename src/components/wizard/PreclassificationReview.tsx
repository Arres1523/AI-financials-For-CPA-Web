"use client";
import React, { useMemo, useState } from "react";
import type { PreclassifiedImportRow, PreclassificationOverride, PreclassificationSummary } from "@/domain/types";
import { getCategoriesByReport, isValidCategory } from "@/domain/categoryOptions";

type Props = {
  fileName: string;
  rows: PreclassifiedImportRow[];
  errors: { row: number; message: string }[];
  summary: PreclassificationSummary;
  duplicateStatement?: boolean;
  confirming: boolean;
  onBack: () => void;
  onConfirm: (overrides: PreclassificationOverride[]) => void;
};

function CategorySelect({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const isKnown = isValidCategory(value);
  return (
    <select
      className="max-w-[190px] rounded border border-line px-2 py-1 text-xs disabled:bg-slate-100 disabled:text-slate-400"
      value={isKnown ? value : "__unknown__"}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      {!isKnown && value && <option value="__unknown__" disabled>{value}</option>}
      <optgroup label="P&L">
        {getCategoriesByReport("P&L").map((cat) => <option key={cat} value={cat}>{cat}</option>)}
      </optgroup>
      <optgroup label="Balance Sheet">
        {getCategoriesByReport("Balance Sheet").map((cat) => <option key={cat} value={cat}>{cat}</option>)}
      </optgroup>
    </select>
  );
}

function statusLabel(status: string) {
  if (status === "approved") return "Approved";
  if (status === "excluded") return "Excluded";
  if (status === "card_statements_needed") return "Card statements";
  if (status === "support_needed") return "Support needed";
  if (status === "cpa_review") return "CPA review";
  return "Pending";
}

export default function PreclassificationReview({
  fileName,
  rows,
  errors,
  summary,
  duplicateStatement,
  confirming,
  onBack,
  onConfirm,
}: Props) {
  const [filter, setFilter] = useState("");
  const [overrides, setOverrides] = useState<Record<number, PreclassificationOverride>>({});

  function updateOverride(rowIndex: number, patch: Partial<PreclassificationOverride>) {
    setOverrides((prev) => {
      const next = { ...prev };
      const merged = { ...(next[rowIndex] ?? {}), ...patch, rowIndex };
      if (!merged.finalCategory && !merged.reviewStatus && !merged.excluded) delete next[rowIndex];
      else next[rowIndex] = merged;
      return next;
    });
  }

  const filteredRows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const c = row.proposedClassification;
      return row.description.toLowerCase().includes(q)
        || (row.classificationText ?? "").toLowerCase().includes(q)
        || c.finalCategory.toLowerCase().includes(q)
        || (row.globalSuggestion?.category ?? "").toLowerCase().includes(q);
    });
  }, [filter, rows]);

  const overrideList = Object.values(overrides);
  const excludedCount = overrideList.filter((item) => item.excluded).length;

  function buildConfirmOverrides(): PreclassificationOverride[] {
    const merged = new Map<number, PreclassificationOverride>();
    for (const row of rows) {
      if (row.proposedClassification.ruleUsed?.startsWith("Global classifier")) {
        merged.set(row.rowIndex, {
          rowIndex: row.rowIndex,
          finalCategory: row.proposedClassification.finalCategory,
          reviewStatus: row.proposedClassification.reviewStatus,
        });
      }
    }
    for (const override of overrideList) {
      merged.set(override.rowIndex, override);
    }
    return Array.from(merged.values());
  }

  return (
    <div className="space-y-4 rounded border border-line bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Review proposed classifications</h3>
          <p className="mt-1 text-sm text-slate-600">{fileName}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <div className="rounded border border-line px-3 py-2">
            <p className="money font-semibold">{summary.validRows}</p>
            <p className="text-xs text-slate-500">Valid rows</p>
          </div>
          <div className="rounded border border-line px-3 py-2">
            <p className="money font-semibold text-sage">{summary.highConfidence}</p>
            <p className="text-xs text-slate-500">High confidence</p>
          </div>
          <div className="rounded border border-line px-3 py-2">
            <p className="money font-semibold text-brass">{summary.needsReview}</p>
            <p className="text-xs text-slate-500">Needs review</p>
          </div>
          <div className="rounded border border-line px-3 py-2">
            <p className="money font-semibold">{excludedCount}</p>
            <p className="text-xs text-slate-500">Excluded</p>
          </div>
        </div>
      </div>

      {duplicateStatement && (
        <div className="rounded border border-brass/30 bg-brass/10 p-3 text-sm text-brass" role="alert">
          This statement appears to have been imported before. Confirm only if you intend to import it again.
        </div>
      )}

      {errors.length > 0 && (
        <div className="rounded border border-brass/30 bg-brass/10 p-3 text-sm text-brass">
          {errors.slice(0, 4).map((err, index) => (
            <p key={`${err.row}-${index}`}>Row {err.row}: {err.message}</p>
          ))}
          {errors.length > 4 && <p>{errors.length - 4} more warning{errors.length - 4 === 1 ? "" : "s"}</p>}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input
          className="min-w-[220px] flex-1 rounded border border-line px-3 py-2 text-sm"
          placeholder="Search description, category, or global signal"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button
          type="button"
          className="rounded border border-line px-3 py-2 text-sm hover:bg-paper"
          onClick={() => setOverrides({})}
          disabled={overrideList.length === 0}
        >
          Clear changes
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="px-2 py-2">Exclude</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2">Amount</th>
              <th className="px-3 py-2">Proposed category</th>
              <th className="px-3 py-2">Confidence</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Rule</th>
              <th className="px-3 py-2">Global signal</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => {
              const c = row.proposedClassification;
              const override = overrides[row.rowIndex];
              const excluded = !!override?.excluded;
              const category = override?.finalCategory ?? c.finalCategory;
              return (
                <tr key={row.rowIndex} className={`border-b border-line ${excluded ? "bg-slate-50 text-slate-400" : c.reviewStatus === "approved" ? "" : "bg-brass/5"}`}>
                  <td className="px-2 py-2">
                    <input
                      type="checkbox"
                      checked={excluded}
                      onChange={(e) => updateOverride(row.rowIndex, { excluded: e.target.checked })}
                    />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">{row.date}</td>
                  <td className="max-w-[260px] truncate px-3 py-2" title={row.classificationText || row.description}>
                    {row.description}
                  </td>
                  <td className={`money px-3 py-2 ${row.amount < 0 ? "text-red-600" : "text-sage"}`}>
                    ${row.amount.toFixed(2)}
                  </td>
                  <td className="px-3 py-2">
                    <CategorySelect
                      value={category}
                      disabled={excluded}
                      onChange={(finalCategory) => updateOverride(row.rowIndex, { finalCategory, excluded: false })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <span className={c.confidence === "high" ? "text-sage" : c.confidence === "medium" ? "text-brass" : "text-red-600"}>
                      {c.confidence}
                    </span>
                  </td>
                  <td className="px-3 py-2">{excluded ? "Excluded" : statusLabel(c.reviewStatus)}</td>
                  <td className="max-w-[180px] truncate px-3 py-2 text-xs text-slate-500" title={c.ruleUsed ?? ""}>
                    {c.ruleUsed ?? "No rule"}
                  </td>
                  <td className="max-w-[170px] truncate px-3 py-2 text-xs text-slate-500" title={row.globalSuggestion?.category ?? ""}>
                    {row.globalSuggestion ? `${row.globalSuggestion.category} (${Math.round(row.globalSuggestion.confidence * 100)}%)` : "Not configured"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filteredRows.length === 0 && (
        <p className="py-6 text-center text-sm text-slate-500">No transactions match your filter.</p>
      )}

      <div className="flex flex-wrap justify-between gap-3 border-t border-line pt-4">
        <button type="button" onClick={onBack} className="rounded border border-line px-4 py-2 text-sm hover:bg-paper">
          Back to mapping
        </button>
        <button
          type="button"
          onClick={() => onConfirm(buildConfirmOverrides())}
          disabled={confirming || rows.length === 0}
          className="rounded bg-ink px-6 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
        >
          {confirming ? "Importing reviewed transactions..." : `Import reviewed transactions (${rows.length})`}
        </button>
      </div>
    </div>
  );
}
