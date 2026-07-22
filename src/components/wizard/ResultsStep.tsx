"use client";
import React from "react";

import { useState, useEffect } from "react";
import type { Workspace, Company, BankAccount, Classification, ReconciliationResult, TransactionWithClassification } from "@/domain/types";
import { buildFinancialReport } from "@/domain/reporting";
import { requiresReview } from "@/domain/reviewPolicy";

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
  const [statementCount, setStatementCount] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportType, setExportType] = useState<"financial" | "withTransactions">("financial");

  useEffect(() => {
    fetch(`/api/transactions?workspaceId=${workspace.id}`)
      .then((r) => r.json())
      .then(setTransactions);
    fetch(`/api/statements?workspaceId=${workspace.id}`)
      .then((r) => r.json())
      .then((data) => setStatementCount(Array.isArray(data) ? data.length : 0))
      .catch(() => {});
  }, [workspace.id]);

  const classifications: Classification[] = transactions.map(t => t.classification).filter((c): c is Classification => c !== null);
  const reports = buildFinancialReport(company.legalName, workspace.taxYear, accounts, transactions, classifications);
  const totalImported = transactions.length;
  const pendingReview = transactions.filter((t) => requiresReview(t.classification)).length;

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
          <p className="text-2xl font-semibold">{statementCount || (totalImported > 0 ? "Imported" : "None")}</p>
        </div>
        <div className="rounded border border-line p-3">
          <p className="text-xs text-slate-500">Transactions imported</p>
          <p className="text-2xl font-semibold">{totalImported}</p>
        </div>
        <div className="rounded border border-line p-3">
          <p className="text-xs text-slate-500">Pending review</p>
          <p className={`text-2xl font-semibold ${pendingReview > 0 ? "text-brass" : "text-sage"}`}>{pendingReview}</p>
        </div>
        <div className="rounded border border-line p-3">
          <p className="text-xs text-slate-500">Report Mode</p>
          <p className="text-sm font-semibold">{reports.mode === "complete_balance_sheet" ? "Complete" : reports.mode === "preliminary_balance_sheet" ? "Preliminary" : "Bank Activity"}</p>
        </div>
        <div className="rounded border border-line p-3">
          <p className="text-xs text-slate-500">Bank Reconciliation</p>
          <p className={`text-2xl font-semibold ${reports.bankReconciliation.every(r => r.status === "reconciled") ? "text-sage" : "text-red-600"}`}>
            {reports.bankReconciliation.filter(r => r.status === "reconciled").length}/{reports.bankReconciliation.length}
          </p>
        </div>
        <div className="rounded border border-line p-3">
          <p className="text-xs text-slate-500">Classification</p>
          <p className={`text-2xl font-semibold ${reports.classificationCompleteness.classified === reports.classificationCompleteness.totalTransactions ? "text-sage" : "text-brass"}`}>
            {reports.classificationCompleteness.classified}/{reports.classificationCompleteness.totalTransactions}
          </p>
        </div>
        <div className="rounded border border-line p-3">
          <p className="text-xs text-slate-500">Documentation</p>
          <p className={`text-2xl font-semibold ${reports.classificationCompleteness.documentationComplete === reports.classificationCompleteness.totalTransactions ? "text-sage" : "text-brass"}`}>
            {reports.classificationCompleteness.documentationComplete}/{reports.classificationCompleteness.totalTransactions}
          </p>
        </div>
        <div className="rounded border border-line p-3">
          <p className="text-xs text-slate-500">Equation Check</p>
          <p className={`text-2xl font-semibold ${reports.accountingEquation.status === "passed" ? "text-sage" : "text-red-600"}`}>
            {reports.accountingEquation.status === "passed" ? "Passed" : reports.accountingEquation.status === "incomplete_data" ? "Incomplete" : "Failed"}
          </p>
        </div>
      </div>

      {reconciliation.filter(r => r.status === "reconciled").length > 0 && (
        <div className="rounded border border-sage/30 bg-sage/5 p-3 text-sm text-sage">
          {reconciliation.filter(r => r.status === "reconciled").length} account(s) reconciled
          {reconciliation.some(r => r.status === "unreconciled") && (
            <span className="text-brass">. {reconciliation.filter(r => r.status === "unreconciled").length} unreconciled</span>
          )}
        </div>
      )}

      {/* Alerts */}
      {reports.bankReconciliation.some(r => r.status === "unreconciled") && (
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-medium">Bank Reconciliation</p>
          <p>One or more bank accounts have unreconciled transactions. The balance sheet may be inaccurate.</p>
        </div>
      )}
      {reports.classificationCompleteness.classified < reports.classificationCompleteness.totalTransactions && (
        <div className="rounded border border-brass/30 bg-brass/5 p-4 text-sm text-brass">
          <p className="font-medium">Classification Incomplete</p>
          <p>{reports.classificationCompleteness.classified} of {reports.classificationCompleteness.totalTransactions} transactions classified. {reports.classificationCompleteness.totalTransactions - reports.classificationCompleteness.classified} need classification.</p>
        </div>
      )}
      {reports.classificationCompleteness.documentationPending > 0 && reports.classificationCompleteness.classified === reports.classificationCompleteness.totalTransactions && (
        <div className="rounded border border-brass/30 bg-brass/5 p-4 text-sm text-brass">
          <p className="font-medium">Documentation Pending</p>
          <p>{reports.classificationCompleteness.documentationPending} transaction(s) need supporting documents (card statements, CPA review, or support).</p>
        </div>
      )}
      {reports.accountingEquation.status !== "passed" && (
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-medium">Accounting Equation</p>
          <p>Assets do not equal liabilities plus equity. The balance sheet is out of balance by {money(Math.abs(reports.balanceSheet.balanceCheck))}.</p>
        </div>
      )}
      {reports.suspense.length > 0 && (
        <div className="rounded border border-brass/30 bg-brass/5 p-4 text-sm text-brass">
          <p className="font-medium">Suspense Items</p>
          <p>{reports.suspense.length} transaction(s) could not be fully classified and have been placed in suspense accounts.</p>
        </div>
      )}

      {/* P&L Preview */}
      <div className="rounded border border-line p-4">
        <h3 className="mb-2 text-sm font-semibold">P&amp;L Preview: {workspace.taxYear}</h3>
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
        <h3 className="mb-2 text-sm font-semibold">Preliminary Balance Sheet from Bank Activity: {workspace.taxYear}</h3>
        <p className="mb-3 text-xs text-brass">This preliminary report is based on classified bank activity and does not represent actual period-end account balances. Only imported bank movements are included.</p>
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
                {r.status === "reconciled" ? "Reconciled" : `${money(r.variance)} difference`}
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
          {exporting && exportType === "financial" ? "Generating..." : "Export Financial Statements"}
        </button>
        <button
          onClick={() => handleExport(true)}
          disabled={exporting}
          className="rounded bg-ink px-6 py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
        >
          {exporting && exportType === "withTransactions" ? "Generating..." : "Export Financial Statements + Transactions"}
        </button>
        <button onClick={onNewWorkflow} className="rounded border border-line px-4 py-3 text-sm hover:bg-paper">
          New workflow
        </button>
      </div>
    </div>
  );
}
