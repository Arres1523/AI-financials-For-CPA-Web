import type { ClassificationResult, Transaction } from "./types";

const has = (value: string, patterns: RegExp[]) => patterns.some((pattern) => pattern.test(value));

const result = (
  transaction: Transaction,
  patch: Omit<ClassificationResult, "transactionId" | "source">
): ClassificationResult => ({
  transactionId: transaction.id,
  source: patch.reviewStatus ? "rule" : "rule",
  ...patch
});

export function classifyTransaction(transaction: Transaction): ClassificationResult {
  const text = `${transaction.description} ${transaction.sourceCategory} ${transaction.type}`.toUpperCase();
  const amount = transaction.amount;

  if (has(text, [/\bK-?1\b/, /TAX BASIS/, /AT-?RISK/, /TAX CAPITAL/])) {
    return result(transaction, {
      finalCategory: "Transfer clearing",
      statement: "Balance Sheet",
      pnlLine: "",
      pnlAmount: 0,
      bsLine: "Transfer clearing",
      bsCounterpartAmount: amount,
      reviewStatus: "CPA Review"
    });
  }

  if (has(text, [/AMEX/, /CREDIT CARD/, /CARDMEMBER/, /CC PAYMENT/, /AUTOPAY.*CARD/, /PAYMENT.*CARD/])) {
    return result(transaction, {
      finalCategory: "Credit card payable",
      statement: "Balance Sheet",
      pnlLine: "",
      pnlAmount: 0,
      bsLine: "Credit card payable",
      bsCounterpartAmount: amount,
      reviewStatus: "Credit Card Statements Needed"
    });
  }

  if (has(text, [/CONTRIBUTION/, /CAPITAL CALL/, /OWNER FUNDING/, /MEMBER FUNDING/]) && amount > 0) {
    return result(transaction, {
      finalCategory: "Capital contributions",
      statement: "Balance Sheet",
      pnlLine: "",
      pnlAmount: 0,
      bsLine: "Capital contributions",
      bsCounterpartAmount: amount,
      reviewStatus: ""
    });
  }

  if (has(text, [/DISTRIBUTION/, /DRAW/, /OWNER PAY/, /MEMBER DISTRIBUTION/]) && amount < 0) {
    return result(transaction, {
      finalCategory: "Member distributions",
      statement: "Balance Sheet",
      pnlLine: "",
      pnlAmount: 0,
      bsLine: "Member distributions",
      bsCounterpartAmount: amount,
      reviewStatus: ""
    });
  }

  if (has(text, [/VALORIS/, /RELATED PARTY/, /INTERCOMPANY/, /TRANSFER/])) {
    return result(transaction, {
      finalCategory: amount < 0 ? "Due from related parties" : "Due to related parties",
      statement: "Balance Sheet",
      pnlLine: "",
      pnlAmount: 0,
      bsLine: amount < 0 ? "Due from related parties" : "Due to related parties",
      bsCounterpartAmount: amount,
      reviewStatus: "Potential Related Party"
    });
  }

  if (has(text, [/INVESTMENT/, /PARTNERSHIP/, /PROJECT DEPOSIT/, /CAPITAL CALL/])) {
    return result(transaction, {
      finalCategory: "Investment in partnerships",
      statement: "Balance Sheet",
      pnlLine: "",
      pnlAmount: 0,
      bsLine: "Investment in partnerships",
      bsCounterpartAmount: amount,
      reviewStatus: amount > 0 ? "CPA Review" : ""
    });
  }

  if (has(text, [/LOAN PROCEEDS/, /LOAN PRINCIPAL/, /PRINCIPAL PAYMENT/])) {
    return result(transaction, {
      finalCategory: "Loan payable",
      statement: "Balance Sheet",
      pnlLine: "",
      pnlAmount: 0,
      bsLine: "Loan payable",
      bsCounterpartAmount: amount,
      reviewStatus: ""
    });
  }

  if (has(text, [/INTEREST/])) {
    return result(transaction, {
      finalCategory: "Interest expense",
      statement: "P&L",
      pnlLine: "Interest expense",
      pnlAmount: amount,
      bsLine: "",
      bsCounterpartAmount: 0,
      reviewStatus: ""
    });
  }

  if (has(text, [/BANK FEE/, /SERVICE FEE/, /WIRE FEE/, /MONTHLY FEE/])) {
    return result(transaction, {
      finalCategory: "Bank fees",
      statement: "P&L",
      pnlLine: "Bank fees",
      pnlAmount: amount,
      bsLine: "",
      bsCounterpartAmount: 0,
      reviewStatus: ""
    });
  }

  if (has(text, [/LEGAL/, /ACCOUNTING/, /CPA/, /ATTORNEY/])) {
    return result(transaction, {
      finalCategory: "Legal and accounting",
      statement: "P&L",
      pnlLine: "Legal and accounting",
      pnlAmount: amount,
      bsLine: "",
      bsCounterpartAmount: 0,
      reviewStatus: ""
    });
  }

  if (has(text, [/RENT/, /RENTAL/, /MANAGEMENT FEE/, /ASSET MANAGEMENT/]) && amount > 0) {
    return result(transaction, {
      finalCategory: text.includes("MANAGEMENT") ? "Management fee income" : "Rental Income",
      statement: "P&L",
      pnlLine: text.includes("MANAGEMENT") ? "Management fee income" : "Rental Income",
      pnlAmount: amount,
      bsLine: "",
      bsCounterpartAmount: 0,
      reviewStatus: ""
    });
  }

  return {
    transactionId: transaction.id,
    finalCategory: "Transfer clearing",
    statement: "Balance Sheet",
    pnlLine: "",
    pnlAmount: 0,
    bsLine: "Transfer clearing",
    bsCounterpartAmount: amount,
    reviewStatus: "CPA Review",
    source: "fallback"
  };
}
