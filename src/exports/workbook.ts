import ExcelJS from "exceljs";
import type { ClassifiedTransaction, ReportPackage } from "../domain/types";

export type WorkbookExportInput = {
  entityName: string;
  taxYear: number;
  transactions: ClassifiedTransaction[];
  reports: Pick<ReportPackage, "pnl" | "balanceSheet">;
};

const currencyFormat = "$#,##0.00;($#,##0.00);-";

function bold(cell: ExcelJS.Cell) {
  cell.font = { bold: true };
}

export async function buildWorkbookBuffer(input: WorkbookExportInput): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Valoris CPA Package";
  workbook.created = new Date();

  const detail = workbook.addWorksheet("Transaction Detail");
  detail.columns = [
    { header: "Date", key: "date", width: 14 },
    { header: "Source Account", key: "sourceAccount", width: 24 },
    { header: "Description", key: "description", width: 42 },
    { header: "Amount", key: "amount", width: 14 },
    { header: "Source Category", key: "sourceCategory", width: 20 },
    { header: "Final Category", key: "finalCategory", width: 26 },
    { header: "Statement", key: "statement", width: 16 },
    { header: "P&L Line", key: "pnlLine", width: 24 },
    { header: "P&L Amount", key: "pnlAmount", width: 14 },
    { header: "BS Line", key: "bsLine", width: 28 },
    { header: "BS Counterpart Amount", key: "bsCounterpartAmount", width: 20 },
    { header: "Type", key: "type", width: 16 },
    { header: "Source Balance", key: "sourceBalance", width: 16 },
    { header: "Review Status", key: "reviewStatus", width: 26 }
  ];
  detail.views = [{ state: "frozen", ySplit: 1 }];
  detail.getRow(1).font = { bold: true };

  input.transactions.forEach((row) => {
    const excelRow = detail.addRow({
      date: row.date,
      sourceAccount: row.sourceAccount,
      description: row.description,
      amount: row.amount,
      sourceCategory: row.sourceCategory,
      finalCategory: row.finalCategory,
      statement: row.statement,
      pnlLine: row.pnlLine,
      pnlAmount: 0,
      bsLine: row.bsLine,
      bsCounterpartAmount: 0,
      type: row.type,
      sourceBalance: row.sourceBalance,
      reviewStatus: row.reviewStatus
    });
    excelRow.getCell("I").value = row.statement === "P&L" ? { formula: `D${excelRow.number}` } : { formula: "0" };
    excelRow.getCell("K").value =
      row.statement === "Balance Sheet" ? { formula: `D${excelRow.number}` } : { formula: "0" };
    excelRow.getCell("D").numFmt = currencyFormat;
    excelRow.getCell("I").numFmt = currencyFormat;
    excelRow.getCell("K").numFmt = currencyFormat;
    excelRow.getCell("M").numFmt = currencyFormat;
  });

  const firstDataRow = 2;
  const lastDataRow = Math.max(input.transactions.length + 1, 2);

  const pnl = workbook.addWorksheet(`P&L ${input.taxYear}`, { views: [{ showGridLines: false }] });
  pnl.addRow([input.entityName]);
  pnl.addRow(["Profit and Loss"]);
  pnl.addRow([`For the year ended December 31, ${input.taxYear}`]);
  pnl.addRow([]);
  pnl.addRow(["Category", "Amount"]);
  pnl.getRow(1).font = { bold: true };
  pnl.getRow(2).font = { bold: true };
  pnl.getRow(5).font = { bold: true };
  pnl.columns = [{ width: 34 }, { width: 16 }];

  pnl.addRow(["Income"]);
  bold(pnl.getCell("A6"));
  for (const line of Object.keys(input.reports.pnl.income)) {
    const row = pnl.addRow([line, { formula: `SUMIFS('Transaction Detail'!$I$${firstDataRow}:$I$${lastDataRow},'Transaction Detail'!$H$${firstDataRow}:$H$${lastDataRow},A${pnl.rowCount})` }]);
    row.getCell(2).numFmt = currencyFormat;
  }
  const totalIncomeRow = pnl.rowCount + 1;
  pnl.addRow(["Total Income", { formula: `SUM(B7:B${Math.max(totalIncomeRow - 1, 7)})` }]);
  bold(pnl.getCell(`A${totalIncomeRow}`));
  pnl.getCell(`B${totalIncomeRow}`).numFmt = currencyFormat;

  pnl.addRow([]);
  const expensesHeader = pnl.rowCount + 1;
  pnl.addRow(["Expenses"]);
  bold(pnl.getCell(`A${expensesHeader}`));
  const firstExpenseRow = pnl.rowCount + 1;
  for (const line of Object.keys(input.reports.pnl.expenses)) {
    const row = pnl.addRow([line, { formula: `-SUMIFS('Transaction Detail'!$I$${firstDataRow}:$I$${lastDataRow},'Transaction Detail'!$H$${firstDataRow}:$H$${lastDataRow},A${pnl.rowCount})` }]);
    row.getCell(2).numFmt = currencyFormat;
  }
  const totalExpensesRow = pnl.rowCount + 1;
  pnl.addRow(["Total Expenses", { formula: `SUM(B${firstExpenseRow}:B${Math.max(totalExpensesRow - 1, firstExpenseRow)})` }]);
  bold(pnl.getCell(`A${totalExpensesRow}`));
  pnl.getCell(`B${totalExpensesRow}`).numFmt = currencyFormat;

  pnl.addRow([]);
  const netIncomeRow = pnl.rowCount + 1;
  pnl.addRow(["Net Income (Loss)", { formula: `B${totalIncomeRow}-B${totalExpensesRow}` }]);
  bold(pnl.getCell(`A${netIncomeRow}`));
  pnl.getCell(`B${netIncomeRow}`).numFmt = currencyFormat;

  const bs = workbook.addWorksheet("Balance Sheet", { views: [{ showGridLines: false }] });
  bs.columns = [{ width: 38 }, { width: 16 }];
  bs.addRow([input.entityName]);
  bs.addRow(["Balance Sheet"]);
  bs.addRow([`As of December 31, ${input.taxYear}`]);
  bs.addRow([]);
  bs.addRow(["Category", "Amount"]);
  bs.getRow(1).font = { bold: true };
  bs.getRow(2).font = { bold: true };
  bs.getRow(5).font = { bold: true };

  const sections = [
    ["Assets", input.reports.balanceSheet.assets],
    ["Liabilities", input.reports.balanceSheet.liabilities],
    ["Equity", input.reports.balanceSheet.equity]
  ] as const;

  const totalRows: Record<string, number> = {};
  for (const [section, lines] of sections) {
    bs.addRow([]);
    const headerRow = bs.rowCount + 1;
    bs.addRow([section]);
    bold(bs.getCell(`A${headerRow}`));
    const firstLine = bs.rowCount + 1;
    for (const line of Object.keys(lines)) {
      const row = bs.addRow([line, { formula: `SUMIFS('Transaction Detail'!$K$${firstDataRow}:$K$${lastDataRow},'Transaction Detail'!$J$${firstDataRow}:$J$${lastDataRow},A${bs.rowCount})` }]);
      if (line === "Current year net income") row.getCell(2).value = { formula: `'P&L ${input.taxYear}'!B${netIncomeRow}` };
      row.getCell(2).numFmt = currencyFormat;
    }
    const totalRow = bs.rowCount + 1;
    bs.addRow([`Total ${section}`, { formula: `SUM(B${firstLine}:B${Math.max(totalRow - 1, firstLine)})` }]);
    bold(bs.getCell(`A${totalRow}`));
    bs.getCell(`B${totalRow}`).numFmt = currencyFormat;
    totalRows[section] = totalRow;
  }

  bs.addRow([]);
  const totalLeRow = bs.rowCount + 1;
  bs.addRow(["Total Liabilities and Equity", { formula: `B${totalRows.Liabilities}+B${totalRows.Equity}` }]);
  bold(bs.getCell(`A${totalLeRow}`));
  bs.getCell(`B${totalLeRow}`).numFmt = currencyFormat;
  const balanceCheckRow = bs.rowCount + 1;
  bs.addRow(["Balance Check", { formula: `B${totalRows.Assets}-B${totalLeRow}` }]);
  bold(bs.getCell(`A${balanceCheckRow}`));
  bs.getCell(`B${balanceCheckRow}`).numFmt = currencyFormat;

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
