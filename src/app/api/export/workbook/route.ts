import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { buildReportsFromClassifications } from "@/domain/reporting";
import { buildWorkbookBuffer } from "@/exports/workbook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json() as {
    workspaceId: string;
    companyName: string;
    taxYear: number;
    includeTransactions: boolean;
  };

  const db = getDb();

  const txRows = db.prepare(`
    SELECT t.*, c.final_category, c.report_type, c.confidence, c.rule_used, c.review_status
    FROM transactions t
    JOIN classifications c ON c.transaction_id = t.id
    WHERE t.workspace_id = ? AND c.review_status != 'excluded'
    ORDER BY t.date ASC, t.original_row_index ASC
  `).all(body.workspaceId) as any[];

  const transactions = txRows.map((r) => ({
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

  const classifications = txRows.map((r) => ({
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

  const joined = transactions.map((t, i) => ({
    transaction: t,
    classification: classifications[i],
  }));

  const reports = buildReportsFromClassifications(body.companyName, body.taxYear, joined);

  const flaggedTransactions = transactions.filter((_, i) =>
    classifications[i]?.reviewStatus === "pending" ||
    classifications[i]?.confidence === "low"
  );

  const accountReconData = db.prepare(`
    SELECT a.id, a.account_name, a.opening_balance, a.closing_balance,
           COALESCE(SUM(t.amount), 0) as movement_total
    FROM bank_accounts a
    LEFT JOIN transactions t ON t.bank_account_id = a.id AND t.workspace_id = ?
    WHERE a.company_id = (SELECT company_id FROM workspaces WHERE id = ?)
    GROUP BY a.id
  `).all(body.workspaceId, body.workspaceId) as any[];

  const buffer = await buildWorkbookBuffer({
    companyName: body.companyName,
    taxYear: body.taxYear,
    transactions,
    classifications,
    reports,
    flaggedTransactions,
    accountReconData,
    includeTransactions: body.includeTransactions,
  });

  const responseBody = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  const suffix = body.includeTransactions ? "_with_transactions" : "";

  return new NextResponse(responseBody, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${body.companyName.replace(/\s+/g, "_")}_${body.taxYear}_Financial_Statements${suffix}.xlsx`
    }
  });
}
