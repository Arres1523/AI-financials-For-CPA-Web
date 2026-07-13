"use client";
import React from "react";

import { useState, useEffect } from "react";
import type { Workspace, Company, BankAccount, ReconciliationResult, TransactionWithClassification } from "@/domain/types";
import { buildReports } from "@/domain/reporting";

type Props = {
  workspace: Workspace;
  company: Company;
  accounts: BankAccount[];
  reconciliation: ReconciliationResult[];
  onNewWorkflow: () => void;
};

function money(val: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);
}

export default function ResultsStep({ workspace, company, accounts, reconciliation, onNewWorkflow }: Props) {
  const [transactions, setTransactions] = useState<TransactionWithClassification[]>([]);
  const [exporting, setExporting] = useState(false);
  const [exportType, setExportType] = useState<"financial" | "withTransactions">("financial");

  useEffect(() => {
    fetch(`/api/transactions?workspaceId=${workspace.id}`)
      .then((r) => r.json())
      .then(setTransactions);
  }, [workspace.id]);

  const reports = buildReports(company.legalName, workspace.taxYear, transactions);
  const hasWarnings = Math.abs(reports.balanceSheet.balanceCheck) > 0.01 ||
    transactions.some((t) => t.classification?.reviewStatus === "pending") ||
    reconciliation.some((r) => r.status === "unreconciled");

  const totalImported = transactions.length;
  const pendingReview = transactions.filter((t) => t.classification?.reviewStatus === "pending").length;

  async function handleExport(withTransactions: boolean) {
    setExportType(withTransactions ? "withTransactions" : "financial");
    setExporting(true);
    try {
      const res = await fetch("/api/export/workbook", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceId: workspace.id,
          companyName: company.legalName,
          taxYear: workspace.taxYear,
          includeTransactions: withTransactions,
        }),
      });
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const suffix = withTransactions ? "_with_transactions" : "";
      a.download = `${company.legalName.replace(/\s+/g, "_")}_${workspace.taxYear}_Financial_Statements${suffix}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Export failed");
    }
    setExporting(false);
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Results & Export</h2>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded border border-line p-3">
          <p className="text-xs text-slate-500">Statements imported</p>
          <p className="text-2xl font-semibold">{totalImported > 0 ? "✓" : "—"}</p>
        </div>
        <div className="rounded border border-line p-3">
          <p className="text-xs text-slate-500">Total transactions</p>
          <p className="text-2xl font-semibold">{totalImported}</p>
        </div>
        <div className="rounded border border-line p-3">
          <p className="text-xs text-slate-500">Pending review</p>
          <p className={`text-2xl font-semibold ${pendingReview > 0 ? "text-brass" : "text-sage"}`}>{pendingReview}</p>
        </div>
        <div className="rounded border border-line p-3">
          <p className="text-xs text-slate-500">Balance Check</p>
          <p className={`text-2xl font-semibold ${Math.abs(reports.balanceSheet.balanceCheck) > 0.01 ? "text-red-600" : "text-sage"}`}>
            {money(reports.balanceSheet.balanceCheck)}
          </p>
        </div>
      </div>

      {/* Alerts */}
      {hasWarnings && (
        <div className="rounded border border-brass/30 bg-brass/5 p-4 text-sm text-brass space-y-1">
          <p className="font-medium">⚠ Preliminary reports alert</p>
          <ul className="list-disc list-inside">
            <li>These financial statements are <strong>preliminary</strong>.</li>
            <li>Generated solely from the uploaded bank statement data.</li>
            <li>The Balance Sheet may be incomplete.</li>
            <li>We never invent or adjust figures to make it balance.</li>
            <li>This does not substitute a professional CPA review.</li>
          </ul>
        </div>
      )}

      {/* P&L Preview */}
      <div className="rounded border border-line p-4">
        <h3 className="mb-2 text-sm font-semibold">P&amp;L Preview — {workspace.taxYear}</h3>
        <div className="grid grid-cols-[1fr_auto] gap-x-8 gap-y-1 text-sm">
          <span className="font-medium text-slate-600">Income</span>
          <span className="text-right">{money(Object.values(reports.pnl.income).reduce((s: number, v: number) => s + v, 0))}</span>
          {Object.entries(reports.pnl.income).map(([line, val]) => (
            <span key={line} className="col-span-2 flex justify-between text-xs text-slate-500 pl-4">
              <span>{line}</span><span>{money(val as number)}</span>
            </span>
          ))}
          <span className="font-medium text-slate-600">Expenses</span>
          <span className="text-right">({money(Object.values(reports.pnl.expenses).reduce((s: number, v: number) => s + v, 0))})</span>
          {Object.entries(reports.pnl.expenses).map(([line, val]) => (
            <span key={line} className="col-span-2 flex justify-between text-xs text-slate-500 pl-4">
              <span>{line}</span><span>({money(val as number)})</span>
            </span>
          ))}
          <span className="border-t border-line pt-1 font-bold">Net Income</span>
          <span className="border-t border-line pt-1 text-right font-bold">{money(reports.pnl.netIncome)}</span>
        </div>
      </div>

      {/* BS Preview */}
      <div className="rounded border border-line p-4">
        <h3 className="mb-2 text-sm font-semibold">Balance Sheet Preview — {workspace.taxYear}</h3>
        <div className="grid grid-cols-[1fr_auto] gap-x-8 gap-y-1 text-sm">
          <span className="col-span-2 mt-1 font-medium capitalize text-slate-600">Assets</span>
          <span className="col-span-2 mt-1 font-medium capitalize text-slate-600">Liabilities</span>
          <span className="col-span-2 mt-1 font-medium capitalize text-slate-600">Equity</span>
          {Object.entries(reports.balanceSheet.assets).map(([line, val]) => (
            <span key={line} className="col-span-2 flex justify-between text-xs text-slate-500 pl-4">
              <span>{line}</span><span>{money(val as number)}</span>
            </span>
          ))}
          {Object.entries(reports.balanceSheet.liabilities).map(([line, val]) => (
            <span key={line} className="col-span-2 flex justify-between text-xs text-slate-500 pl-4">
              <span>{line}</span><span>{money(val as number)}</span>
            </span>
          ))}
          {Object.entries(reports.balanceSheet.equity).map(([line, val]) => (
            <span key={line} className="col-span-2 flex justify-between text-xs text-slate-500 pl-4">
              <span>{line}</span><span>{money(val as number)}</span>
            </span>
          ))}
          <span className="border-t border-line pt-1 font-bold">Balance Check</span>
          <span className={`border-t border-line pt-1 text-right font-bold ${Math.abs(reports.balanceSheet.balanceCheck) > 0.01 ? "text-red-600" : "text-sage"}`}>
            {money(reports.balanceSheet.balanceCheck)}
          </span>
        </div>
      </div>

      {/* Reconciliations */}
      <div className="rounded border border-line p-4">
        <h3 className="mb-2 text-sm font-semibold">Reconciliation Status</h3>
        <div className="space-y-1 text-sm">
          {reconciliation.map((r) => (
            <div key={r.accountId} className="flex justify-between">
              <span>{r.accountName}</span>
              <span className={r.status === "reconciled" ? "text-sage" : "text-red-600"}>
                {r.status === "reconciled" ? "✓ Reconciled" : `✕ ${money(r.variance)} difference`}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Export buttons */}
      <div className="flex flex-wrap gap-4 border-t border-line pt-4">
        <button
          onClick={() => handleExport(false)}
          disabled={exporting}
          className="rounded bg-sage px-6 py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
        >
          {exporting && exportType === "financial" ? "Generating…" : "Export Financial Statements"}
        </button>
        <button
          onClick={() => handleExport(true)}
          disabled={exporting}
          className="rounded bg-ink px-6 py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
        >
          {exporting && exportType === "withTransactions" ? "Generating…" : "Export Financial Statements + Transactions"}
        </button>
        <button onClick={onNewWorkflow} className="rounded border border-line px-4 py-3 text-sm hover:bg-paper">
          + New workflow
        </button>
      </div>
    </div>
  );
}
