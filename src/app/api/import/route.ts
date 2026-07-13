import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { v4 as uuid } from "uuid";
import { importRows } from "@/domain/importXlsx";
import { classifyTransaction } from "@/domain/classification";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const workspaceId = formData.get("workspaceId") as string;
  const bankAccountId = formData.get("bankAccountId") as string;
  const taxYear = parseInt(formData.get("taxYear") as string);
  const mappingJson = formData.get("mapping") as string;

  if (!file || !workspaceId || !bankAccountId || !taxYear) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const mapping = JSON.parse(mappingJson);
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const fileName = file.name;

  const { rows, errors: importErrors } = importRows(buffer, fileName, mapping, workspaceId, bankAccountId, taxYear);

  if (rows.length === 0) {
    return NextResponse.json({ imported: 0, errors: importErrors }, { status: 422 });
  }

  const db = getDb();

  const statementId = uuid();
  db.prepare(
    "INSERT INTO uploaded_statements (id, workspace_id, bank_account_id, file_name, total_rows, imported_rows) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(statementId, workspaceId, bankAccountId, fileName, rows.length, rows.length);

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
