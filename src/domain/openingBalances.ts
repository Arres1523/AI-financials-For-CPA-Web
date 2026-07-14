import type { OpeningBalanceEntry, OpeningBalanceSheetInput } from "./types";

export function validateOpeningBalanceSheet(entries: Pick<OpeningBalanceEntry, "accountType" | "amount">[]): OpeningBalanceSheetInput {
  const assets = entries.filter(e => e.accountType === "asset").reduce((s, e) => s + e.amount, 0);
  const liabilities = entries.filter(e => e.accountType === "liability").reduce((s, e) => s + e.amount, 0);
  const equity = entries.filter(e => e.accountType === "equity").reduce((s, e) => s + e.amount, 0);
  const difference = Math.round((assets - liabilities - equity) * 100) / 100;
  return { entries: entries as OpeningBalanceEntry[], isValid: Math.abs(difference) <= 0.01, difference };
}
