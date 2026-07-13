import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { buildWorkbookBuffer } from "../../src/exports/workbook";

describe("buildWorkbookBuffer", () => {
  it("creates P&L and Balance Sheet sheets with optional Transaction History", async () => {
    const buffer = await buildWorkbookBuffer({
      companyName: "Demo LLC",
      taxYear: 2025,
      transactions: [],
      classifications: [],
      reports: {
        pnl: { income: {}, expenses: {}, netIncome: 0 },
        balanceSheet: { assets: {}, liabilities: {}, equity: {}, balanceCheck: 0 },
      },
      flaggedTransactions: [],
      accountReconData: [],
      includeTransactions: false,
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const names = workbook.worksheets.map((s) => s.name);
    expect(names).toContain(`P&L 2025`);
    expect(names).toContain("Balance Sheet");
    expect(names).not.toContain("Transaction History");
  });

  it("includes Transaction History sheet when requested", async () => {
    const buffer = await buildWorkbookBuffer({
      companyName: "Demo LLC",
      taxYear: 2025,
      transactions: [],
      classifications: [],
      reports: {
        pnl: { income: {}, expenses: {}, netIncome: 0 },
        balanceSheet: { assets: {}, liabilities: {}, equity: {}, balanceCheck: 0 },
      },
      flaggedTransactions: [],
      accountReconData: [],
      includeTransactions: true,
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const names = workbook.worksheets.map((s) => s.name);
    expect(names).toContain("Transaction History");
  });
});
