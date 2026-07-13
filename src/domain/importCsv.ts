import Papa from "papaparse";
import type { Transaction } from "./types";

const aliases = {
  date: ["date", "transaction date", "posted date"],
  description: ["description", "memo", "details", "name"],
  amount: ["amount", "transaction amount"],
  debit: ["debit", "withdrawal"],
  credit: ["credit", "deposit"],
  balance: ["balance", "running balance"]
};

function findValue(row: Record<string, string>, names: string[]): string {
  const normalized = Object.fromEntries(Object.entries(row).map(([key, value]) => [key.trim().toLowerCase(), value]));
  for (const name of names) {
    if (normalized[name] !== undefined) return normalized[name];
  }
  return "";
}

function parseAmount(value: string): number {
  const cleaned = value.replace(/[$,\s]/g, "").replace(/^\((.*)\)$/, "-$1");
  if (!cleaned) return 0;
  return Number(cleaned);
}

function parseDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
}

export function normalizeCsvRows(csv: string, sourceAccount: string, sourceFile: string): Transaction[] {
  const parsed = Papa.parse<Record<string, string>>(csv.trim(), { header: true, skipEmptyLines: true });

  return parsed.data.map((row, index) => {
    const amountValue = findValue(row, aliases.amount);
    const debit = parseAmount(findValue(row, aliases.debit));
    const credit = parseAmount(findValue(row, aliases.credit));
    const amount = amountValue ? parseAmount(amountValue) : credit - debit;

    return {
      id: `${sourceFile}-${index + 1}`,
      date: parseDate(findValue(row, aliases.date)),
      sourceAccount,
      description: findValue(row, aliases.description),
      amount,
      sourceCategory: "",
      type: "",
      sourceBalance: findValue(row, aliases.balance) ? parseAmount(findValue(row, aliases.balance)) : null,
      sourceFile
    };
  });
}
