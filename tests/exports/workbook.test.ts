import ExcelJS from "exceljs";
import type { WorkbookExportInput } from "../../src/exports/workbook";
import type { FinancialReport } from "../../src/domain/types";
import { describe, expect, it } from "vitest";
import { buildWorkbookBuffer } from "../../src/exports/workbook";

const minimalReport: FinancialReport = {
  mode: "classified_bank_activity",
  modeReasons: [],
  entityName: "Demo LLC",
  taxYear: 2025,
  pnl: { income: {}, expenses: {}, netIncome: 0 },
  balanceSheet: { assets: {}, liabilities: {}, equity: {}, balanceCheck: 0 },
  bankReconciliation: [],
  classificationCompleteness: { totalTransactions: 0, approved: 0, excluded: 0, unresolved: 0, unresolvedAmount: 0, suspenseAmount: 0, status: "complete", classified: 0, documentationComplete: 0, documentationPending: 0 },
  accountingEquation: { totalAssets: 0, totalLiabilities: 0, totalEquity: 0, difference: 0, status: "passed", missingInputs: [] },
  suspense: [],
  actualCash: 0,
  expectedCash: 0,
  totalCashVariance: 0,
  matchedTransferCount: 0,
  matchedTransferAmount: 0,
  openingCash: 0,
  totalInflows: 0,
  totalOutflows: 0,
};

const minimalInput: WorkbookExportInput = {
  companyName: "Demo LLC",
  taxYear: 2025,
  transactions: [],
  classifications: [],
  reports: minimalReport,
  flaggedTransactions: [],
  accountReconData: [],
  includeTransactions: false,
};

async function buildAndLoad(input: WorkbookExportInput = minimalInput) {
  const buffer = await buildWorkbookBuffer(input);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  return workbook;
}

describe("buildWorkbookBuffer", () => {
  it("creates P&L and Reconciliation sheets with optional Transaction History", async () => {
    const workbook = await buildAndLoad();
    const names = workbook.worksheets.map((s) => s.name);
    expect(names).toContain(`P&L 2025`);
    expect(names).toContain("Reconciliation");
    expect(names).not.toContain("Transaction History");
  });

  it("omits Balance Sheet in classified_bank_activity mode", async () => {
    const workbook = await buildAndLoad();
    const names = workbook.worksheets.map((s) => s.name);
    expect(names).not.toContain("Balance Sheet");
  });

  it("includes Balance Sheet in preliminary_balance_sheet mode", async () => {
    const input: WorkbookExportInput = {
      ...minimalInput,
      reports: { ...minimalReport, mode: "preliminary_balance_sheet" },
    };
    const workbook = await buildAndLoad(input);
    const names = workbook.worksheets.map((s) => s.name);
    expect(names).toContain("Balance Sheet");
  });

  it("includes Transaction History sheet when requested", async () => {
    const workbook = await buildAndLoad({ ...minimalInput, includeTransactions: true });
    const names = workbook.worksheets.map((s) => s.name);
    expect(names).toContain("Transaction History");
  });

  it("includes imported statement file metadata when provided", async () => {
    const workbook = await buildAndLoad({
      ...minimalInput,
      statementFiles: [{
        fileName: "jan.csv",
        fileType: "csv",
        sourceName: "jan.csv",
        importedRows: 25,
        uploadedAt: "2026-01-02T00:00:00.000Z",
      }],
    });
    const sheet = workbook.getWorksheet("Statement Files")!;
    expect(sheet).toBeDefined();
    expect(sheet.getCell("A2").value).toBe("jan.csv");
    expect(sheet.getCell("B2").value).toBe("CSV");
    expect(sheet.getCell("D2").value).toBe(25);
  });

  it("sets P&L column widths", async () => {
    const workbook = await buildAndLoad();
    const pnl = workbook.getWorksheet(`P&L 2025`)!;
    expect(pnl.getColumn(1).width).toBeGreaterThanOrEqual(40);
    expect(pnl.getColumn(2).width).toBeGreaterThanOrEqual(22);
  });

  it("sets Balance Sheet column widths", async () => {
    const workbook = await buildAndLoad({
      ...minimalInput,
      reports: { ...minimalReport, mode: "preliminary_balance_sheet" },
    });
    const bs = workbook.getWorksheet("Balance Sheet")!;
    expect(bs.getColumn(1).width).toBeGreaterThanOrEqual(45);
    expect(bs.getColumn(2).width).toBeGreaterThanOrEqual(22);
    for (let c = 3; c <= 7; c++) {
      expect(bs.getColumn(c).width).toBeGreaterThanOrEqual(16);
    }
  });

  it("sets warning row height and wrapText on P&L", async () => {
    const workbook = await buildAndLoad();
    const pnl = workbook.getWorksheet(`P&L 2025`)!;
    expect(pnl.getRow(4).height).toBeGreaterThanOrEqual(30);
    expect(pnl.getCell("A4").alignment?.wrapText).toBe(true);
  });

  it("sets warning row height and wrapText on Balance Sheet", async () => {
    const workbook = await buildAndLoad({
      ...minimalInput,
      reports: { ...minimalReport, mode: "preliminary_balance_sheet" },
    });
    const bs = workbook.getWorksheet("Balance Sheet")!;
    expect(bs.getRow(4).height).toBeGreaterThanOrEqual(30);
    expect(bs.getCell("A4").alignment?.wrapText).toBe(true);
  });

  const sampleTx = {
    id: "1", workspaceId: "ws", bankAccountId: "ba", statementId: "st-1",
    date: "2025-01-15", description: "Test", amount: 100, balance: 100,
    originalRowIndex: 0, createdAt: "2025-01-01",
  };
  const sampleCl = {
    id: "c1", transactionId: "1", workspaceId: "ws",
    reportType: "P&L" as const, confidence: "high" as const,
    reviewStatus: "approved" as const, finalCategory: "Test",
    ruleUsed: null, isManualCorrection: false,
    createdAt: "2025-01-01", updatedAt: "2025-01-01",
  };

  it("applies date format to date cells in Transaction History", async () => {
    const workbook = await buildAndLoad({
      ...minimalInput,
      includeTransactions: true,
      transactions: [sampleTx],
      classifications: [sampleCl],
    });
    const th = workbook.getWorksheet("Transaction History")!;
    const cell = th.getCell("A2");
    expect(cell.numFmt).toBe("yyyy-mm-dd");
  });

  it("applies currency format to amount cells in Transaction History", async () => {
    const workbook = await buildAndLoad({
      ...minimalInput,
      includeTransactions: true,
      transactions: [sampleTx],
      classifications: [sampleCl],
    });
    const th = workbook.getWorksheet("Transaction History")!;
    const cell = th.getCell("D2");
    expect(cell.numFmt).toBe("$#,##0.00;($#,##0.00);-");
  });

  it("freezes Transaction History header row", async () => {
    const workbook = await buildAndLoad({ ...minimalInput, includeTransactions: true });
    const th = workbook.getWorksheet("Transaction History")!;
    const view = th.views[0] as Record<string, unknown>;
    expect(view.state).toBe("frozen");
    expect(view.ySplit).toBe(1);
  });

  it("applies autofilter to Transaction History", async () => {
    const workbook = await buildAndLoad({
      ...minimalInput,
      includeTransactions: true,
      transactions: [sampleTx],
      classifications: [sampleCl],
    });
    const th = workbook.getWorksheet("Transaction History")!;
    expect(th.autoFilter).toBeDefined();
  });

  it("bolds Category/Amount header row in P&L", async () => {
    const workbook = await buildAndLoad();
    const pnl = workbook.getWorksheet(`P&L 2025`)!;
    const header1Font = pnl.getCell("A5").font;
    const header2Font = pnl.getCell("B5").font;
    expect(header1Font?.bold).toBe(true);
    expect(header2Font?.bold).toBe(true);
  });

  it("bolds section headers in P&L", async () => {
    const workbook = await buildAndLoad({
      ...minimalInput,
      reports: {
        ...minimalReport,
        pnl: { income: { "Revenue": 1000 }, expenses: { "Rent": 500 }, netIncome: 500 },
      },
    });
    const pnl = workbook.getWorksheet(`P&L 2025`)!;
    const incomeSection = pnl.getCell("A7");
    expect(incomeSection.value).toBe("INCOME");
    expect(incomeSection.font?.bold).toBe(true);
  });
});
