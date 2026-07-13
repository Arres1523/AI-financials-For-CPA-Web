import * as XLSX from "xlsx";
import type { ColumnMapping, XlsxImportRow, UploadPreview } from "./types";

const AMOUNT_ALIASES = [/amount/i, /transaction/i, /value/i, /sum/i, /total/i];
const DATE_ALIASES = [/date/i, /transaction date/i, /posted date/i, /posting date/i, /trans.?date/i];
const DESC_ALIASES = [/description/i, /memo/i, /details/i, /name/i, /narrative/i, /payee/i, /merchant/i, /reference/i];
const DEBIT_ALIASES = [/debit/i, /withdrawal/i, /payment/i, /paid out/i, /outflow/i, /chq/i];
const CREDIT_ALIASES = [/credit/i, /deposit/i, /received/i, /paid in/i, /inflow/i];
const BALANCE_ALIASES = [/balance/i, /running balance/i, /ledger balance/i, /available/i];

function matchColumn(headers: string[], aliases: RegExp[]): string | undefined {
  return headers.find((h) => aliases.some((a) => a.test(h.trim())));
}

function detectColumns(sampleRows: Record<string, string>[], headers: string[]): {
  mapping: Partial<ColumnMapping>;
  confidence: "high" | "medium" | "low";
} {
  const dateCol = matchColumn(headers, DATE_ALIASES);
  const descCol = matchColumn(headers, DESC_ALIASES);
  const amountCol = matchColumn(headers, AMOUNT_ALIASES);
  const debitCol = matchColumn(headers, DEBIT_ALIASES);
  const creditCol = matchColumn(headers, CREDIT_ALIASES);
  const balanceCol = matchColumn(headers, BALANCE_ALIASES);

  const found = [dateCol, descCol, amountCol, debitCol, creditCol, balanceCol].filter(Boolean).length;
  const hasAmount = !!amountCol || (!!debitCol && !!creditCol);
  const confidence = found >= 2 && hasAmount ? (found >= 4 ? "high" : found >= 3 ? "medium" : "medium") : "low";

  return {
    mapping: {
      date: dateCol,
      description: descCol,
      amount: amountCol,
      debit: debitCol,
      credit: creditCol,
      balance: balanceCol,
    },
    confidence,
  };
}

function parseDate(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "number") {
    const d = XLSX.SSF.parse_date_code(value);
    if (d) {
      const y = d.y.toString().padStart(4, "0");
      const m = d.m.toString().padStart(2, "0");
      const day = d.d.toString().padStart(2, "0");
      return `${y}-${m}-${day}`;
    }
  }
  const s = String(value).trim();
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  const parts = s.split(/[/\-.]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
    if (parts[2].length === 4) return `${parts[2]}-${parts[0].padStart(2, "0")}-${parts[1].padStart(2, "0")}`;
  }
  return s;
}

function parseAmount(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number") return Math.round(value * 100) / 100;
  const cleaned = String(value).replace(/[$,\s]/g, "").replace(/^\((.*)\)$/, "-$1").replace(/^[−–]/, "-");
  const n = Number(cleaned);
  return isNaN(n) ? null : Math.round(n * 100) / 100;
}

export function parseXlsx(data: ArrayBuffer | Uint8Array | Buffer, fileName: string): {
  sheets: { name: string; rows: Record<string, string>[]; headers: string[] }[];
  errors: string[];
} {
  const errors: string[] = [];
  let workbook: XLSX.WorkBook;
  try {
    const buf = Buffer.from(data as any);
    workbook = XLSX.read(buf, { type: "buffer", cellDates: true, raw: true });
  } catch {
    return { sheets: [], errors: ["Invalid XLSX file format"] };
  }

  if (workbook.SheetNames.length === 0) {
    return { sheets: [], errors: ["Workbook contains no sheets"] };
  }

  const sheets = workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    if (json.length === 0) return { name, rows: [], headers: [] };
    const headers = Object.keys(json[0]);
    const rows = json.map((r) => {
      const row: Record<string, string> = {};
      for (const key of headers) row[key] = String(r[key] ?? "");
      return row;
    });
    return { name, rows, headers };
  });

  return { sheets, errors };
}

export function buildPreview(buffer: ArrayBuffer | Uint8Array | Buffer, fileName: string): UploadPreview {
  const { sheets, errors: parseErrors } = parseXlsx(buffer, fileName);

  if (parseErrors.length > 0) {
    return { fileName, sheetName: null, totalRows: 0, sampleRows: [], columns: [], detectedMapping: {}, confidence: "low", errors: parseErrors };
  }

  const sheet = sheets[0];
  if (sheet.rows.length === 0) {
    return { fileName, sheetName: sheet.name, totalRows: 0, sampleRows: [], columns: sheet.headers, detectedMapping: {}, confidence: "low", errors: ["Sheet is empty"] };
  }

  const { mapping, confidence } = detectColumns(sheet.rows.slice(0, 10), sheet.headers);
  const errors: string[] = [];
  if (!mapping.date) errors.push("Date column not detected");
  if (!mapping.description) errors.push("Description column not detected");
  if (!mapping.amount && !(mapping.debit && mapping.credit)) errors.push("Amount column not detected");

  return {
    fileName,
    sheetName: sheet.name,
    totalRows: sheet.rows.length,
    sampleRows: sheet.rows.slice(0, 5),
    columns: sheet.headers,
    detectedMapping: mapping,
    confidence,
    errors,
  };
}

export function importRows(
  data: ArrayBuffer | Uint8Array | Buffer,
  fileName: string,
  mapping: ColumnMapping,
  workspaceId: string,
  bankAccountId: string,
  taxYear: number
): { rows: XlsxImportRow[]; errors: ImportError[] } {
  const { sheets, errors: parseErrors } = parseXlsx(data, fileName);
  const errors: ImportError[] = [];

  if (parseErrors.length > 0) {
    return { rows: [], errors: parseErrors.map((msg) => ({ row: 0, type: "invalid_format", message: msg })) };
  }

  const seen = new Set<string>();
  const rows: XlsxImportRow[] = [];
  let rowIndex = 0;

  for (const sheet of sheets) {
    for (const raw of sheet.rows) {
      rowIndex++;
      const dateRaw = raw[mapping.date] ?? raw[mapping.date] ?? "";
      const descRaw = raw[mapping.description] ?? raw[mapping.description] ?? "";
      const amountRaw = raw[mapping.amount] ?? "";
      const debitRaw = mapping.debit ? (raw[mapping.debit] ?? "") : "";
      const creditRaw = mapping.credit ? (raw[mapping.credit] ?? "") : "";
      const balanceRaw = mapping.balance ? (raw[mapping.balance] ?? "") : "";

      // Validate date
      const date = parseDate(dateRaw);
      if (!date) {
        errors.push({ row: rowIndex, type: "unrecognized_date", message: `Row ${rowIndex}: Could not parse date "${dateRaw}"` });
        continue;
      }

      // Validate fiscal year
      const rowYear = new Date(date).getFullYear();
      if (rowYear !== taxYear && rowYear !== taxYear + 1) {
        errors.push({ row: rowIndex, type: "outside_fiscal_year", message: `Row ${rowIndex}: Date ${date} is outside fiscal year ${taxYear}` });
        continue;
      }

      // Validate amount
      let amount: number | null = null;
      if (amountRaw) {
        amount = parseAmount(amountRaw);
      } else if (debitRaw || creditRaw) {
        const debit = parseAmount(debitRaw) || 0;
        const credit = parseAmount(creditRaw) || 0;
        amount = credit - debit;
      }
      if (amount === null) {
        errors.push({ row: rowIndex, type: "unrecognized_amount", message: `Row ${rowIndex}: Could not parse amount` });
        continue;
      }

      // Validate description
      if (!descRaw.trim()) {
        errors.push({ row: rowIndex, type: "incomplete_row", message: `Row ${rowIndex}: Missing description` });
      }

      const balance = balanceRaw ? parseAmount(balanceRaw) : null;
      const key = `${date}|${descRaw.trim()}|${amount}`;

      if (seen.has(key)) {
        errors.push({ row: rowIndex, type: "duplicate_transaction", message: `Row ${rowIndex}: Duplicate transaction "${descRaw.trim()}" on ${date}` });
        continue;
      }
      seen.add(key);

      rows.push({
        date: date!,
        description: descRaw.trim() || "(empty)",
        amount: amount,
        balance,
        rowIndex: rowIndex - 1,
        sheetName: sheet.name,
      });
    }
  }

  return { rows, errors };
}

type ImportError = {
  row: number;
  type: "empty_file" | "invalid_format" | "unrecognized_date" | "unrecognized_amount" | "incomplete_row" | "duplicate_transaction" | "duplicate_statement" | "outside_fiscal_year";
  message: string;
};
