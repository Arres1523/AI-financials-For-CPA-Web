import { describe, expect, it, beforeAll, afterAll } from "vitest";
import fs from "fs";
import path from "path";

const BASE = "http://localhost:3001";

function readFixture(name: string): Buffer {
  return fs.readFileSync(path.join(__dirname, "../fixtures", name));
}

async function json(method: string, url: string, body?: unknown) {
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

// These tests require the dev server to be running on port 3001
// Run: PORT=3001 pnpm dev & before executing
// Integration tests: run in CI or when INTEGRATION=true is set.
// Requires a dev server on port 3001 with a test database.
describe.runIf(!!process.env.CI || !!process.env.INTEGRATION)("Import API integration", () => {
  const runId = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  let companyId: string;
  let workspaceId: string;
  let accountId: string;

  it("creates a company", async () => {
    const { status, data } = await json("POST", "/api/companies", { legalName: `Import Test LLC ${runId}` });
    expect(status).toBe(200);
    companyId = data.id;
  });

  it("creates a workspace", async () => {
    const { status, data } = await json("POST", "/api/workspaces", { companyId, taxYear: 2026 });
    expect(status).toBe(200);
    workspaceId = data.id;
  });

  it("creates a bank account", async () => {
    const { status, data } = await json("POST", "/api/accounts", {
      companyId,
      accountName: "Test Checking",
      bankName: "Test Bank",
      lastFour: "0001",
      accountType: "Checking",
    });
    expect(status).toBe(200);
    accountId = data.id;
  });
});

describe("Import domain logic", () => {
  it("buildPreview returns correct structure", async () => {
    // This tests the pure function directly, not via API
    const { buildPreview } = await import("../../src/domain/importXlsx");
    const buf = readFixture("chase_sample.xlsx");
    const preview = buildPreview(buf, "chase_sample.xlsx");
    expect(preview.totalRows).toBe(8);
    expect(preview.detectedMapping.date).toBe("Date");
    expect(preview.detectedMapping.description).toBe("Description");
    expect(preview.detectedMapping.amount).toBe("Amount");
    expect(preview.confidence).toBe("high");
    expect(preview.errors).toEqual([]);
    expect(preview.sampleRows.length).toBeGreaterThan(0);
    expect(preview.columns).toContain("Date");
  });

  it("importRows classifies and normalizes data", async () => {
    const { importRows } = await import("../../src/domain/importXlsx");
    const buf = readFixture("chase_sample.xlsx");
    const { rows, errors } = importRows(
      buf,
      "chase_sample.xlsx",
      { date: "Date", description: "Description", amount: "Amount", balance: "Balance" },
      "ws-test",
      "ba-test",
      2026
    );
    expect(rows.length).toBe(8);
    expect(errors).toEqual([]);
    expect(rows[0].date).toBe("2026-01-05");
    expect(rows[0].amount).toBe(12000);
    expect(rows[0].description).toBe("Rental income January");
  });

  it("rejects rows outside fiscal year", async () => {
    const { importRows } = await import("../../src/domain/importXlsx");
    const buf = readFixture("chase_sample.xlsx");
    const { rows, errors } = importRows(
      buf,
      "chase_sample.xlsx",
      { date: "Date", description: "Description", amount: "Amount" },
      "ws-test",
      "ba-test",
      2024
    );
    expect(rows.length).toBe(0);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].type).toBe("outside_fiscal_year");
  });

  it("handles debit/credit column format", async () => {
    const { importRows } = await import("../../src/domain/importXlsx");
    const buf = readFixture("amex_sample.xlsx");
    const { rows, errors } = importRows(
      buf,
      "amex_sample.xlsx",
      { date: "Date", description: "Description", debit: "Debit", credit: "Credit" },
      "ws-test",
      "ba-test",
      2026
    );
    expect(rows.length).toBe(3);
    expect(rows[0].amount).toBe(-45);
    expect(rows[1].amount).toBe(-99);
  });

  it("reports error for empty files", async () => {
    const { buildPreview } = await import("../../src/domain/importXlsx");
    const buf = readFixture("empty_sample.xlsx");
    const preview = buildPreview(buf, "empty_sample.xlsx");
    expect(preview.totalRows).toBe(0);
    expect(preview.errors.length).toBeGreaterThan(0);
  });

  it("rejects invalid mapping", async () => {
    const { importRows } = await import("../../src/domain/importXlsx");
    const buf = readFixture("chase_sample.xlsx");
    const { rows, errors } = importRows(
      buf,
      "chase_sample.xlsx",
      { date: "", description: "", amount: "" },
      "ws-test",
      "ba-test",
      2026
    );
    // Should still try to parse but fail
    expect(rows.length).toBe(0);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("buildPreview handles multi-sheet files", async () => {
    const { buildPreview } = await import("../../src/domain/importXlsx");
    const buf = readFixture("multisheet_sample.xlsx");
    const preview = buildPreview(buf, "multisheet_sample.xlsx");
    expect(preview.totalRows).toBe(2);
    expect(preview.sheetName).toBe("Jan 2026");
    expect(preview.detectedMapping.date).toBe("Transaction Date");
    expect(preview.detectedMapping.description).toBe("Memo");
  });
});

describe("Classification after import", () => {
  it("classifies imported transactions correctly", async () => {
    const { classifyTransaction } = await import("../../src/domain/classification");
    const { importRows } = await import("../../src/domain/importXlsx");
    const buf = readFixture("chase_sample.xlsx");
    const { rows } = importRows(
      buf,
      "chase_sample.xlsx",
      { date: "Date", description: "Description", amount: "Amount", balance: "Balance" },
      "ws-test",
      "ba-test",
      2026
    );
    expect(rows.length).toBe(8);

    const classifications = rows.map((r) =>
      classifyTransaction({
        id: `tx-${r.rowIndex}`,
        workspaceId: "ws-test",
        bankAccountId: "ba-test",
        statementId: "st-test",
        date: r.date,
        description: r.description,
        amount: r.amount,
        balance: r.balance,
        originalRowIndex: r.rowIndex,
        createdAt: new Date().toISOString(),
      })
    );

    // Rental Income → P&L / high confidence / approved
    expect(classifications[0].finalCategory).toBe("Rental Income");
    expect(classifications[0].reportType).toBe("P&L");
    expect(classifications[0].confidence).toBe("high");

    // Bank Fee → P&L / high confidence / approved
    expect(classifications[1].finalCategory).toBe("Bank Fees");
    expect(classifications[1].reportType).toBe("P&L");

    // Capital Contribution → Balance Sheet / high / approved
    expect(classifications[2].finalCategory).toBe("Capital contributions");
    expect(classifications[2].reportType).toBe("Balance Sheet");

    // AMEX payment → Balance Sheet / medium / card_statements_needed
    expect(classifications[3].finalCategory).toBe("Credit card payable");
    expect(classifications[3].reportType).toBe("Balance Sheet");
    expect(classifications[3].reviewStatus).toBe("card_statements_needed");

    // Capital Improvement → Balance Sheet / low / support_needed
    expect(classifications[4].finalCategory).toBe("Capital Improvements");
    expect(classifications[4].reportType).toBe("Balance Sheet");
    expect(classifications[4].confidence).toBe("low");
    expect(classifications[4].reviewStatus).toBe("support_needed");

    // Legal → P&L
    expect(classifications[5].finalCategory).toBe("Legal & Accounting");

    // Utility → P&L
    expect(classifications[6].finalCategory).toBe("Utilities");

    // Interest → P&L
    expect(classifications[7].finalCategory).toBe("Interest Expense");
  });
});
