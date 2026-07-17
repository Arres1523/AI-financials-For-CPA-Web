import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireUser, UnauthorizedError } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");
    const bankAccountId = searchParams.get("bankAccountId");
    const reviewStatus = searchParams.get("reviewStatus");
    const needsReview = searchParams.get("needsReview");

    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
    }

    let sql = `
      SELECT t.*, c.id as c_id, c.final_category, c.report_type, c.confidence, c.rule_used, c.review_status, c.is_manual_correction, c.created_at as c_created_at, c.updated_at as c_updated_at,
             a.account_name, a.bank_name, a.last_four
      FROM transactions t
      LEFT JOIN classifications c ON c.transaction_id = t.id
      LEFT JOIN bank_accounts a ON a.id = t.bank_account_id
      WHERE t.workspace_id = $1 AND t.user_id = $2
    `;
    const params: unknown[] = [workspaceId, user.id];
    let paramIndex = 3;

    if (bankAccountId) {
      sql += ` AND t.bank_account_id = $${paramIndex}`;
      params.push(bankAccountId);
      paramIndex++;
    }

    if (needsReview === "true") {
      sql += ` AND c.review_status IN ('pending', 'support_needed', 'cpa_review', 'card_statements_needed')`;
    }

    if (reviewStatus) {
      sql += ` AND c.review_status = $${paramIndex}`;
      params.push(reviewStatus);
      paramIndex++;
    }

    sql += " ORDER BY t.date ASC, t.original_row_index ASC";

    const rows = await query(sql, params);
    return NextResponse.json(
      rows.map((r: any) => ({
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
        accountName: r.account_name,
        bankName: r.bank_name,
        lastFour: r.last_four,
        classification: r.c_id
          ? {
              id: r.c_id,
              transactionId: r.id,
              finalCategory: r.final_category,
              reportType: r.report_type,
              confidence: r.confidence,
              ruleUsed: r.rule_used,
              reviewStatus: r.review_status,
              isManualCorrection: !!r.is_manual_correction,
              createdAt: r.c_created_at,
              updatedAt: r.c_updated_at,
            }
          : null,
      }))
    );
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }
}
