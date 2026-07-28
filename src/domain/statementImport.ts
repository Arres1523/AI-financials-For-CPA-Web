import Papa from "papaparse";
import { buildPreview as buildXlsxPreview, importRows as importXlsxRows } from "./importXlsx";
import type { ColumnMapping, ImportError, StatementFileType, UploadPreview, XlsxImportRow } from "./types";

type ParsedTable = {
  rows: Record<string, string>[];
  columns: string[];
  sourceName: string;
  warnings: string[];
  errors: string[];
};

const DATE_ALIASES = [/^date$/i, /transaction date/i, /posted date/i, /posting date/i, /trans.?date/i];
const DESC_ALIASES = [/description/i, /memo/i, /details/i, /name/i, /narrative/i, /merchant/i, /reference/i];
const PAYEE_ALIASES = [/payee/i, /vendor/i, /supplier/i, /customer/i, /received from/i, /paid to/i];
const MERCHANT_ALIASES = [/merchant category/i, /\bmcc\b/i, /commerce type/i, /category detail/i];
const TYPE_ALIASES = [/transaction type/i, /\btype\b/i, /entry type/i];
const AMOUNT_ALIASES = [/amount/i, /transaction amount/i, /\bvalue\b/i, /\btotal\b/i];
const DEBIT_ALIASES = [/debit/i, /withdrawal/i, /payment/i, /paid out/i, /outflow/i];
const CREDIT_ALIASES = [/credit/i, /deposit/i, /received/i, /paid in/i, /inflow/i];
const BALANCE_ALIASES = [/balance/i, /running balance/i, /ledger balance/i, /available/i];

export function detectStatementFileType(fileName: string): StatementFileType | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".xlsx")) return "xlsx";
  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".pdf")) return "pdf";
  return null;
}

export function buildStatementPreview(data: ArrayBuffer | Uint8Array | Buffer, fileName: string): UploadPreview {
  const fileType = detectStatementFileType(fileName);
  if (!fileType) {
    return emptyPreview(fileName, null, [`Unsupported file type. Upload CSV, XLSX, or text-based PDF.`]);
  }

  if (fileType === "xlsx") {
    const preview = buildXlsxPreview(data, fileName);
    return {
      ...preview,
      fileType,
      sourceName: preview.sheetName,
      warnings: [],
    };
  }

  const table = fileType === "csv" ? parseCsv(data, fileName) : parseTextPdf(data, fileName);
  if (table.errors.length > 0) {
    return {
      fileName,
      fileType,
      sourceName: table.sourceName,
      sheetName: null,
      totalRows: 0,
      sampleRows: [],
      columns: table.columns,
      detectedMapping: {},
      confidence: "low",
      errors: table.errors,
      warnings: table.warnings,
    };
  }

  const { mapping, confidence } = detectColumns(table.columns);
  const errors: string[] = [];
  if (!mapping.date) errors.push("Date column not detected");
  if (!mapping.description) errors.push("Description column not detected");
  if (!mapping.amount && !(mapping.debit && mapping.credit)) errors.push("Amount column not detected");

  return {
    fileName,
    fileType,
    sourceName: table.sourceName,
    sheetName: null,
    totalRows: table.rows.length,
    sampleRows: table.rows.slice(0, 5),
    columns: table.columns,
    detectedMapping: mapping,
    confidence,
    errors,
    warnings: table.warnings,
  };
}

export function importStatementRows(
  data: ArrayBuffer | Uint8Array | Buffer,
  fileName: string,
  mapping: ColumnMapping,
  workspaceId: string,
  bankAccountId: string,
  taxYear: number
): { rows: XlsxImportRow[]; errors: ImportError[] } {
  const fileType = detectStatementFileType(fileName);
  if (!fileType) {
    return { rows: [], errors: [{ row: 0, type: "invalid_format", message: "Unsupported file type. Upload CSV, XLSX, or text-based PDF." }] };
  }

  if (fileType === "xlsx") {
    const result = importXlsxRows(data, fileName, mapping, workspaceId, bankAccountId, taxYear);
    return {
      rows: result.rows.map((row) => ({
        ...row,
        fileType,
        sourceName: row.sheetName || fileName,
      })),
      errors: result.errors,
    };
  }

  const table = fileType === "csv" ? parseCsv(data, fileName) : parseTextPdf(data, fileName);
  if (table.errors.length > 0) {
    return { rows: [], errors: table.errors.map((message) => ({ row: 0, type: "invalid_format", message })) };
  }

  return importTableRows(table.rows, table.sourceName, fileType, mapping, taxYear);
}

function emptyPreview(fileName: string, fileType: StatementFileType | null, errors: string[]): UploadPreview {
  return {
    fileName,
    fileType: fileType ?? undefined,
    sourceName: null,
    sheetName: null,
    totalRows: 0,
    sampleRows: [],
    columns: [],
    detectedMapping: {},
    confidence: "low",
    errors,
    warnings: [],
  };
}

function parseCsv(data: ArrayBuffer | Uint8Array | Buffer, fileName: string): ParsedTable {
  const csv = Buffer.from(data as any).toString("utf8").replace(/^\uFEFF/, "");
  const parsed = Papa.parse<Record<string, string>>(csv.trim(), {
    header: true,
    skipEmptyLines: true,
  });
  const fatalErrors = parsed.errors.filter((error) => error.code !== "TooManyFields" && error.code !== "TooFewFields");
  if (fatalErrors.length > 0) {
    return {
      rows: [],
      columns: [],
      sourceName: fileName,
      warnings: [],
      errors: fatalErrors.map((error) => error.message),
    };
  }

  const firstRow = parsed.data[0] ? stringifyRow(parsed.data[0]) : null;
  const columns = parsed.meta.fields ?? (firstRow ? Object.keys(firstRow).filter((key) => key !== "__parsed_extra") : []);
  const rows = parsed.data.map((row) => repairCsvRow(row as Record<string, unknown>, columns));
  const fieldMismatchCount = parsed.errors.length - fatalErrors.length;
  return {
    rows,
    columns,
    sourceName: fileName,
    warnings: fieldMismatchCount > 0
      ? [`CSV field count mismatch found in ${fieldMismatchCount} row${fieldMismatchCount === 1 ? "" : "s"}. Review the preview and column mapping before import.`]
      : [],
    errors: rows.length === 0 ? ["CSV file is empty"] : [],
  };
}

function repairCsvRow(rawRow: Record<string, unknown>, columns: string[]): Record<string, string> {
  const extras = Array.isArray((rawRow as any).__parsed_extra) ? (rawRow as any).__parsed_extra.map((value: unknown) => String(value ?? "")) : [];
  delete (rawRow as any).__parsed_extra;
  const row = stringifyRow(rawRow);
  if (extras.length === 0) return row;

  const amountColumn = matchColumn(columns, AMOUNT_ALIASES);
  if (!amountColumn) return row;
  const amountIndex = columns.indexOf(amountColumn);
  const nextColumn = columns[amountIndex + 1];
  if (!nextColumn) return row;

  const amount = row[amountColumn] ?? "";
  const next = row[nextColumn] ?? "";
  const combined = `${amount},${next}`;
  if (parseAmount(combined) === null) return row;

  row[amountColumn] = combined;
  for (let index = amountIndex + 1; index < columns.length; index++) {
    const column = columns[index];
    const replacement = index === columns.length - 1 ? extras[index - amountIndex - 1] : row[columns[index + 1]];
    if (replacement !== undefined) row[column] = replacement;
  }
  return row;
}

function parseTextPdf(data: ArrayBuffer | Uint8Array | Buffer, fileName: string): ParsedTable {
  const raw = Buffer.from(data as any).toString("latin1");
  const textItems = Array.from(raw.matchAll(/\(([^()]*)\)\s*Tj/g)).map((match) => decodePdfText(match[1]));
  if (textItems.length === 0) {
    return {
      rows: [],
      columns: [],
      sourceName: fileName,
      warnings: [],
      errors: ["Text-based PDF content was not detected. Upload CSV/XLSX or a text-based PDF."],
    };
  }

  const lines = textItems.map((item) => item.trim()).filter(Boolean);
  const rows: Record<string, string>[] = [];
  for (const line of lines) {
    const row = parsePdfTransactionLine(line);
    if (row) rows.push(row);
  }

  return {
    rows,
    columns: ["Date", "Description", "Amount", "Balance"],
    sourceName: fileName,
    warnings: ["PDF text extraction is best-effort. Review the parsed rows before import."],
    errors: rows.length === 0 ? ["No transaction rows were detected in the text-based PDF. Upload CSV/XLSX or remap the source file."] : [],
  };
}

function parsePdfTransactionLine(line: string): Record<string, string> | null {
  const match = line.match(/^(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\s+(.+?)\s+(\(?-?\$?[\d,]+\.\d{2}\)?)\s+(\(?-?\$?[\d,]+\.\d{2}\)?)$/);
  if (!match) return null;
  return {
    Date: match[1],
    Description: match[2].replace(/\s+/g, " ").trim(),
    Amount: match[3],
    Balance: match[4],
  };
}

function decodePdfText(value: string): string {
  return value
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t");
}

function stringifyRow(row: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) out[key] = String(value ?? "");
  return out;
}

function detectColumns(headers: string[]): { mapping: Partial<ColumnMapping>; confidence: "high" | "medium" | "low" } {
  const mapping: Partial<ColumnMapping> = {
    date: matchColumn(headers, DATE_ALIASES),
    description: matchColumn(headers, DESC_ALIASES),
    payee: matchColumn(headers, PAYEE_ALIASES),
    merchantCategory: matchColumn(headers, MERCHANT_ALIASES),
    transactionType: matchColumn(headers, TYPE_ALIASES),
    amount: matchColumn(headers, AMOUNT_ALIASES),
    debit: matchColumn(headers, DEBIT_ALIASES),
    credit: matchColumn(headers, CREDIT_ALIASES),
    balance: matchColumn(headers, BALANCE_ALIASES),
  };
  const found = Object.values(mapping).filter(Boolean).length;
  const hasAmount = !!mapping.amount || (!!mapping.debit && !!mapping.credit);
  return {
    mapping,
    confidence: found >= 4 && hasAmount ? "high" : found >= 3 && hasAmount ? "medium" : "low",
  };
}

function matchColumn(headers: string[], aliases: RegExp[]): string | undefined {
  for (const alias of aliases) {
    const match = headers.find((header) => alias.test(header.trim()));
    if (match) return match;
  }
  return undefined;
}

function importTableRows(
  tableRows: Record<string, string>[],
  sourceName: string,
  fileType: StatementFileType,
  mapping: ColumnMapping,
  taxYear: number
): { rows: XlsxImportRow[]; errors: ImportError[] } {
  const seen = new Set<string>();
  const rows: XlsxImportRow[] = [];
  const errors: ImportError[] = [];

  tableRows.forEach((raw, index) => {
    const rowNumber = index + 1;
    const date = parseDate(raw[mapping.date]);
    if (!date) {
      errors.push({ row: rowNumber, type: "unrecognized_date", message: `Row ${rowNumber}: Unrecognized date "${raw[mapping.date] ?? ""}"` });
      return;
    }

    const rowYear = new Date(`${date}T12:00:00Z`).getUTCFullYear();
    if (rowYear !== taxYear) {
      errors.push({ row: rowNumber, type: "outside_fiscal_year", message: `Row ${rowNumber}: Date ${date} (${rowYear}) is outside fiscal year ${taxYear}. Only ${taxYear} transactions accepted.` });
      return;
    }

    const amount = parseMappedAmount(raw, mapping);
    if (amount === null) {
      errors.push({ row: rowNumber, type: "unrecognized_amount", message: `Row ${rowNumber}: Could not parse amount` });
      return;
    }

    const description = clean(raw[mapping.description]);
    const payee = mapping.payee ? clean(raw[mapping.payee]) : "";
    const merchantCategory = mapping.merchantCategory ? clean(raw[mapping.merchantCategory]) : "";
    const transactionType = mapping.transactionType ? clean(raw[mapping.transactionType]) : "";
    const classificationParts = [payee, description, merchantCategory, transactionType].filter((part, i, arr) => part && arr.indexOf(part) === i);
    const classificationText = classificationParts.join(" | ") || description || payee;
    const displayDescription = description || payee || merchantCategory || transactionType;

    if (!displayDescription) {
      errors.push({ row: rowNumber, type: "incomplete_row", message: `Row ${rowNumber}: Missing description` });
    }

    const key = `${date}|${classificationText}|${amount}`;
    if (seen.has(key)) {
      errors.push({ row: rowNumber, type: "duplicate_transaction", message: `Row ${rowNumber}: Duplicate transaction "${classificationText}" on ${date}` });
      return;
    }
    seen.add(key);

    rows.push({
      date,
      description: displayDescription || "(empty)",
      classificationText: classificationText || "(empty)",
      amount,
      balance: mapping.balance ? parseAmount(raw[mapping.balance]) : null,
      rowIndex: index,
      sheetName: sourceName,
      fileType,
      sourceName,
    });
  });

  return { rows, errors };
}

function parseMappedAmount(raw: Record<string, string>, mapping: ColumnMapping): number | null {
  if (mapping.amount) return parseAmount(raw[mapping.amount]);
  const debit = mapping.debit ? parseAmount(raw[mapping.debit]) ?? 0 : 0;
  const credit = mapping.credit ? parseAmount(raw[mapping.credit]) ?? 0 : 0;
  if (!mapping.debit && !mapping.credit) return null;
  return Math.round((credit - debit) * 100) / 100;
}

function parseAmount(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number") return Math.round(value * 100) / 100;
  const cleaned = String(value).replace(/[$,\s]/g, "").replace(/^\((.*)\)$/, "-$1").replace(/^[−–]/, "-");
  const n = Number(cleaned);
  return Number.isNaN(n) ? null : Math.round(n * 100) / 100;
}

function parseDate(value: unknown): string | null {
  if (!value) return null;
  const s = String(value).trim();
  const date = new Date(s);
  if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);

  const parts = s.split(/[/-]/);
  if (parts.length !== 3) return null;
  let month = Number(parts[0]);
  let day = Number(parts[1]);
  let year = Number(parts[2]);
  if (year < 100) year += 2000;
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}
