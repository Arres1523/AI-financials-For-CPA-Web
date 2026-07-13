import * as XLSX from "xlsx";
import crypto from "crypto";
import type { ColumnMapping, XlsxImportRow, UploadPreview } from "./types";

export function hashFile(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

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

function isValidCalendarDate(y: number, m: number, d: number): boolean {
  if (y < 1900 || y > 2100) return false;
  if (m < 1 || m > 12) return false;
  if (d < 1) return false;
  const daysInMonth = [31, (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return d <= daysInMonth[m - 1];
}

function parseDate(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "number") {
    const d = XLSX.SSF.parse_date_code(value);
    if (d && isValidCalendarDate(d.y, d.m, d.d)) {
      return `${d.y.toString().padStart(4, "0")}-${d.m.toString().padStart(2, "0")}-${d.d.toString().padStart(2, "0")}`;
    }
    return null;
  }
  const s = String(value).trim();
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    if (isValidCalendarDate(y, m, day)) {
      return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  const parts = s.split(/[/\-.]/);
  if (parts.length === 3) {
    let y: number, m: number, day: number;
    if (parts[0].length === 4) {
      y = parseInt(parts[0], 10); m = parseInt(parts[1], 10); day = parseInt(parts[2], 10);
    } else if (parts[2].length === 4) {
      y = parseInt(parts[2], 10); m = parseInt(parts[0], 10); day = parseInt(parts[1], 10);
    } else {
      return null;
    }
    if (isValidCalendarDate(y, m, day)) {
      return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  return null;
}

function parseAmount(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number") return Math.round(value * 100) / 100;
  const cleaned = String(value).replace(/[$,\s]/g, "").replace(/^\((.*)\)$/, "-$1").replace(/^[−–]/, "-");
  const n = Number(cleaned);
  return isNaN(n) ? null : Math.round(n * 100) / 100;
}

export function parseXlsx(data: ArrayBuffer | Uint8Array | Buffer, fileName: string): {
  sheetNames: string[];
  firstSheet: { name: string; rows: Record<string, string>[]; headers: string[] } | null;
  errors: string[];
} {
  const errors: string[] = [];
  let workbook: XLSX.WorkBook;
  try {
    const buf = Buffer.from(data as any);
    workbook = XLSX.read(buf, { type: "buffer", cellDates: true, raw: true });
  } catch {
    return { sheetNames: [], firstSheet: null, errors: ["Invalid XLSX file format"] };
  }

  if (workbook.SheetNames.length === 0) {
    return { sheetNames: [], firstSheet: null, errors: ["Workbook contains no sheets"] };
  }

  const sheetNames = workbook.SheetNames;
  const firstName = sheetNames[0];
  const sheet = workbook.Sheets[firstName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  let firstSheet: { name: string; rows: Record<string, string>[]; headers: string[] } | null = null;

  if (json.length > 0) {
    const headers = Object.keys(json[0]);
    const rows = json.map((r) => {
      const row: Record<string, string> = {};
      for (const key of headers) row[key] = String(r[key] ?? "");
      return row;
    });
    firstSheet = { name: firstName, rows, headers };
  } else {
    firstSheet = { name: firstName, rows: [], headers: [] };
  }

  return { sheetNames, firstSheet, errors };
}

export function buildPreview(buffer: ArrayBuffer | Uint8Array | Buffer, fileName: string): UploadPreview {
  const { sheetNames, firstSheet, errors: parseErrors } = parseXlsx(buffer, fileName);

  if (parseErrors.length > 0) {
    return { fileName, sheetName: null, totalRows: 0, sampleRows: [], columns: [], detectedMapping: {}, confidence: "low", errors: parseErrors };
  }

  if (!firstSheet) {
    return { fileName, sheetName: null, totalRows: 0, sampleRows: [], columns: [], detectedMapping: {}, confidence: "low", errors: ["No sheets found"] };
  }

  const errors: string[] = [];
  if (sheetNames.length > 1) {
    const ignored = sheetNames.slice(1).map((n) => `"${n}"`).join(", ");
    errors.push(`Only the first sheet, "${firstSheet.name}", will be imported. The following sheets will be ignored: ${ignored}.`);
  }

  if (firstSheet.rows.length === 0) {
    errors.push("Sheet is empty");
    return { fileName, sheetName: firstSheet.name, totalRows: 0, sampleRows: [], columns: firstSheet.headers, detectedMapping: {}, confidence: "low", errors };
  }

  const { mapping, confidence } = detectColumns(firstSheet.rows.slice(0, 10), firstSheet.headers);
  if (!mapping.date) errors.push("Date column not detected");
  if (!mapping.description) errors.push("Description column not detected");
  if (!mapping.amount && !(mapping.debit && mapping.credit)) errors.push("Amount column not detected");

  return {
    fileName,
    sheetName: firstSheet.name,
    totalRows: firstSheet.rows.length,
    sampleRows: firstSheet.rows.slice(0, 5),
    columns: firstSheet.headers,
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
  const { sheetNames, firstSheet, errors: parseErrors } = parseXlsx(data, fileName);
  const errors: ImportError[] = [];

  if (parseErrors.length > 0) {
    return { rows: [], errors: parseErrors.map((msg) => ({ row: 0, type: "invalid_format", message: msg })) };
  }

  if (!firstSheet) {
    return { rows: [], errors: [{ row: 0, type: "empty_file", message: "No sheets found" }] };
  }

  if (sheetNames.length > 1) {
    const ignored = sheetNames.slice(1).map((n) => `"${n}"`).join(", ");
    errors.push({ row: 0, type: "invalid_format", message: `Only the first sheet, "${firstSheet.name}", will be imported. The following sheets will be ignored: ${ignored}.` });
  }

  if (firstSheet.rows.length === 0) {
    return { rows: [], errors: [{ row: 0, type: "empty_file", message: "Sheet is empty" }] };
  }

  const seen = new Set<string>();
  const rows: XlsxImportRow[] = [];
  let rowIndex = 0;

  for (const raw of firstSheet.rows) {
    rowIndex++;
    const dateRaw = raw[mapping.date] ?? "";
    const descRaw = raw[mapping.description] ?? "";
    const amountRaw = mapping.amount ? (raw[mapping.amount] ?? "") : "";
    const debitRaw = mapping.debit ? (raw[mapping.debit] ?? "") : "";
    const creditRaw = mapping.credit ? (raw[mapping.credit] ?? "") : "";
    const balanceRaw = mapping.balance ? (raw[mapping.balance] ?? "") : "";

    // Validate date
    const date = parseDate(dateRaw);
    if (!date) {
      errors.push({ row: rowIndex, type: "unrecognized_date", message: `Row ${rowIndex}: Unrecognized date "${dateRaw}"` });
      continue;
    }

    // Strict fiscal year — only taxYear, not taxYear + 1
    const rowYear = new Date(date + "T12:00:00Z").getUTCFullYear();
    if (rowYear !== taxYear) {
      errors.push({ row: rowIndex, type: "outside_fiscal_year", message: `Row ${rowIndex}: Date ${date} (${rowYear}) is outside fiscal year ${taxYear}. Only ${taxYear} transactions accepted.` });
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
      date,
      description: descRaw.trim() || "(empty)",
      amount,
      balance,
      rowIndex: rowIndex - 1,
      sheetName: firstSheet.name,
    });
  }

  return { rows, errors };
}

type ImportError = {
  row: number;
  type: "empty_file" | "invalid_format" | "unrecognized_date" | "unrecognized_amount" | "incomplete_row" | "duplicate_transaction" | "duplicate_statement" | "outside_fiscal_year";
  message: string;
};
