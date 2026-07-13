import ExcelJS from "exceljs";
import type { Classification, PnlReport, BalanceSheetReport, Transaction } from "../domain/types";
import { reconcileAccountPeriod } from "../domain/reconciliation";

const fmt = "$#,##0.00;($#,##0.00);-";

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
  reports: { pnl: PnlReport; balanceSheet: BalanceSheetReport };
  flaggedTransactions: Transaction[];
  accountReconData: { id: string; account_name: string; opening_balance: number; closing_balance: number; movement_total: number }[];
  includeTransactions: boolean;
};

export async function buildWorkbookBuffer(input: WorkbookExportInput): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "AI Financials for CPA Web";
  workbook.created = new Date();
  const genDate = new Date().toISOString().slice(0, 10);

  // ─── P&L Sheet ──────────────────────────────────────────────
  const pnl = workbook.addWorksheet(`P&L ${input.taxYear}`, { views: [{ showGridLines: false }] });
  pnl.columns = [{ width: 36 }, { width: 18 }];

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

  // ─── Preliminary Balance Sheet from Bank Activity ──────────
  const bs = workbook.addWorksheet("Balance Sheet", { views: [{ showGridLines: false }] });
  bs.columns = [{ width: 38 }, { width: 18 }];

  headerRow(bs.getCell("A1"), input.companyName);
  bs.mergeCells("A1:B1");
  bs.getCell("A2").value = `Preliminary Balance Sheet from Bank Activity — As of December 31, ${input.taxYear}`;
  bs.mergeCells("A2:B2");
  bs.getCell("A3").value = `Generated: ${genDate}`;
  bs.mergeCells("A3:B3");

  // Warning always shown — this report is preliminary by design
  bs.getCell("A4").value = "⚠ PRELIMINARY — This report is based on classified bank activity and does not represent actual period-end account balances. Only imported bank movements are included. Does not substitute CPA review.";
  bs.getCell("A4").font = { bold: true, color: { argb: "CC5500" } };
  bs.mergeCells("A4:B4");

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
  }

  // ─── Reconciliation Summary ─────────────────────────────────
  const reconRows = bs.rowCount + 2;
  bs.addRow([]);
  bs.addRow(["RECONCILIATION BY ACCOUNT"]);
  bold(bs.getCell(`A${reconRows + 1}`));
  bs.addRow(["Account", "Opening", "Movement", "Expected Close", "Closing", "Variance", "Status"]);
  const reconHeader = bs.rowCount;
  for (let c = 1; c <= 7; c++) bold(bs.getCell(reconHeader, c));

  for (const acct of input.accountReconData) {
    const r = reconcileAccountPeriod(acct.opening_balance, acct.closing_balance, input.transactions.filter((t: Transaction) => t.bankAccountId === acct.id));
    const row = bs.addRow([acct.account_name, r.openingBalance, r.movementTotal, r.expectedClosingBalance, r.closingBalance, r.variance, r.status]);
    for (let c = 2; c <= 6; c++) row.getCell(c).numFmt = fmt;
    if (r.status === "unreconciled") {
      row.getCell(7).font = { color: { argb: "CC0000" } };
    }
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
  }

  // ─── Transaction History (optional) ─────────────────────────
  if (input.includeTransactions) {
    const th = workbook.addWorksheet("Transaction History", { views: [{ showGridLines: false }] });
    th.columns = [
      { header: "Date", key: "date", width: 14 },
      { header: "Description", key: "description", width: 50 },
      { header: "Amount", key: "amount", width: 16 },
      { header: "Final Category", key: "finalCategory", width: 28 },
    ];
    th.getRow(1).font = { bold: true };

    for (let i = 0; i < input.transactions.length; i++) {
      const t = input.transactions[i];
      const c = input.classifications[i];
      if (c?.reviewStatus === "excluded") continue;
      const dt = new Date(t.date);
      const excelDate = isNaN(dt.getTime()) ? t.date : dt;
      const row = th.addRow({
        date: excelDate,
        description: t.description,
        amount: t.amount,
        finalCategory: c?.finalCategory ?? "Unclassified",
      });
      row.getCell(1).numFmt = "yyyy-mm-dd";
      row.getCell(3).numFmt = fmt;
    }
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
