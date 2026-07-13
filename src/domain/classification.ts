import type { Classification, Transaction } from "./types";
import { v4 as uuid } from "uuid";

const has = (value: string, patterns: RegExp[]) => patterns.some((p) => p.test(value));

const HIGH = (txId: string, cat: string, report: "P&L" | "Balance Sheet", rule: string): Classification => ({
  id: uuid(),
  transactionId: txId,
  finalCategory: cat,
  reportType: report,
  confidence: "high",
  ruleUsed: rule,
  reviewStatus: "approved",
  isManualCorrection: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const MEDIUM = (txId: string, cat: string, report: "P&L" | "Balance Sheet", rule: string): Classification => ({
  id: uuid(),
  transactionId: txId,
  finalCategory: cat,
  reportType: report,
  confidence: "medium",
  ruleUsed: rule,
  reviewStatus: "pending",
  isManualCorrection: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const LOW = (txId: string, cat: string, report: "P&L" | "Balance Sheet", rule: string): Classification => ({
  id: uuid(),
  transactionId: txId,
  finalCategory: cat,
  reportType: report,
  confidence: "low",
  ruleUsed: rule,
  reviewStatus: "pending",
  isManualCorrection: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export function classifyTransaction(transaction: Transaction): Classification {
  const text = transaction.description.toUpperCase();
  const amount = transaction.amount;

  // Balance Sheet — Transfer clearing (inter-account transfers)
  if (has(text, [/TRANSFER.*BETWEEN/, /TRF.*TO/, /TRF.*FROM/, /ACCT TRANSFER/, /INTERNAL TRANSFER/])) {
    return HIGH(transaction.id, "Transfer Clearing", "Balance Sheet", "Inter-account transfer pattern");
  }

  // Balance Sheet — Credit Card Liability
  if (has(text, [/AMEX/, /CREDIT CARD/, /CARDMEMBER/, /CC PAYMENT/, /AUTOPAY.*CARD/, /PAYMENT.*CARD/, /CHASE CARD/])) {
    return amount < 0
      ? HIGH(transaction.id, "Credit Card Liability", "Balance Sheet", "Credit card payment pattern")
      : MEDIUM(transaction.id, "Credit Card Liability", "Balance Sheet", "Credit card credit pattern");
  }

  // Balance Sheet — Owner Contributions
  if (has(text, [/CONTRIBUTION/, /CAPITAL CALL/, /OWNER FUNDING/, /MEMBER FUNDING/, /OWNER DEPOSIT/]) && amount > 0) {
    return HIGH(transaction.id, "Owner Contributions", "Balance Sheet", "Owner contribution pattern");
  }

  // Balance Sheet — Owner Distributions
  if (has(text, [/DISTRIBUTION/, /DRAW/, /OWNER PAY/, /MEMBER DISTRIBUTION/, /OWNER WITHDRAW/]) && amount < 0) {
    return HIGH(transaction.id, "Owner Distributions", "Balance Sheet", "Owner distribution pattern");
  }

  // Balance Sheet — Due To/From Related Parties
  if (has(text, [/VALORIS/, /RELATED PARTY/, /INTERCOMPANY/, /AFFILIATE/])) {
    const cat = amount < 0 ? "Due From Related Parties" : "Due To Related Parties";
    return amount < 0
      ? MEDIUM(transaction.id, cat, "Balance Sheet", "Related party payment (outgoing)")
      : MEDIUM(transaction.id, cat, "Balance Sheet", "Related party receipt (incoming)");
  }

  // Balance Sheet — Loan Liability
  if (has(text, [/LOAN PROCEEDS/, /LOAN PRINCIPAL/, /PRINCIPAL PAYMENT/, /LOAN PAYMENT/, /MORTGAGE PAY/])) {
    return HIGH(transaction.id, "Loan Liability", "Balance Sheet", "Loan principal pattern");
  }

  // P&L — Rental Income (positive amount only)
  if (has(text, [/RENTAL INCOME/, /RENT COLLECTION/, /TENANT/, /LEASE PAY/]) && amount > 0) {
    return HIGH(transaction.id, "Rental Income", "P&L", "Rental income pattern");
  }

  if (has(text, [/RENT/, /LEASE/]) && amount < 0) {
    return MEDIUM(transaction.id, "Rent Expense", "P&L", "Rent/lease payment pattern");
  }

  // P&L — Other Income
  if (has(text, [/OTHER INCOME/, /MISC INCOME/, /INTEREST INCOME/, /DIVIDEND/]) && amount > 0) {
    return MEDIUM(transaction.id, "Other Income", "P&L", "Other income pattern");
  }

  // Balance Sheet — Capital Improvements (marked for review)
  // Must come before Repairs & Maintenance to catch "ROOF REPAIR CAPITAL IMPROVEMENT"
  if (has(text, [/CAPITAL IMPROV/, /RENOVATION/, /REMODEL/, /CONSTRUCT/, /BUILD OUT/, /FLOORING/])) {
    return LOW(transaction.id, "Capital Improvements", "Balance Sheet", "Capital improvement pattern — needs accounting review");
  }

  // P&L — Repairs & Maintenance
  if (has(text, [/REPAIR/, /MAINTENANCE/, /HVAC/, /PLUMB/, /ELECTRICAL/, /HANDYMAN/, /PEST CONTROL/])) {
    return HIGH(transaction.id, "Repairs & Maintenance", "P&L", "Repairs & maintenance pattern");
  }

  // P&L — Utilities
  if (has(text, [/UTILITY/, /ELECTRIC/, /POWER CO/, /GAS CO/, /WATER/, /SEWER/, /TRASH/, /PG&E/, /LADWP/])) {
    return HIGH(transaction.id, "Utilities", "P&L", "Utility bill pattern");
  }

  // P&L — Insurance
  if (has(text, [/INSURANCE/, /LIABILITY COV/, /PROPERTY INS/])) {
    return HIGH(transaction.id, "Insurance", "P&L", "Insurance payment pattern");
  }

  // P&L — Property Taxes
  if (has(text, [/PROPERTY TAX/, /REAL ESTATE TAX/, /COUNTY TAX/])) {
    return HIGH(transaction.id, "Property Taxes", "P&L", "Property tax pattern");
  }

  // P&L — Legal & Accounting
  if (has(text, [/LEGAL/, /ACCOUNTING/, /CPA/, /ATTORNEY/, /BOOKKEEP/, /TAX PREP/])) {
    return HIGH(transaction.id, "Legal & Accounting", "P&L", "Professional services pattern");
  }

  // P&L — Management Fees
  if (has(text, [/MANAGEMENT FEE/, /PROPERTY MANAG/, /ASSET MANAG/])) {
    return HIGH(transaction.id, "Management Fees", "P&L", "Management fee pattern");
  }

  // P&L — Bank Fees
  if (has(text, [/BANK FEE/, /SERVICE FEE/, /WIRE FEE/, /MONTHLY FEE/, /TRANSACTION FEE/, /NSF/, /OVERDRAFT/])) {
    return HIGH(transaction.id, "Bank Fees", "P&L", "Bank fee pattern");
  }

  // P&L — Interest Expense
  if (has(text, [/INTEREST EXP/, /INTEREST CHARGE/, /LOAN INTEREST/, /FINANCE CHARGE/])) {
    return HIGH(transaction.id, "Interest Expense", "P&L", "Interest expense pattern");
  }

  // P&L — Other Expense
  if (has(text, [/SUPPLIES/, /POSTAGE/, /PRINTING/, /ADVERTISING/, /MARKETING/, /SOFTWARE/, /SUBSCRIPTION/, /DUES/])) {
    return MEDIUM(transaction.id, "Other Expense", "P&L", "Other operating expense pattern");
  }

  // K-1 / Tax items → review
  if (has(text, [/\BK-?1\b/, /TAX BASIS/, /AT-?RISK/, /TAX CAPITAL/, /SCHEDULE K/])) {
    return LOW(transaction.id, "Transfer Clearing", "Balance Sheet", "K-1 / tax item — needs CPA review");
  }

  // Fallback
  return LOW(transaction.id, "Transfer Clearing", "Balance Sheet", "Unrecognized pattern — default to transfer clearing");
}
