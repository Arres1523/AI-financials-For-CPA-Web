import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { buildStatementPreview, importStatementRows } from "../../src/domain/statementImport";

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
