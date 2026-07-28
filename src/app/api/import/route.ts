import { NextResponse } from "next/server";
import { query, queryOne, withTransaction } from "@/lib/db";
import { v4 as uuid } from "uuid";
import { hashFile } from "@/domain/importXlsx";
import { detectStatementFileType, importStatementRows } from "@/domain/statementImport";
import type { ColumnMapping, PreclassificationOverride } from "@/domain/types";
import { classifyTransaction } from "@/domain/classification";
import { applyCompanyClassificationRules } from "@/domain/classificationRules";
import { applyPreclassificationOverride } from "@/domain/importPreclassification";
import { z } from "zod";
import { requireUser, UnauthorizedError } from "@/lib/require-user";

export const runtime = "nodejs";

const mappingSchema = z.object({
  date: z.string().min(1, "Date column required"),
  description: z.string().min(1, "Description column required"),
  payee: z.string().optional(),
  merchantCategory: z.string().optional(),
  transactionType: z.string().optional(),
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
    const overridesJson = formData.get("overrides") as string | null;

    if (!file || !workspaceId || !bankAccountId || !taxYear) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    let overrides: PreclassificationOverride[] = [];
    if (overridesJson) {
      try {
        const parsed = JSON.parse(overridesJson);
        overrides = Array.isArray(parsed) ? parsed : [];
      } catch {
        return NextResponse.json({ error: "Invalid overrides JSON" }, { status: 400 });
      }
    }
    const overridesByRow = new Map(overrides.map((override) => [override.rowIndex, override]));

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
    const fileType = detectStatementFileType(fileName);
    if (!fileType) {
      return NextResponse.json({ error: "Only .csv, .xlsx, and text-based .pdf files are accepted" }, { status: 400 });
    }
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

    const { rows, errors: importErrors } = importStatementRows(buffer, fileName, mapping, workspaceId, bankAccountId, taxYear);

    if (rows.length === 0) {
      return NextResponse.json({ imported: 0, statementId: null, errors: importErrors }, { status: 422 });
    }

    const statementId = uuid();
    const workspace = await queryOne(
      "SELECT company_id FROM workspaces WHERE id = $1 AND user_id = $2",
      [workspaceId, user.id]
    );
    const companyRules = workspace ? await queryCompanyRules(workspace.company_id, user.id) : [];

    const imported = await withTransaction(async (client) => {
      await client.query(
        "INSERT INTO uploaded_statements (id, workspace_id, bank_account_id, file_name, sheet_name, total_rows, imported_rows, file_hash, user_id, file_type, source_name, parser_version) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)",
        [statementId, workspaceId, bankAccountId, fileName, rows[0]?.sheetName || null, rows.length, rows.length, fileHash, user.id, fileType, rows[0]?.sourceName || rows[0]?.sheetName || null, "statement-import-v2"]
      );

      let count = 0;
      for (const row of rows) {
        const txId = uuid();
        const descForClassification = row.classificationText || row.description;
        await client.query(
          "INSERT INTO transactions (id, workspace_id, bank_account_id, statement_id, date, description, amount, balance, original_row_index, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
          [txId, workspaceId, bankAccountId, statementId, row.date, row.description, row.amount, row.balance, row.rowIndex, user.id]
        );
        const txForClassification = {
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
        };
        const classification = applyPreclassificationOverride(
          applyCompanyClassificationRules(classifyTransaction(txForClassification), txForClassification, companyRules),
          overridesByRow.get(row.rowIndex)
        );
        await client.query(
          "INSERT INTO classifications (id, transaction_id, final_category, report_type, confidence, rule_used, review_status, is_manual_correction, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
          [classification.id, txId, classification.finalCategory, classification.reportType, classification.confidence, classification.ruleUsed, classification.reviewStatus, classification.isManualCorrection ? 1 : 0, user.id]
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

async function queryCompanyRules(companyId: string, userId: string) {
  const rows = await query(
    `SELECT id, company_id, pattern, direction, category, report_type, priority, created_at
     FROM classification_rules
     WHERE company_id = $1 AND user_id = $2
     ORDER BY priority DESC, created_at ASC`,
    [companyId, userId]
  );
  return rows.map((row: any) => ({
    id: row.id,
    companyId: row.company_id,
    pattern: row.pattern,
    direction: row.direction ?? "any",
    finalCategory: row.category,
    reportType: row.report_type,
    priority: row.priority ?? 0,
    createdAt: row.created_at,
  }));
}
