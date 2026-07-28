import ExcelJS from "exceljs";
import type { Classification, FinancialReport, Transaction } from "../domain/types";
import { reconcileAccountPeriod } from "../domain/reconciliation";
import { getClassificationStatus, getDocumentationStatus } from "../domain/classificationStatus";

const fmt = "$#,##0.00;($#,##0.00);-";

const REVIEW_NOTES: Record<string, string> = {
  pending: "Pending review",
  approved: "Approved",
  excluded: "Excluded from report",
  support_needed: "Supporting documentation needed",
  cpa_review: "Requires CPA review",
  card_statements_needed: "Card statements needed",
};

const MODE_LABELS: Record<string, string> = {
  "classified_bank_activity": "Classified Bank Activity",
  "preliminary_balance_sheet": "Preliminary Balance Sheet",
  "complete_balance_sheet": "Complete Balance Sheet",
};

function bold(cell: ExcelJS.Cell) {
  cell.font = { bold: true, size: 11 };
}

function headerRow(cell: ExcelJS.Cell, text: string) {
  cell.value = text;
  cell.font = { bold: true, size: 12 };
}

export type WorkbookExportInput = {
  companyName: string;
  taxYear: number;
  transactions: Transaction[];
  classifications: Classification[];
  reports: FinancialReport;
  flaggedTransactions: Transaction[];
  accountReconData: { id: string; account_name: string; opening_balance: number; closing_balance: number; movement_total: number }[];
  statementFiles?: { fileName: string; fileType?: string | null; sourceName?: string | null; importedRows: number; uploadedAt: string }[];
  includeTransactions: boolean;
};

export async function buildWorkbookBuffer(input: WorkbookExportInput): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "AI Financials for CPA Web";
  workbook.created = new Date();
  const genDate = new Date().toISOString().slice(0, 10);

  // ─── Report Status Sheet ───────────────────────────────────
  const statusSheet = workbook.addWorksheet("Report Status");
  statusSheet.getColumn(1).width = 30;
  statusSheet.getColumn(2).width = 16;
  statusSheet.getColumn(3).width = 16;
  statusSheet.getColumn(4).width = 20;
  statusSheet.getColumn(5).width = 30;

  headerRow(statusSheet.getCell("A1"), "Report Status");
  statusSheet.mergeCells("A1:E1");

  statusSheet.addRow(["Mode", MODE_LABELS[input.reports.mode] ?? input.reports.mode]);
  statusSheet.addRow([]);

  statusSheet.addRow(["Check", "Actual", "Expected", "Difference", "Status"]);
  const rHdr = statusSheet.rowCount;
  for (let c = 1; c <= 5; c++) bold(statusSheet.getCell(rHdr, c));

  const reconciledCount = input.reports.bankReconciliation.filter(r => r.status === "reconciled").length;
  const totalAccounts = input.reports.bankReconciliation.length;
  statusSheet.addRow(["Bank Reconciliation", `${reconciledCount}/${totalAccounts}`, "All reconciled", "", reconciledCount === totalAccounts ? "✓" : "✕"]);

  statusSheet.addRow(["Classification", `${input.reports.classificationCompleteness.classified}/${input.reports.classificationCompleteness.totalTransactions} classified`, "All classified", `${input.reports.classificationCompleteness.totalTransactions - input.reports.classificationCompleteness.classified} needs classification`, input.reports.classificationCompleteness.classified === input.reports.classificationCompleteness.totalTransactions ? "✓" : "✕"]);

  statusSheet.addRow(["Documentation", `${input.reports.classificationCompleteness.documentationComplete}/${input.reports.classificationCompleteness.totalTransactions} complete`, "All docs complete", `${input.reports.classificationCompleteness.documentationPending} pending`, input.reports.classificationCompleteness.documentationComplete === input.reports.classificationCompleteness.totalTransactions ? "✓" : "✕"]);

  statusSheet.addRow(["Accounting Equation", input.reports.accountingEquation.difference, "0", input.reports.accountingEquation.difference, input.reports.accountingEquation.status === "passed" ? "✓" : "✕"]);

  statusSheet.addRow(["Opening Balances", input.reports.accountingEquation.missingInputs.includes("Opening Balance Sheet not provided") ? "Missing" : "Provided", "Required for Balance Sheet", "", input.reports.accountingEquation.missingInputs.includes("Opening Balance Sheet not provided") ? "✕" : "✓"]);

  statusSheet.addRow(["Credit Card Statements", input.reports.accountingEquation.missingInputs.includes("Credit card statements not imported") ? "Missing" : "Provided", "Required for P&L detail", "", input.reports.accountingEquation.missingInputs.includes("Credit card statements not imported") ? "✕" : "✓"]);

  // ─── Imported Statement Files ───────────────────────────────
  if (input.statementFiles && input.statementFiles.length > 0) {
    const files = workbook.addWorksheet("Statement Files", { views: [{ state: "frozen", xSplit: 0, ySplit: 1 }] });
    files.columns = [
      { header: "File Name", key: "fileName", width: 42 },
      { header: "Format", key: "fileType", width: 12 },
      { header: "Source", key: "sourceName", width: 28 },
      { header: "Imported Rows", key: "importedRows", width: 16 },
      { header: "Uploaded At", key: "uploadedAt", width: 24 },
    ];
    files.getRow(1).font = { bold: true };
    for (const file of input.statementFiles) {
      files.addRow({
        fileName: file.fileName,
        fileType: file.fileType ? file.fileType.toUpperCase() : "",
        sourceName: file.sourceName ?? "",
        importedRows: file.importedRows,
        uploadedAt: file.uploadedAt,
      });
    }
  }

  // ─── P&L Sheet ──────────────────────────────────────────────
  const pnl = workbook.addWorksheet(`P&L ${input.taxYear}`, { views: [{ showGridLines: false }] });
  pnl.getColumn(1).width = 40;
  pnl.getColumn(2).width = 22;

  headerRow(pnl.getCell("A1"), input.companyName);
  pnl.mergeCells("A1:B1");
  pnl.getCell("A2").value = `Profit & Loss — For the year ended December 31, ${input.taxYear}`;
  pnl.mergeCells("A2:B2");
  pnl.getCell("A3").value = `Generated: ${genDate}`;
  pnl.mergeCells("A3:B3");

  // P&L always shows warnings — this is a preliminary report by design
  pnl.getCell("A4").value = "⚠ PRELIMINARY — Based on bank activity only. Does not substitute CPA review.";
  pnl.getCell("A4").font = { bold: true, color: { argb: "CC5500" } };
  pnl.mergeCells("A4:B4");
  pnl.getRow(4).height = 40;
  pnl.getCell("A4").alignment = { wrapText: true };

  pnl.addRow([]);
  pnl.addRow(["Category", "Amount"]);
  bold(pnl.getCell("A5"));
  bold(pnl.getCell("B5"));

  const dataStart = 6;

  // Income section
  pnl.addRow(["INCOME"]);
  bold(pnl.getCell(`A${pnl.rowCount}`));
  const firstIncome = pnl.rowCount + 1;
  for (const [line, amount] of Object.entries(input.reports.pnl.income)) {
    pnl.addRow([line, amount]);
    pnl.getCell(`B${pnl.rowCount}`).numFmt = fmt;
  }
  const lastIncome = pnl.rowCount;
  const totalIncomeRow = pnl.rowCount + 1;
  pnl.addRow(["Total Income", { formula: `SUM(B${firstIncome}:B${lastIncome})` }]);
  bold(pnl.getCell(`A${totalIncomeRow}`));
  pnl.getCell(`B${totalIncomeRow}`).numFmt = fmt;

  // Expenses section
  pnl.addRow([]);
  pnl.addRow(["EXPENSES"]);
  bold(pnl.getCell(`A${pnl.rowCount}`));
  const firstExpense = pnl.rowCount + 1;
  for (const [line, amount] of Object.entries(input.reports.pnl.expenses)) {
    pnl.addRow([line, amount]);
    pnl.getCell(`B${pnl.rowCount}`).numFmt = fmt;
  }
  const lastExpense = pnl.rowCount;
  const totalExpenseRow = pnl.rowCount + 1;
  pnl.addRow(["Total Expenses", { formula: `SUM(B${firstExpense}:B${lastExpense})` }]);
  bold(pnl.getCell(`A${totalExpenseRow}`));
  pnl.getCell(`B${totalExpenseRow}`).numFmt = fmt;

  // Net income
  pnl.addRow([]);
  const niRow = pnl.rowCount + 1;
  pnl.addRow(["Net Income (Loss)", { formula: `B${totalIncomeRow}-B${totalExpenseRow}` }]);
  bold(pnl.getCell(`A${niRow}`));
  pnl.getCell(`B${niRow}`).numFmt = fmt;
  pnl.getCell(`B${niRow}`).font = { bold: true, italic: true };

  // ─── Classified Bank Activity (when not complete) ──────────
  if (input.reports.mode === "classified_bank_activity" || input.reports.mode === "preliminary_balance_sheet") {
    const cba = workbook.addWorksheet("Classified Bank Activity", { views: [{ showGridLines: false }] });
    cba.getColumn(1).width = 40;
    cba.getColumn(2).width = 22;

    headerRow(cba.getCell("A1"), input.companyName);
    cba.mergeCells("A1:B1");
    cba.getCell("A2").value = "Statement of Classified Bank Activity — For the year ended December 31, " + input.taxYear;
    cba.mergeCells("A2:B2");
    cba.getCell("A3").value = "Cash inflows and outflows classified by category";
    cba.mergeCells("A3:B3");

    cba.addRow([]);
    cba.addRow(["Cash Rollforward", ""]);
    bold(cba.getCell("A5"));
    cba.addRow(["Opening Cash", input.reports.openingCash]);
    cba.addRow(["Plus: Inflows", input.reports.totalInflows]);
    cba.addRow(["Less: Outflows", input.reports.totalOutflows]);
    const calcRow = cba.rowCount + 1;
    cba.addRow(["Calculated Ending Cash", { formula: `B6+B7-B8` }]);
    bold(cba.getCell(`A${calcRow}`));
    cba.getCell(`B${calcRow}`).numFmt = fmt;
    cba.addRow(["Actual Cash", input.reports.actualCash]);
    cba.addRow(["Variance", input.reports.totalCashVariance]);
    for (let r = 6; r <= 11; r++) {
      if (cba.getCell(`B${r}`).numFmt !== fmt) cba.getCell(`B${r}`).numFmt = fmt;
    }
  }

  // ─── Balance Sheet (only when sufficient data exists) ───────
  if (input.reports.mode !== "classified_bank_activity") {
  const bs = workbook.addWorksheet("Balance Sheet", { views: [{ state: "frozen", xSplit: 0, ySplit: 1, showGridLines: false }] });
  bs.getColumn(1).width = 45;
  bs.getColumn(2).width = 22;
  bs.getColumn(3).width = 16;
  bs.getColumn(4).width = 16;
  bs.getColumn(5).width = 16;
  bs.getColumn(6).width = 16;
  bs.getColumn(7).width = 16;

  headerRow(bs.getCell("A1"), input.companyName);
  bs.mergeCells("A1:B1");
  const bsTitle = input.reports.mode === "complete_balance_sheet"
    ? `Balance Sheet — As of December 31, ${input.taxYear}`
    : `Preliminary Balance Sheet from Bank Activity — As of December 31, ${input.taxYear}`;
  bs.getCell("A2").value = bsTitle;
  bs.mergeCells("A2:B2");
  bs.getCell("A3").value = `Generated: ${genDate}`;
  bs.mergeCells("A3:B3");

  // Warning always shown — this report is preliminary by design
  bs.getCell("A4").value = "⚠ PRELIMINARY — This report is based on classified bank activity and does not represent actual period-end account balances. Only imported bank movements are included. Does not substitute CPA review.";
  bs.getCell("A4").font = { bold: true, color: { argb: "CC5500" } };
  bs.mergeCells("A4:B4");
  bs.getRow(4).height = 40;
  bs.getCell("A4").alignment = { wrapText: true };

  bs.addRow([]);
  bs.addRow(["Category", "Amount"]);
  bold(bs.getCell("A6"));
  bold(bs.getCell("B6"));

  const bsDataStart = 7;
  let currentRow = bsDataStart;

  const writeSection = (label: string, lines: Record<string, number>) => {
    bs.addRow([label.toUpperCase()]);
    bold(bs.getCell(`A${currentRow}`));
    currentRow = bs.rowCount + 1;
    const first = currentRow;
    for (const [line, value] of Object.entries(lines)) {
      bs.addRow([line, value]);
      bs.getCell(`B${bs.rowCount}`).numFmt = fmt;
    }
    const last = bs.rowCount;
    if (last >= first) {
      bs.addRow([`Total ${label}`, { formula: `SUM(B${first}:B${last})` }]);
      bold(bs.getCell(`A${bs.rowCount}`));
      bs.getCell(`B${bs.rowCount}`).numFmt = fmt;
    }
    currentRow = bs.rowCount + 1;
  };

  writeSection("Assets", input.reports.balanceSheet.assets);
  writeSection("Liabilities", input.reports.balanceSheet.liabilities);
  writeSection("Equity", input.reports.balanceSheet.equity);

  bs.addRow([]);
  const bcRow = bs.rowCount + 1;
  bs.addRow(["Balance Check (Assets − Liabilities − Equity)", 0]);
  bold(bs.getCell(`A${bcRow}`));
  bs.getCell(`B${bcRow}`).numFmt = fmt;
  bs.getCell(`B${bcRow}`).value = input.reports.balanceSheet.balanceCheck;

  if (Math.abs(input.reports.balanceSheet.balanceCheck) > 0.01) {
    bs.getCell(`A${bcRow}`).font = { bold: true, color: { argb: "CC0000" } };
    bs.getCell(`B${bcRow}`).font = { bold: true, color: { argb: "CC0000" } };
    bs.addRow(["⚠ The Balance Sheet does not balance. Possible missing accounts or data."]);
    bs.getCell(`A${bs.rowCount}`).font = { italic: true, color: { argb: "CC5500" } };
    bs.mergeCells(`A${bs.rowCount}:B${bs.rowCount}`);
    bs.getCell(`A${bs.rowCount}`).alignment = { wrapText: true };
    bs.getRow(bs.rowCount).height = 30;
  }

  // Always show disclaimer — this report is preliminary by design
  bs.addRow([]);
  bs.addRow(["⚠ These financial statements are PRELIMINARY. They were generated solely from"]);
  bs.addRow(["  the uploaded bank statement data and may not reflect all transactions, assets,"]);
  bs.addRow(["  liabilities, or equity items. This report does not substitute professional"]);
  bs.addRow(["  accounting or CPA review. Do not use for tax filing or financial decisions"]);
  bs.addRow(["  without verification by a qualified CPA."]);
  for (let r = bs.rowCount - 4; r <= bs.rowCount; r++) {
    bs.getCell(`A${r}`).font = { italic: true, color: { argb: "666666" } };
    bs.getCell(`A${r}`).alignment = { wrapText: true };
  }

  } // end if (not classified_bank_activity)

  // ─── Reconciliation sheet ────────────────────────────────────
  const reconSheet = workbook.addWorksheet("Reconciliation", { views: [{ state: "frozen", xSplit: 0, ySplit: 1 }] });
  reconSheet.getColumn(1).width = 30;
  reconSheet.getColumn(2).width = 18;
  reconSheet.getColumn(3).width = 18;
  reconSheet.getColumn(4).width = 18;
  reconSheet.getColumn(5).width = 18;
  reconSheet.getColumn(6).width = 18;
  reconSheet.getColumn(7).width = 14;

  headerRow(reconSheet.getCell("A1"), "Reconciliation by Account");
  reconSheet.mergeCells("A1:G1");
  reconSheet.addRow(["Account", "Opening", "Movement", "Expected Close", "Closing", "Variance", "Status"]);
  const reconHdr = reconSheet.rowCount;
  for (let c = 1; c <= 7; c++) bold(reconSheet.getCell(reconHdr, c));

  for (const acct of input.accountReconData) {
    const r = reconcileAccountPeriod(acct.opening_balance, acct.closing_balance, input.transactions.filter((t: Transaction) => t.bankAccountId === acct.id));
    const row = reconSheet.addRow([acct.account_name, r.openingBalance, r.movementTotal, r.expectedClosingBalance, r.closingBalance, r.variance, r.status]);
    for (let c = 2; c <= 6; c++) row.getCell(c).numFmt = fmt;
    if (r.status === "unreconciled") row.getCell(7).font = { color: { argb: "CC0000" } };
  }

  // ─── Suspense Detail ────────────────────────────────────────
  if (input.reports.suspense.length > 0) {
    const sd = workbook.addWorksheet("Suspense Detail", { views: [{ state: "frozen", xSplit: 0, ySplit: 1 }] });
    sd.columns = [
      { header: "Transaction ID", key: "transactionId", width: 36 },
      { header: "Date", key: "date", width: 16 },
      { header: "Description", key: "description", width: 40 },
      { header: "Amount", key: "amount", width: 18 },
      { header: "Current Category", key: "currentCategory", width: 30 },
      { header: "Review Status", key: "reviewStatus", width: 22 },
      { header: "Reason", key: "reason", width: 40 },
    ];
    sd.getRow(1).font = { bold: true };
    for (const item of input.reports.suspense) {
      sd.addRow(item);
      sd.getCell(sd.rowCount, 4).numFmt = fmt;
    }
  }

  // ─── Transaction History (optional) ─────────────────────────
  if (input.includeTransactions) {
    const accountMap = new Map<string, string>();
    for (const a of input.accountReconData) {
      accountMap.set(a.id, a.account_name);
    }

    const th = workbook.addWorksheet("Transaction History", { views: [{ state: "frozen", xSplit: 0, ySplit: 1, showGridLines: false }] });
    th.columns = [
      { header: "Date", key: "date", width: 16 },
      { header: "Bank Account", key: "bankAccount", width: 22 },
      { header: "Description", key: "description", width: 55 },
      { header: "Amount", key: "amount", width: 18 },
      { header: "Final Category", key: "finalCategory", width: 30 },
      { header: "Report Type", key: "reportType", width: 16 },
      { header: "Confidence", key: "confidence", width: 14 },
      { header: "Rule Used", key: "ruleUsed", width: 28 },
      { header: "Classification Status", key: "classificationStatus", width: 22 },
      { header: "Documentation Status", key: "documentationStatus", width: 22 },
      { header: "Manual Correction", key: "manualCorrection", width: 18 },
      { header: "Review Notes", key: "reviewNotes", width: 32 },
    ];
    th.getRow(1).font = { bold: true };

    for (let i = 0; i < input.transactions.length; i++) {
      const t = input.transactions[i];
      const c = input.classifications[i];
      if (c?.reviewStatus === "excluded") continue;
      if (c?.finalCategory?.includes("Uncategorized")) continue;
      const dt = new Date(t.date);
      const excelDate = isNaN(dt.getTime()) ? t.date : dt;
      const row = th.addRow({
        date: excelDate,
        bankAccount: accountMap.get(t.bankAccountId) ?? t.bankAccountId,
        description: t.description,
        amount: t.amount,
        finalCategory: c?.finalCategory ?? "Unclassified",
        reportType: c?.reportType ?? "",
        confidence: c?.confidence ?? "",
        ruleUsed: c?.isManualCorrection ? "Manual" : (c?.ruleUsed ?? ""),
        classificationStatus: c ? getClassificationStatus(c) : "needs_classification",
        documentationStatus: c ? getDocumentationStatus(c) : "support_needed",
        manualCorrection: c?.isManualCorrection ? "Yes" : "",
        reviewNotes: c ? (REVIEW_NOTES[c.reviewStatus] ?? c.reviewStatus) : "",
      });
      row.getCell(1).numFmt = "yyyy-mm-dd";
      row.getCell(4).numFmt = fmt;
    }
    if (th.rowCount > 1) {
      th.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: th.rowCount, column: 12 },
      };
    }
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
