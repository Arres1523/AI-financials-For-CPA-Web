import { NextResponse } from "next/server";
import { query, queryOne, execute } from "@/lib/db";
import { buildReportsFromClassifications } from "@/domain/reporting";
import { buildWorkbookBuffer } from "@/exports/workbook";
import { v4 as uuid } from "uuid";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: { workspaceId: string; includeTransactions: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }

  const ws = await queryOne(`
    SELECT w.*, c.legal_name FROM workspaces w
    JOIN companies c ON c.id = w.company_id
    WHERE w.id = $1
  `, [body.workspaceId]);

  if (!ws) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const companyName = ws.legal_name;
  const taxYear = ws.tax_year;

  const txRows = await query(`
    SELECT t.*, c.final_category, c.report_type, c.confidence, c.rule_used, c.review_status
    FROM transactions t
    JOIN classifications c ON c.transaction_id = t.id
    WHERE t.workspace_id = $1 AND c.review_status != 'excluded'
    ORDER BY t.date ASC, t.original_row_index ASC
  `, [body.workspaceId]);

  const transactions = txRows.map((r: any) => ({
    id: r.id,
    workspaceId: r.workspace_id,
    bankAccountId: r.bank_account_id,
    statementId: r.statement_id,
    date: r.date,
    description: r.description,
    amount: r.amount,
    balance: r.balance,
    originalRowIndex: r.original_row_index,
    createdAt: r.created_at,
  }));

  const classifications = txRows.map((r: any) => ({
    id: r.id,
    transactionId: r.id,
    finalCategory: r.final_category,
    reportType: r.report_type,
    confidence: r.confidence,
    ruleUsed: r.rule_used,
    reviewStatus: r.review_status,
    isManualCorrection: false,
    createdAt: r.created_at,
    updatedAt: r.created_at,
  }));

  const joined = transactions.map((t: any, i: number) => ({
    transaction: t,
    classification: classifications[i],
  }));

  const reports = buildReportsFromClassifications(companyName, taxYear, joined);

  const flaggedTransactions = transactions.filter((_: any, i: number) =>
    classifications[i]?.reviewStatus === "pending" ||
    classifications[i]?.confidence === "low"
  );

  const accountReconData = await query(`
    SELECT a.id, a.account_name, a.opening_balance, a.closing_balance,
           COALESCE(SUM(t.amount), 0) as movement_total
    FROM bank_accounts a
    LEFT JOIN transactions t ON t.bank_account_id = a.id AND t.workspace_id = $1
    WHERE a.company_id = (SELECT company_id FROM workspaces WHERE id = $2)
    GROUP BY a.id
  `, [body.workspaceId, body.workspaceId]);

  const buffer = await buildWorkbookBuffer({
    companyName,
    taxYear,
    transactions,
    classifications,
    reports,
    flaggedTransactions,
    accountReconData,
    includeTransactions: body.includeTransactions ?? false,
  });

  // Register export
  await execute(
    "INSERT INTO report_exports (id, workspace_id, export_type) VALUES ($1, $2, $3)",
    [uuid(), body.workspaceId, body.includeTransactions ? "with_transactions" : "financial_only"]
  );

  // Do NOT mark workspace as completed — exports are preliminary drafts
  const responseBody = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  const suffix = body.includeTransactions ? "_with_transactions" : "";

  return new NextResponse(responseBody, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${companyName.replace(/\s+/g, "_")}_${taxYear}_Financial_Statements${suffix}.xlsx`
    },
  });
}
