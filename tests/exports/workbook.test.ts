import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { buildWorkbookBuffer } from "../../src/exports/workbook";

describe("buildWorkbookBuffer", () => {
  it("creates exactly the three required visible tabs", async () => {
    const buffer = await buildWorkbookBuffer({
      entityName: "Demo LLC",
      taxYear: 2025,
      transactions: [],
      reports: {
        pnl: { income: {}, expenses: {}, netIncome: 0 },
        balanceSheet: { assets: {}, liabilities: {}, equity: {}, balanceCheck: 0 }
      }
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["Transaction Detail", "P&L 2025", "Balance Sheet"]);
  });
});
