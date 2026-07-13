"use client";

import React from "react";
import { useMemo, useState } from "react";
import { classifyTransaction } from "../domain/classification";
import { buildCpaPackageStatus } from "../domain/cpaPackage";
import { VALORIS_DOCUMENT_CHECKLIST } from "../domain/chartOfAccounts";
import { normalizeCsvRows } from "../domain/importCsv";
import { reconcileAccountPeriod } from "../domain/reconciliation";
import { buildReports } from "../domain/reporting";
import type { ChecklistStatus, ClassifiedTransaction, CpaPackage, DocumentChecklistItem } from "../domain/types";

const sampleCsv = `Date,Description,Amount,Balance
01/05/2025,Rental income January,12000,12000
01/08/2025,BANK FEE,-35,11965
01/12/2025,CAPITAL CONTRIBUTION OWNER,50000,61965
01/15/2025,AUTOPAY AMEX PAYMENT,-2400,59565
01/20/2025,Transfer to Valoris related entity,-5000,54565
01/25/2025,CPA legal accounting,-900,53665`;

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function updateChecklistItem(
  items: DocumentChecklistItem[],
  index: number,
  patch: Partial<DocumentChecklistItem>
): DocumentChecklistItem[] {
  return items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item));
}

async function download(path: string, payload: unknown, filename: string) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`Export failed: ${response.status}`);
  const blob = await response.blob();
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(href);
}

export default function Page() {
  const [llcName, setLlcName] = useState("Valoris Demo LLC");
  const [taxYear, setTaxYear] = useState(2025);
  const [sourceAccount, setSourceAccount] = useState("Chase Operating");
  const [csv, setCsv] = useState(sampleCsv);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [closingBalance, setClosingBalance] = useState(53665);
  const [reviewerApproved, setReviewerApproved] = useState(false);
  const [balanceCheckExplanation, setBalanceCheckExplanation] = useState("");
  const [checklist, setChecklist] = useState<DocumentChecklistItem[]>(
    VALORIS_DOCUMENT_CHECKLIST.map((item) =>
      item.folder === "04 Bank Statements" || item.folder === "06 Financial Statements"
        ? { ...item, status: "Uploaded" }
        : { ...item }
    )
  );
  const [transactions, setTransactions] = useState<ClassifiedTransaction[]>(() =>
    normalizeCsvRows(sampleCsv, "Chase Operating", "sample.csv").map((transaction) => ({
      ...transaction,
      ...classifyTransaction(transaction)
    }))
  );

  const reports = useMemo(() => buildReports(llcName, taxYear, transactions), [llcName, taxYear, transactions]);
  const reconciliation = useMemo(
    () => reconcileAccountPeriod(openingBalance, closingBalance, transactions),
    [openingBalance, closingBalance, transactions]
  );
  const pkg: CpaPackage = {
    llcName,
    taxYear,
    checklist,
    reviewerApproved,
    balanceCheckExplanation,
    balanceCheck: reports.balanceSheet.balanceCheck
  };
  const status = buildCpaPackageStatus(pkg);

  const importCsv = () => {
    const rows = normalizeCsvRows(csv, sourceAccount, "manual-import.csv").map((transaction) => ({
      ...transaction,
      ...classifyTransaction(transaction)
    }));
    setTransactions(rows);
  };

  return (
    <main className="min-h-screen bg-paper text-ink">
      <section className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-wide text-sage">Valoris Capital Partners</p>
            <h1 className="mt-1 text-3xl font-semibold">Annual CPA Package</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="grid gap-1 text-sm">
              LLC
              <input className="w-64 rounded border border-line px-3 py-2" value={llcName} onChange={(event) => setLlcName(event.target.value)} />
            </label>
            <label className="grid gap-1 text-sm">
              Tax year
              <input
                className="w-28 rounded border border-line px-3 py-2"
                type="number"
                value={taxYear}
                onChange={(event) => setTaxYear(Number(event.target.value))}
              />
            </label>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-5 px-6 py-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded border border-line bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Document Checklist</h2>
            <span className="text-sm text-brass">Target: February 15</span>
          </div>
          <div className="grid gap-2">
            {checklist.map((item, index) => (
              <div key={item.folder} className="grid gap-2 rounded border border-line p-3 md:grid-cols-[1.2fr_0.8fr_1.2fr]">
                <div>
                  <p className="font-medium">{item.folder}</p>
                  <p className="text-sm text-slate-600">{item.label}</p>
                </div>
                <select
                  className="rounded border border-line px-2 py-2"
                  value={item.status}
                  onChange={(event) =>
                    setChecklist(updateChecklistItem(checklist, index, { status: event.target.value as ChecklistStatus }))
                  }
                >
                  {["Missing", "Uploaded", "Reviewed", "Not applicable", "Listed in CPA memo"].map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
                <input
                  className="rounded border border-line px-3 py-2"
                  placeholder="Memo note if missing"
                  value={item.memoNote}
                  onChange={(event) => setChecklist(updateChecklistItem(checklist, index, { memoNote: event.target.value }))}
                />
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-5">
          <div className="rounded border border-line bg-white p-4">
            <h2 className="mb-3 text-lg font-semibold">Import Statement Activity</h2>
            <label className="mb-3 grid gap-1 text-sm">
              Source account
              <input className="rounded border border-line px-3 py-2" value={sourceAccount} onChange={(event) => setSourceAccount(event.target.value)} />
            </label>
            <textarea
              className="h-52 w-full rounded border border-line p-3 font-mono text-sm"
              value={csv}
              onChange={(event) => setCsv(event.target.value)}
            />
            <button className="mt-3 rounded bg-ink px-4 py-2 text-white" onClick={importCsv}>
              Import and classify CSV
            </button>
          </div>

          <div className="rounded border border-line bg-white p-4">
            <h2 className="mb-3 text-lg font-semibold">Reconciliation</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-sm">
                Opening balance
                <input className="rounded border border-line px-3 py-2" type="number" value={openingBalance} onChange={(event) => setOpeningBalance(Number(event.target.value))} />
              </label>
              <label className="grid gap-1 text-sm">
                Closing balance
                <input className="rounded border border-line px-3 py-2" type="number" value={closingBalance} onChange={(event) => setClosingBalance(Number(event.target.value))} />
              </label>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-slate-600">Movement</dt><dd className="money font-semibold">{money(reconciliation.movementTotal)}</dd></div>
              <div><dt className="text-slate-600">Variance</dt><dd className="money font-semibold">{money(reconciliation.variance)}</dd></div>
              <div><dt className="text-slate-600">Status</dt><dd className="font-semibold capitalize">{reconciliation.status}</dd></div>
              <div><dt className="text-slate-600">Balance Check</dt><dd className="money font-semibold">{money(reports.balanceSheet.balanceCheck)}</dd></div>
            </dl>
          </div>

          <div className="rounded border border-line bg-white p-4">
            <h2 className="mb-3 text-lg font-semibold">Package Blockers</h2>
            <label className="mb-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={reviewerApproved} onChange={(event) => setReviewerApproved(event.target.checked)} />
              Reviewer approved the package
            </label>
            <textarea
              className="mb-3 h-20 w-full rounded border border-line p-3 text-sm"
              placeholder="Explain non-zero Balance Check if needed"
              value={balanceCheckExplanation}
              onChange={(event) => setBalanceCheckExplanation(event.target.value)}
            />
            {status.blockers.length ? (
              <ul className="list-inside list-disc text-sm text-red-700">
                {status.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
              </ul>
            ) : (
              <p className="text-sm font-medium text-sage">Package completion gate is clear.</p>
            )}
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                className="rounded bg-sage px-4 py-2 text-white"
                onClick={() => download("/api/export/workbook", { entityName: llcName, taxYear, transactions }, `${llcName.replace(/\s+/g, "_")}_${taxYear}_PnL_BS_Detail.xlsx`)}
              >
                Export workbook
              </button>
              <button
                className="rounded bg-brass px-4 py-2 text-white"
                onClick={() => download("/api/export/memo", { pkg, transactions }, `${llcName.replace(/\s+/g, "_")}_${taxYear}_CPA_Memo.docx`)}
              >
                Export CPA memo
              </button>
            </div>
          </div>
        </section>
      </div>

      <section className="mx-auto max-w-7xl px-6 pb-8">
        <div className="rounded border border-line bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Transaction Review</h2>
            <div className="text-sm text-slate-600">Net income: <span className="money font-semibold">{money(reports.pnl.netIncome)}</span></div>
          </div>
          <div className="overflow-auto">
            <table className="w-full min-w-[980px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  {["Date", "Description", "Amount", "Final Category", "Statement", "P&L Line", "BS Line", "Review Status"].map((header) => (
                    <th className="px-3 py-2" key={header}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.map((row) => (
                  <tr key={row.id} className="border-b border-line">
                    <td className="px-3 py-2">{row.date}</td>
                    <td className="px-3 py-2">{row.description}</td>
                    <td className="money px-3 py-2">{money(row.amount)}</td>
                    <td className="px-3 py-2">{row.finalCategory}</td>
                    <td className="px-3 py-2">{row.statement}</td>
                    <td className="px-3 py-2">{row.pnlLine}</td>
                    <td className="px-3 py-2">{row.bsLine}</td>
                    <td className="px-3 py-2">{row.reviewStatus || "Clear"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
