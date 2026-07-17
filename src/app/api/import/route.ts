import { NextResponse } from "next/server";
import { query, queryOne, withTransaction } from "@/lib/db";
import { v4 as uuid } from "uuid";
import { importRows, hashFile } from "@/domain/importXlsx";
import type { ColumnMapping } from "@/domain/types";
import { classifyTransaction } from "@/domain/classification";
import { z } from "zod";
import { requireUser, UnauthorizedError } from "@/lib/auth";

export const runtime = "nodejs";

const mappingSchema = z.object({
  date: z.string().min(1, "Date column required"),
  description: z.string().min(1, "Description column required"),
  payee: z.string().optional(),
  amount: z.string().optional(),
  debit: z.string().optional(),
  credit: z.string().optional(),
  balance: z.string().optional(),
}).refine(
  (d) => d.amount || (d.debit && d.credit),
  { message: "Either amount or both debit+credit must be specified" }
);

export async function POST(request: Request) {
  try {
    const user = await requireUser();
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

    const existingStmt = await queryOne(
      "SELECT id, imported_rows FROM uploaded_statements WHERE workspace_id = $1 AND file_hash = $2 AND user_id = $3",
      [workspaceId, fileHash, user.id]
    );

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

    const imported = await withTransaction(async (client) => {
      await client.query(
        "INSERT INTO uploaded_statements (id, workspace_id, bank_account_id, file_name, sheet_name, total_rows, imported_rows, file_hash, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
        [statementId, workspaceId, bankAccountId, fileName, rows[0]?.sheetName || null, rows.length, rows.length, fileHash, user.id]
      );

      let count = 0;
      for (const row of rows) {
        const txId = uuid();
        const descForClassification = row.classificationText || row.description;
        await client.query(
          "INSERT INTO transactions (id, workspace_id, bank_account_id, statement_id, date, description, amount, balance, original_row_index, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
          [txId, workspaceId, bankAccountId, statementId, row.date, row.description, row.amount, row.balance, row.rowIndex, user.id]
        );
        const classification = classifyTransaction({
          id: txId,
          workspaceId,
          bankAccountId,
          statementId,
          date: row.date,
          description: descForClassification,
          amount: row.amount,
          balance: row.balance,
          originalRowIndex: row.rowIndex,
          createdAt: new Date().toISOString(),
        });
        await client.query(
          "INSERT INTO classifications (id, transaction_id, final_category, report_type, confidence, rule_used, review_status, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
          [classification.id, txId, classification.finalCategory, classification.reportType, classification.confidence, classification.ruleUsed, classification.reviewStatus, user.id]
        );
        count++;
      }
      return count;
    });

    return NextResponse.json({
      imported,
      statementId,
      errors: importErrors,
    });
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }
}
