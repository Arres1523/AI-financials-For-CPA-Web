import { describe, expect, it } from "vitest";
import { classifyTransaction } from "../../src/domain/classification";
import type { Transaction } from "../../src/domain/types";

const tx = (description: string, amount: number): Transaction => ({
  id: `${description}-${amount}`,
  workspaceId: "ws-1",
  bankAccountId: "ba-1",
  statementId: "st-1",
  date: "2025-01-15",
  description,
  amount,
  balance: null,
  originalRowIndex: 0,
  createdAt: "2025-01-15T00:00:00.000Z",
});

describe("classifyTransaction", () => {
  it("keeps capital contributions off P&L", () => {
    const c = classifyTransaction(tx("CAPITAL CONTRIBUTION OWNER", 50000));
    expect(c.reportType).toBe("Balance Sheet");
    expect(c.finalCategory).toBe("Capital contributions");
  });

  it("keeps credit card payments off P&L and flags for card statements", () => {
    const c = classifyTransaction(tx("AUTOPAY AMEX PAYMENT", -3000));
    expect(c.reportType).toBe("Balance Sheet");
    expect(c.finalCategory).toBe("Credit card payable");
    expect(c.reviewStatus).toBe("card_statements_needed");
  });

  it("routes K-1 items to CPA review", () => {
    const c = classifyTransaction(tx("K-1 income from investment LLC", 2500));
    expect(c.reportType).toBe("Balance Sheet");
    expect(c.reviewStatus).toBe("cpa_review");
  });

  it("classifies rental income as P&L", () => {
    const c = classifyTransaction(tx("RENTAL INCOME January", 12000));
    expect(c.reportType).toBe("P&L");
    expect(c.finalCategory).toBe("Rental Income");
    expect(c.confidence).toBe("high");
  });

  it("classifies bank fees as P&L", () => {
    const c = classifyTransaction(tx("MONTHLY BANK FEE", -35));
    expect(c.reportType).toBe("P&L");
    expect(c.finalCategory).toBe("Bank Fees");
  });

  it("classifies interest expense as P&L", () => {
    const c = classifyTransaction(tx("LOAN INTEREST CHARGE", -200));
    expect(c.reportType).toBe("P&L");
    expect(c.finalCategory).toBe("Interest Expense");
  });

  it("classifies utilities as P&L", () => {
    const c = classifyTransaction(tx("PG&E UTILITY BILL", -145));
    expect(c.reportType).toBe("P&L");
    expect(c.finalCategory).toBe("Utilities");
  });

  it("classifies fuel merchant details as other expense", () => {
    const c = classifyTransaction(tx("SHELL SERVICE STATION | merchant category: fuel", -72.14));
    expect(c.reportType).toBe("P&L");
    expect(c.finalCategory).toBe("Other Expense");
    expect(c.reviewStatus).toBe("approved");
  });

  it("classifies telecom merchant details as utilities", () => {
    const c = classifyTransaction(tx("T MOBILE | merchant category: telecom communications", -89.99));
    expect(c.reportType).toBe("P&L");
    expect(c.finalCategory).toBe("Utilities");
  });

  it("classifies software subscriptions as other expense", () => {
    const c = classifyTransaction(tx("ZOOM.US SOFTWARE SUBSCRIPTION", -15.99));
    expect(c.reportType).toBe("P&L");
    expect(c.finalCategory).toBe("Other Expense");
  });

  it("flags capital improvements for support needed", () => {
    const c = classifyTransaction(tx("ROOF REPAIR CAPITAL IMPROVEMENT", -5000));
    expect(c.finalCategory).toBe("Capital Improvements");
    expect(c.reviewStatus).toBe("support_needed");
  });

  // --- P0 Bug Fix: /NSF/ word boundary ---
  it("does not match NSF inside TRANSFER", () => {
    const c = classifyTransaction(tx("Online Transfer from CHK ...1234", 10000));
    expect(c.finalCategory).toBe("Transfer Clearing");
    expect(c.reportType).toBe("Balance Sheet");
  });

  it("matches standalone NSF as bank fee", () => {
    const c = classifyTransaction(tx("NSF FEE CHARGED", -35));
    expect(c.finalCategory).toBe("Bank Fees");
    expect(c.reportType).toBe("P&L");
  });

  // --- P0: Online Transfer pattern ---
  it("classifies Online Transfer from CHK as Transfer Clearing", () => {
    const c = classifyTransaction(tx("Online Transfer from CHK ...2516 transaction#: 12345", 10000));
    expect(c.finalCategory).toBe("Transfer Clearing");
    expect(c.reportType).toBe("Balance Sheet");
  });

  it("classifies Online Transfer to CHK as Transfer Clearing", () => {
    const c = classifyTransaction(tx("Online Transfer to CHK ...9291 transaction#: 67890", -50000));
    expect(c.finalCategory).toBe("Transfer Clearing");
    expect(c.reportType).toBe("Balance Sheet");
  });

  // --- P0: AUTOPAY without CARD keyword ---
  it("classifies AUTOPAY AUTO-PMT as Credit card payable", () => {
    const c = classifyTransaction(tx("AUTOPAY 2954520RAUTOPAY AUTO-PMT", -1847.83));
    expect(c.finalCategory).toBe("Credit card payable");
    expect(c.reportType).toBe("Balance Sheet");
    expect(c.confidence).toBe("high");
    expect(c.reviewStatus).toBe("card_statements_needed");
  });

  it("classifies CITI AUTOPAY as Credit card payable", () => {
    const c = classifyTransaction(tx("ORIG CO NAME:CITI AUTOPAY ORIG ID:CITICARDAP DESC DATE:250131 CO ENTRY DESCR:PAYMENT SEC:WEB", -859.56));
    expect(c.finalCategory).toBe("Credit card payable");
    expect(c.reportType).toBe("Balance Sheet");
  });

  // --- P1: Wire Transfer rule ---
  it("classifies domestic wire transfer as Balance Sheet CPA review", () => {
    const c = classifyTransaction(tx("ONLINE DOMESTIC WIRE TRANSFER VIA: THREAD BANK/064209588 A/C: AS TRAINING LLC", -5000));
    expect(c.finalCategory).toBe("Wire Transfers");
    expect(c.reportType).toBe("Balance Sheet");
    expect(c.reviewStatus).toBe("cpa_review");
  });

  // --- P1: Service Charges pattern ---
  it("classifies SERVICE CHARGES FOR THE MONTH OF as Bank Fees", () => {
    const c = classifyTransaction(tx("SERVICE CHARGES FOR THE MONTH OF APRIL", -100));
    expect(c.finalCategory).toBe("Bank Fees");
    expect(c.reportType).toBe("P&L");
  });

  // --- P1: ACH signature deposit pattern ---
  it("classifies SIGONFILE deposit as Other Income", () => {
    const c = classifyTransaction(tx("ORIG CO NAME:Alexander Forres ORIG ID:9000271750 DESC DATE:011325 CO ENTRY DESCR:SIGONFILE SEC:PPD", 0.01));
    expect(c.finalCategory).toBe("Other Income");
    expect(c.reportType).toBe("P&L");
    expect(c.confidence).toBe("high");
  });

  // --- P1: SIGONFILE before VALORIS false positive ---
  it("classifies SIGONFILE with VALORIS in description as Other Income not related party", () => {
    const c = classifyTransaction(tx("ORIG CO NAME:Alexander Forres DESC DATE:110425 CO ENTRY DESCR:SIGONFILE IND NAME:Valoris Capital Partne", 163.53));
    expect(c.finalCategory).toBe("Other Income");
    expect(c.reportType).toBe("P&L");
  });

  // --- P2: Merchant Processing Fees ---
  it("classifies INTUIT TRAN FEE as Merchant Processing Fees", () => {
    const c = classifyTransaction(tx("ORIG CO NAME: INTUIT 27262443 ORIG ID:9215986202 DESC DATE:250131 CO ENTRY DESCR:TRAN FEE SEC:CCD", -20.18));
    expect(c.finalCategory).toBe("Merchant Processing Fees");
    expect(c.reportType).toBe("P&L");
  });

  it("classifies generic MERCHANT FEE as Merchant Processing Fees", () => {
    const c = classifyTransaction(tx("MONTHLY MERCHANT FEE", -15));
    expect(c.finalCategory).toBe("Merchant Processing Fees");
    expect(c.reportType).toBe("P&L");
  });

  // --- Step 4: Counterparty Rules (Wyndham) ---
  const txWithCompany = (desc: string, amount: number, companyId?: string): Transaction => ({
    ...tx(desc, amount),
    companyId,
  });

  it("matches Wyndham positive deposit via pattern rule", () => {
    const c = classifyTransaction(tx("Wyndham Investment Group LLC", 675));
    expect(c.finalCategory).toBe("Operating / merchant income");
    expect(c.reportType).toBe("P&L");
    expect(c.confidence).toBe("high");
    expect(c.reviewStatus).toBe("approved");
    expect(c.ruleUsed).toContain("Wyndham");
  });

  it("does NOT match Wyndham with negative amount", () => {
    const c = classifyTransaction(tx("Wyndham Investment Group LLC", -675));
    expect(c.finalCategory).toBe("Uncategorized / Needs Review");
  });

  it("matches Wyndham regardless of companyId (pattern-based)", () => {
    const c = classifyTransaction(txWithCompany("Wyndham Investment Group LLC", 675, "other-company"));
    expect(c.finalCategory).toBe("Operating / merchant income");
  });

  it("matches similar name Wyndham Investment Group Inc", () => {
    const c = classifyTransaction(tx("Wyndham Investment Group Inc", 675));
    expect(c.finalCategory).toBe("Operating / merchant income");
  });

  it("falls back for unknown payee with positive deposit", () => {
    const c = classifyTransaction(txWithCompany("Some Unknown Deposit from ABC Corp", 1500, "valoris-capital-partners"));
    expect(c.finalCategory).toBe("Uncategorized / Needs Review");
  });

  it("works without companyId (pattern-based, backward compat)", () => {
    const c = classifyTransaction(tx("Wyndham Investment Group LLC", 675));
    expect(c.finalCategory).toBe("Operating / merchant income");
  });
});
