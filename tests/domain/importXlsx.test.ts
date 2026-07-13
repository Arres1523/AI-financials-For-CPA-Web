import { describe, expect, it } from "vitest";
import { buildPreview, importRows } from "../../src/domain/importXlsx";
import fs from "fs";
import path from "path";

function readFixture(name: string): Buffer {
  return fs.readFileSync(path.join(__dirname, "../fixtures", name));
}

describe("importXlsx", () => {
  describe("buildPreview", () => {
    it("detects date/description/amount columns in Chase format", () => {
      const preview = buildPreview(readFixture("chase_sample.xlsx"), "chase_sample.xlsx");
      expect(preview.totalRows).toBe(8);
      expect(preview.detectedMapping.date).toBe("Date");
      expect(preview.detectedMapping.description).toBe("Description");
      expect(preview.detectedMapping.amount).toBe("Amount");
      expect(preview.detectedMapping.balance).toBe("Balance");
      expect(preview.confidence).toBe("high");
      expect(preview.errors).toHaveLength(0);
    });

    it("detects debit/credit columns in AMEX format", () => {
      const preview = buildPreview(readFixture("amex_sample.xlsx"), "amex_sample.xlsx");
      expect(preview.totalRows).toBe(3);
      expect(preview.detectedMapping.debit).toBe("Debit");
      expect(preview.detectedMapping.credit).toBe("Credit");
      expect(preview.confidence).toBe("high");
    });

    it("shows warning for multi-sheet files", () => {
      const preview = buildPreview(readFixture("multisheet_sample.xlsx"), "multisheet_sample.xlsx");
      expect(preview.totalRows).toBe(2);
      expect(preview.sheetName).toBe("Jan 2026");
      expect(preview.columns).toContain("Transaction Date");
      expect(preview.errors.some((e) => e.includes("Only the first sheet"))).toBe(true);
      expect(preview.errors.some((e) => e.includes("will be ignored"))).toBe(true);
    });

    it("reports empty files", () => {
      const preview = buildPreview(readFixture("empty_sample.xlsx"), "empty_sample.xlsx");
      expect(preview.totalRows).toBe(0);
      expect(preview.errors.length).toBeGreaterThan(0);
    });
  });

  describe("importRows", () => {
    it("imports rows with valid mapping", () => {
      const { rows, errors } = importRows(
        readFixture("chase_sample.xlsx"),
        "chase_sample.xlsx",
        { date: "Date", description: "Description", amount: "Amount", balance: "Balance" },
        "ws-1",
        "ba-1",
        2026
      );
      expect(rows.length).toBe(8);
      expect(errors.length).toBe(0);
      expect(rows[0].description).toBe("Rental income January");
      expect(rows[0].amount).toBe(12000);
      expect(rows[0].date).toBe("2026-01-05");
    });

    it("imports rows from debit/credit columns", () => {
      const { rows, errors } = importRows(
        readFixture("amex_sample.xlsx"),
        "amex_sample.xlsx",
        { date: "Date", description: "Description", debit: "Debit", credit: "Credit" },
        "ws-1",
        "ba-1",
        2026
      );
      expect(rows.length).toBe(3);
      expect(errors.length).toBe(0);
      expect(rows[0].amount).toBe(-45);
    });

    it("rejects rows outside fiscal year", () => {
      const { rows, errors } = importRows(
        readFixture("chase_sample.xlsx"),
        "chase_sample.xlsx",
        { date: "Date", description: "Description", amount: "Amount" },
        "ws-1",
        "ba-1",
        2024
      );
      expect(rows.length).toBe(0);
      expect(errors.some((e) => e.type === "outside_fiscal_year")).toBe(true);
    });

    it("rejects taxYear+1 dates", () => {
      const { rows, errors } = importRows(
        readFixture("chase_sample.xlsx"),
        "chase_sample.xlsx",
        { date: "Date", description: "Description", amount: "Amount" },
        "ws-1",
        "ba-1",
        2025
      );
      expect(rows.length).toBe(0);
      expect(errors.some((e) => e.type === "outside_fiscal_year")).toBe(true);
    });

    it("imports only first sheet from multi-sheet file", () => {
      const { rows, errors } = importRows(
        readFixture("multisheet_sample.xlsx"),
        "multisheet_sample.xlsx",
        { date: "Transaction Date", description: "Memo", debit: "Withdrawal", credit: "Deposit" },
        "ws-1",
        "ba-1",
        2026
      );
      expect(rows.length).toBe(2);
      expect(errors.some((e) => e.message.includes("Only the first sheet"))).toBe(true);
      expect(rows[0].description).toBe("Property Management Fee");
      expect(rows[0].amount).toBe(-1500);
    });
  });
});
