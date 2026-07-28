import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { buildStatementPreview, importStatementRows } from "../../src/domain/statementImport";
import { preclassifyImportRows } from "../../src/domain/importPreclassification";

function makeWorkbook(rows: Record<string, string>[]): Buffer {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Transactions");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

function makeTextPdf(lines: string[]): Buffer {
  const textOps = lines
    .map((line, index) => `BT /F1 12 Tf 50 ${760 - index * 16} Td (${line}) Tj ET`)
    .join("\n");
  return Buffer.from(`%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj
4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
5 0 obj << /Length ${textOps.length} >> stream
${textOps}
endstream endobj
trailer << /Root 1 0 R >>
%%EOF`);
}

describe("statementImport", () => {
  it("builds a CSV preview and imports mapped rows", () => {
    const csv = Buffer.from("Date,Description,Amount,Balance\n01/05/2026,BANK FEE,-12.00,9988.00");

    const preview = buildStatementPreview(csv, "jan.csv");
    expect(preview.fileType).toBe("csv");
    expect(preview.totalRows).toBe(1);
    expect(preview.detectedMapping).toMatchObject({
      date: "Date",
      description: "Description",
      amount: "Amount",
      balance: "Balance",
    });
    expect(preview.errors).toEqual([]);

    const { rows, errors } = importStatementRows(
      csv,
      "jan.csv",
      { date: "Date", description: "Description", amount: "Amount", balance: "Balance" },
      "ws-1",
      "ba-1",
      2026
    );
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({
      date: "2026-01-05",
      description: "BANK FEE",
      amount: -12,
      balance: 9988,
      sourceName: "jan.csv",
    });
  });

  it("treats CSV field count mismatches as warnings instead of blocking mapping", () => {
    const csv = Buffer.from([
      "Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #",
      "DEBIT,01/05/2026,Payment with extra comma in text,-12.00,ACH,9988.00,",
      "CREDIT,01/06/2026,Rental Income,1200.00,ACH,11188.00,,unexpected",
    ].join("\n"));

    const preview = buildStatementPreview(csv, "chase.csv");
    expect(preview.fileType).toBe("csv");
    expect(preview.columns).toEqual(["Details", "Posting Date", "Description", "Amount", "Type", "Balance", "Check or Slip #"]);
    expect(preview.totalRows).toBe(2);
    expect(preview.errors).toEqual([]);
    expect(preview.warnings?.some((warning) => warning.includes("field count"))).toBe(true);
    expect(preview.detectedMapping).toMatchObject({
      date: "Posting Date",
      description: "Description",
      amount: "Amount",
      balance: "Balance",
    });

    const { rows, errors } = importStatementRows(
      csv,
      "chase.csv",
      { date: "Posting Date", description: "Description", amount: "Amount", transactionType: "Type", balance: "Balance" },
      "ws-1",
      "ba-1",
      2026
    );
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({
      date: "2026-01-06",
      description: "Rental Income",
      amount: 1200,
      classificationText: "Rental Income | ACH",
    });
  });

  it("handles quoted commas, BOM, CRLF, and accounting parentheses in CSV", () => {
    const csv = Buffer.from("\uFEFFDate,Description,Amount,Balance\r\n01/07/2026,\"Vendor, Inc.\",($1,234.56),8765.44\r\n");

    const preview = buildStatementPreview(csv, "quoted.csv");
    expect(preview.errors).toEqual([]);
    expect(preview.detectedMapping).toMatchObject({
      date: "Date",
      description: "Description",
      amount: "Amount",
      balance: "Balance",
    });

    const { rows, errors } = importStatementRows(
      csv,
      "quoted.csv",
      { date: "Date", description: "Description", amount: "Amount", balance: "Balance" },
      "ws-1",
      "ba-1",
      2026
    );
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({
      description: "Vendor, Inc.",
      amount: -1234.56,
      balance: 8765.44,
    });
  });

  it("imports debit and credit CSV columns with payee and merchant details", () => {
    const csv = Buffer.from([
      "Transaction Date,Payee,Memo,Debit,Credit,Merchant Category,Running Balance",
      "02/01/2026,Shell,Mileage reimbursement fuel,72.14,,Fuel,9927.86",
      "02/02/2026,Tenant A,February rent,,1500.00,Rental,11427.86",
    ].join("\n"));

    const preview = buildStatementPreview(csv, "debit-credit.csv");
    expect(preview.errors).toEqual([]);
    expect(preview.detectedMapping).toMatchObject({
      date: "Transaction Date",
      description: "Memo",
      payee: "Payee",
      debit: "Debit",
      credit: "Credit",
      merchantCategory: "Merchant Category",
      balance: "Running Balance",
    });

    const { rows, errors } = importStatementRows(
      csv,
      "debit-credit.csv",
      {
        date: "Transaction Date",
        description: "Memo",
        payee: "Payee",
        debit: "Debit",
        credit: "Credit",
        merchantCategory: "Merchant Category",
        balance: "Running Balance",
      },
      "ws-1",
      "ba-1",
      2026
    );
    expect(errors).toEqual([]);
    expect(rows.map((row) => row.amount)).toEqual([-72.14, 1500]);
    expect(rows[0].classificationText).toBe("Shell | Mileage reimbursement fuel | Fuel");
  });

  it("preclassifies enriched CSV rows using bank-provided merchant signals", () => {
    const csv = Buffer.from([
      "Transaction Date,Payee,Memo,Debit,Credit,Merchant Category,Running Balance",
      "02/01/2026,Shell,Mileage reimbursement,72.14,,Fuel,9927.86",
      "02/02/2026,T Mobile,Monthly phone bill,89.99,,Telecom Communications,9837.87",
    ].join("\n"));

    const result = preclassifyImportRows(
      csv,
      "merchant-signals.csv",
      {
        date: "Transaction Date",
        description: "Memo",
        payee: "Payee",
        debit: "Debit",
        credit: "Credit",
        merchantCategory: "Merchant Category",
        balance: "Running Balance",
      },
      "ws-1",
      "ba-1",
      2026
    );

    expect(result.errors).toEqual([]);
    expect(result.rows.map((row) => row.proposedClassification.finalCategory)).toEqual(["Other Expense", "Utilities"]);
    expect(result.rows.every((row) => row.proposedClassification.reportType === "P&L")).toBe(true);
  });

  it("auto-detects semicolon-delimited CSV exports", () => {
    const csv = Buffer.from("Date;Description;Amount;Balance\n03/01/2026;Bank Fee;-35.00;9965.00");

    const preview = buildStatementPreview(csv, "semicolon.csv");
    expect(preview.errors).toEqual([]);
    expect(preview.columns).toEqual(["Date", "Description", "Amount", "Balance"]);

    const { rows, errors } = importStatementRows(
      csv,
      "semicolon.csv",
      { date: "Date", description: "Description", amount: "Amount", balance: "Balance" },
      "ws-1",
      "ba-1",
      2026
    );
    expect(errors).toEqual([]);
    expect(rows[0].amount).toBe(-35);
  });

  it("rejects unsupported file types with a clear error", () => {
    const preview = buildStatementPreview(Buffer.from("Date,Description,Amount"), "statement.txt");
    expect(preview.errors).toEqual(["Unsupported file type. Upload CSV, XLSX, or text-based PDF."]);
  });

  it("keeps XLSX support through the unified importer", () => {
    const workbook = makeWorkbook([
      { Date: "01/05/2026", Description: "Rental income January", Amount: "12000.00", Balance: "12000.00" },
    ]);

    const preview = buildStatementPreview(workbook, "statement.xlsx");
    expect(preview.fileType).toBe("xlsx");
    expect(preview.sourceName).toBe("Transactions");
    expect(preview.detectedMapping.amount).toBe("Amount");

    const { rows, errors } = importStatementRows(
      workbook,
      "statement.xlsx",
      { date: "Date", description: "Description", amount: "Amount", balance: "Balance" },
      "ws-1",
      "ba-1",
      2026
    );
    expect(errors).toEqual([]);
    expect(rows[0].amount).toBe(12000);
    expect(rows[0].sourceName).toBe("Transactions");
  });

  it("extracts text-based PDF statement rows and rejects scanned PDFs clearly", () => {
    const pdf = makeTextPdf([
      "Date Description Amount Balance",
      "01/05/2026 Bank Fee -12.00 9988.00",
      "01/06/2026 Rental Income 1200.00 11188.00",
    ]);

    const preview = buildStatementPreview(pdf, "statement.pdf");
    expect(preview.fileType).toBe("pdf");
    expect(preview.totalRows).toBe(2);
    expect(preview.warnings).toContain("PDF text extraction is best-effort. Review the parsed rows before import.");

    const { rows, errors } = importStatementRows(
      pdf,
      "statement.pdf",
      { date: "Date", description: "Description", amount: "Amount", balance: "Balance" },
      "ws-1",
      "ba-1",
      2026
    );
    expect(errors).toEqual([]);
    expect(rows.map((row) => row.description)).toEqual(["Bank Fee", "Rental Income"]);

    const scanned = buildStatementPreview(Buffer.from("%PDF-1.4\n%%EOF"), "scan.pdf");
    expect(scanned.errors).toContain("Text-based PDF content was not detected. Upload CSV/XLSX or a text-based PDF.");
  });
});
