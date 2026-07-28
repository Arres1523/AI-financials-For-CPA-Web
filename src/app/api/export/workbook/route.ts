import { NextResponse } from "next/server";
import { query, queryOne, execute } from "@/lib/db";
import { buildFinancialReport } from "@/domain/reporting";
import { buildWorkbookBuffer } from "@/exports/workbook";
import { v4 as uuid } from "uuid";
import { requireUser, UnauthorizedError } from "@/lib/require-user";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
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
      WHERE w.id = $1 AND w.user_id = $2
    `, [body.workspaceId, user.id]);

    if (!ws) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const companyName = ws.legal_name;
    const taxYear = ws.tax_year;

    const txRows = await query(`
      SELECT t.*, c.final_category, c.report_type, c.confidence, c.rule_used, c.review_status
      FROM transactions t
      JOIN classifications c ON c.transaction_id = t.id
      WHERE t.workspace_id = $1 AND t.user_id = $2 AND c.review_status != 'excluded'
      ORDER BY t.date ASC, t.original_row_index ASC
    `, [body.workspaceId, user.id]);

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

    const accounts = await query(
      "SELECT * FROM bank_accounts WHERE company_id = (SELECT company_id FROM workspaces WHERE id = $1) AND user_id = $2",
      [body.workspaceId, user.id]
    );
    const typedAccounts = accounts.map((a: any) => ({
      id: a.id,
      accountName: a.account_name,
      bankName: a.bank_name,
      lastFour: a.last_four,
      accountType: a.account_type,
      openingBalance: a.opening_balance,
      closingBalance: a.closing_balance,
      companyId: a.company_id,
      createdAt: a.created_at,
    }));

    const reports = buildFinancialReport(companyName, taxYear, typedAccounts, transactions, classifications);

    const flaggedTransactions = transactions.filter((_: any, i: number) => {
      const s = classifications[i]?.reviewStatus;
      return (s && !["approved", "excluded"].includes(s)) ||
        classifications[i]?.confidence === "low";
    });

    const accountReconData = await query(`
      SELECT a.id, a.account_name, a.opening_balance, a.closing_balance,
             COALESCE(SUM(t.amount), 0) as movement_total
      FROM bank_accounts a
      LEFT JOIN transactions t ON t.bank_account_id = a.id AND t.workspace_id = $1 AND t.user_id = $2
      WHERE a.company_id = (SELECT company_id FROM workspaces WHERE id = $3) AND a.user_id = $4
      GROUP BY a.id
    `, [body.workspaceId, user.id, body.workspaceId, user.id]);

    const statementRows = await query(`
      SELECT file_name, file_type, source_name, imported_rows, uploaded_at
      FROM uploaded_statements
      WHERE workspace_id = $1 AND user_id = $2
      ORDER BY uploaded_at ASC
    `, [body.workspaceId, user.id]);

    const buffer = await buildWorkbookBuffer({
      companyName,
      taxYear,
      transactions,
      classifications,
      reports,
      flaggedTransactions,
      accountReconData,
      statementFiles: statementRows.map((row: any) => ({
        fileName: row.file_name,
        fileType: row.file_type,
        sourceName: row.source_name,
        importedRows: row.imported_rows,
        uploadedAt: row.uploaded_at,
      })),
      includeTransactions: body.includeTransactions ?? false,
    });

    await execute(
      "INSERT INTO report_exports (id, workspace_id, export_type, user_id) VALUES ($1, $2, $3, $4)",
      [uuid(), body.workspaceId, body.includeTransactions ? "with_transactions" : "financial_only", user.id]
    );

    const responseBody = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    const suffix = body.includeTransactions ? "_with_transactions" : "";

    return new NextResponse(responseBody, {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="${companyName.replace(/\s+/g, "_")}_${taxYear}_Financial_Statements${suffix}.xlsx`
      },
    });
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }
}
