import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { v4 as uuid } from "uuid";
import { importRows, hashFile } from "@/domain/importXlsx";
import type { ColumnMapping } from "@/domain/types";
import { classifyTransaction } from "@/domain/classification";
import { z } from "zod";

export const runtime = "nodejs";

const mappingSchema = z.object({
  date: z.string().min(1, "Date column required"),
  description: z.string().min(1, "Description column required"),
  amount: z.string().optional(),
  debit: z.string().optional(),
  credit: z.string().optional(),
  balance: z.string().optional(),
}).refine(
  (d) => d.amount || (d.debit && d.credit),
  { message: "Either amount or both debit+credit must be specified" }
);

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const workspaceId = formData.get("workspaceId") as string;
  const bankAccountId = formData.get("bankAccountId") as string;
  const taxYear = parseInt(formData.get("taxYear") as string);
  const mappingJson = formData.get("mapping") as string;

  if (!file || !workspaceId || !bankAccountId || !taxYear) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  let mapping: ColumnMapping;
  try {
    mapping = mappingSchema.parse(JSON.parse(mappingJson));
  } catch (err: any) {
    const message = err instanceof z.ZodError ? err.errors.map((e: any) => e.message).join("; ") : "Invalid column mapping JSON";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const fileName = file.name;
  const fileHash = hashFile(buffer);

  const db = getDb();

  // Check for duplicate file hash
  const existingStmt = db.prepare(
    "SELECT id, imported_rows FROM uploaded_statements WHERE workspace_id = ? AND file_hash = ?"
  ).get(workspaceId, fileHash) as any;

  if (existingStmt) {
    return NextResponse.json({
      imported: 0,
      existingStatementId: existingStmt.id,
      errors: [{ row: 0, type: "duplicate_statement", message: `File "${fileName}" was already imported (${existingStmt.imported_rows} rows)` }],
    }, { status: 409 });
  }

  const { rows, errors: importErrors } = importRows(buffer, fileName, mapping, workspaceId, bankAccountId, taxYear);

  if (rows.length === 0) {
    return NextResponse.json({ imported: 0, statementId: null, errors: importErrors }, { status: 422 });
  }

  const statementId = uuid();
  db.prepare(
    "INSERT INTO uploaded_statements (id, workspace_id, bank_account_id, file_name, sheet_name, total_rows, imported_rows, file_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(statementId, workspaceId, bankAccountId, fileName, rows[0]?.sheetName || null, rows.length, rows.length, fileHash);

  const insertTx = db.prepare(
    "INSERT INTO transactions (id, workspace_id, bank_account_id, statement_id, date, description, amount, balance, original_row_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );
  const insertCl = db.prepare(
    "INSERT INTO classifications (id, transaction_id, final_category, report_type, confidence, rule_used, review_status) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );

  const txn = db.transaction(() => {
    let imported = 0;
    for (const row of rows) {
      const txId = uuid();
      insertTx.run(txId, workspaceId, bankAccountId, statementId, row.date, row.description, row.amount, row.balance, row.rowIndex);
      const classification = classifyTransaction({
        id: txId,
        workspaceId,
        bankAccountId,
        statementId,
        date: row.date,
        description: row.description,
        amount: row.amount,
        balance: row.balance,
        originalRowIndex: row.rowIndex,
        createdAt: new Date().toISOString(),
      });
      insertCl.run(
        classification.id,
        txId,
        classification.finalCategory,
        classification.reportType,
        classification.confidence,
        classification.ruleUsed,
        classification.reviewStatus
      );
      imported++;
    }
    return imported;
  });

  const imported = txn();

  return NextResponse.json({
    imported,
    statementId,
    errors: importErrors,
  });
}
