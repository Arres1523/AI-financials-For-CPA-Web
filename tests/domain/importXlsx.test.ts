import { describe, expect, it } from "vitest";
import { buildPreview, importRows } from "../../src/domain/importXlsx";
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";

function readFixture(name: string): Buffer {
  return fs.readFileSync(path.join(__dirname, "../fixtures", name));
}

function makeQBWorkbook(rows: Record<string, string>[]): Buffer {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
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

  describe("QB Payee/Memo support", () => {
    it("uses memo when payee is empty", () => {
      const buf = makeQBWorkbook([
        { Date: "01/15/2026", Memo: "Office supplies", Payee: "", Payment: "150.00", Deposit: "" },
      ]);
      const { rows, errors } = importRows(
        buf, "qb.xlsx",
        { date: "Date", description: "Memo", payee: "Payee", debit: "Payment", credit: "Deposit" },
        "ws-1", "ba-1", 2026
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].description).toBe("Office supplies");
      expect(rows[0].classificationText).toBe("Office supplies");
      expect(errors).toHaveLength(0);
    });

    it("uses payee when memo is empty (Wyndham case)", () => {
      const buf = makeQBWorkbook([
        { Date: "01/31/2026", Memo: "", Payee: "Wyndham Investment Group LLC", Payment: "", Deposit: "675.00" },
      ]);
      const { rows, errors } = importRows(
        buf, "qb.xlsx",
        { date: "Date", description: "Memo", payee: "Payee", debit: "Payment", credit: "Deposit" },
        "ws-1", "ba-1", 2026
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].description).toBe("Wyndham Investment Group LLC");
      expect(rows[0].classificationText).toBe("Wyndham Investment Group LLC");
      expect(errors).toHaveLength(0);
    });

    it("combines payee and memo when both differ", () => {
      const buf = makeQBWorkbook([
        { Date: "02/01/2026", Memo: "Monthly rent", Payee: "ABC Properties LLC", Payment: "5000.00", Deposit: "" },
      ]);
      const { rows, errors } = importRows(
        buf, "qb.xlsx",
        { date: "Date", description: "Memo", payee: "Payee", debit: "Payment", credit: "Deposit" },
        "ws-1", "ba-1", 2026
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].description).toBe("Monthly rent");
      expect(rows[0].classificationText).toBe("ABC Properties LLC | Monthly rent");
      expect(errors).toHaveLength(0);
    });

    it("deduplicates when payee and memo are identical", () => {
      const buf = makeQBWorkbook([
        { Date: "03/01/2026", Memo: "Wyndham Investment Group LLC", Payee: "Wyndham Investment Group LLC", Payment: "", Deposit: "700.00" },
      ]);
      const { rows, errors } = importRows(
        buf, "qb.xlsx",
        { date: "Date", description: "Memo", payee: "Payee", debit: "Payment", credit: "Deposit" },
        "ws-1", "ba-1", 2026
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].description).toBe("Wyndham Investment Group LLC");
      expect(rows[0].classificationText).toBe("Wyndham Investment Group LLC");
      expect(errors).toHaveLength(0);
    });

    it("marks as incomplete_row when both payee and memo are empty", () => {
      const buf = makeQBWorkbook([
        { Date: "04/01/2026", Memo: "", Payee: "", Payment: "100.00", Deposit: "" },
      ]);
      const { rows, errors } = importRows(
        buf, "qb.xlsx",
        { date: "Date", description: "Memo", payee: "Payee", debit: "Payment", credit: "Deposit" },
        "ws-1", "ba-1", 2026
      );
      expect(rows).toHaveLength(1);
      expect(errors).toHaveLength(1);
      expect(errors[0].type).toBe("incomplete_row");
    });

    it("handles Payment as negative amount", () => {
      const buf = makeQBWorkbook([
        { Date: "05/01/2026", Memo: "Electric bill", Payee: "PG&E", Payment: "250.00", Deposit: "" },
      ]);
      const { rows, errors } = importRows(
        buf, "qb.xlsx",
        { date: "Date", description: "Memo", payee: "Payee", debit: "Payment", credit: "Deposit" },
        "ws-1", "ba-1", 2026
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].amount).toBe(-250);
      expect(errors).toHaveLength(0);
    });

    it("handles Deposit as positive amount", () => {
      const buf = makeQBWorkbook([
        { Date: "06/01/2026", Memo: "Rent income", Payee: "Tenant A", Payment: "", Deposit: "1500.00" },
      ]);
      const { rows, errors } = importRows(
        buf, "qb.xlsx",
        { date: "Date", description: "Memo", payee: "Payee", debit: "Payment", credit: "Deposit" },
        "ws-1", "ba-1", 2026
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].amount).toBe(1500);
      expect(errors).toHaveLength(0);
    });

    it("handles both Payment and Deposit present (net)", () => {
      const buf = makeQBWorkbook([
        { Date: "07/01/2026", Memo: "Net transaction", Payee: "Bank", Payment: "100.00", Deposit: "250.00" },
      ]);
      const { rows, errors } = importRows(
        buf, "qb.xlsx",
        { date: "Date", description: "Memo", payee: "Payee", debit: "Payment", credit: "Deposit" },
        "ws-1", "ba-1", 2026
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].amount).toBe(150);
      expect(errors).toHaveLength(0);
    });

    it("handles zero amount", () => {
      const buf = makeQBWorkbook([
        { Date: "08/01/2026", Memo: "Zero tx", Payee: "", Payment: "0.00", Deposit: "" },
      ]);
      const { rows, errors } = importRows(
        buf, "qb.xlsx",
        { date: "Date", description: "Memo", payee: "Payee", debit: "Payment", credit: "Deposit" },
        "ws-1", "ba-1", 2026
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].amount).toBe(0);
      expect(errors).toHaveLength(0);
    });

    it("handles special characters in descriptions", () => {
      const buf = makeQBWorkbook([
        { Date: "09/01/2026", Memo: "Café & Bakery #3", Payee: "José's Café, LLC", Payment: "45.50", Deposit: "" },
      ]);
      const { rows, errors } = importRows(
        buf, "qb.xlsx",
        { date: "Date", description: "Memo", payee: "Payee", debit: "Payment", credit: "Deposit" },
        "ws-1", "ba-1", 2026
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].description).toBe("Café & Bakery #3");
      expect(rows[0].classificationText).toBe("José's Café, LLC | Café & Bakery #3");
      expect(errors).toHaveLength(0);
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
