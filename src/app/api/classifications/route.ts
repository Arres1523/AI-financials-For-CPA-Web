import { NextResponse } from "next/server";
import { query, queryOne, withTransaction } from "@/lib/db";
import { v4 as uuid } from "uuid";
import { CATEGORY_OPTIONS } from "@/domain/categoryOptions";
import type { ReviewAction, ReviewStatus, TransactionCorrection } from "@/domain/types";
import { requireUser, UnauthorizedError } from "@/lib/require-user";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { transactionIds, action, newCategory, reviewStatus, note, correction } = body as {
      transactionIds: string[];
      action: ReviewAction;
      newCategory?: string;
      reviewStatus?: ReviewStatus;
      note?: string;
      correction?: TransactionCorrection;
    };

    if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
      return NextResponse.json({ error: "transactionIds array required" }, { status: 400 });
    }

    const allowedActions: ReviewAction[] = ["approve", "exclude", "change_category", "mark_support_needed", "mark_cpa_review", "correct_transaction"];
    if (!allowedActions.includes(action)) {
      return NextResponse.json({ error: "Invalid classification action" }, { status: 400 });
    }

    if (action === "change_category" && !newCategory) {
      return NextResponse.json({ error: "newCategory required for change_category" }, { status: 400 });
    }

    const count = await withTransaction(async (client) => {
      let processed = 0;
      for (const txId of transactionIds) {
        const { rows } = await client.query(
          "SELECT c.* FROM classifications c JOIN transactions t ON t.id = c.transaction_id WHERE c.transaction_id = $1 AND t.user_id = $2",
          [txId, user.id]
        );
        if (rows.length === 0) continue;

        const existing = rows[0];
        const previousStatus = existing.review_status;
        let nextReviewStatus = previousStatus;
        if (action === "approve") nextReviewStatus = "approved";
        else if (action === "exclude") nextReviewStatus = "excluded";
        else if (action === "mark_support_needed") nextReviewStatus = "support_needed";
        else if (action === "mark_cpa_review") nextReviewStatus = "cpa_review";
        else if (reviewStatus) nextReviewStatus = reviewStatus;

        const updatedCategory = newCategory || existing.final_category;
        const reportType = deriveReportType(updatedCategory);

        await client.query(
          "UPDATE classifications SET final_category = $1, report_type = $2, review_status = $3, is_manual_correction = 1, updated_at = NOW() WHERE transaction_id = $4",
          [updatedCategory, reportType, nextReviewStatus, txId]
        );

        if (action === "correct_transaction" && correction) {
          const updates: string[] = [];
          const params: unknown[] = [];
          if (correction.date) {
            params.push(correction.date);
            updates.push(`date = $${params.length}`);
          }
          if (correction.description) {
            params.push(correction.description);
            updates.push(`description = $${params.length}`);
          }
          if (typeof correction.amount === "number") {
            params.push(correction.amount);
            updates.push(`amount = $${params.length}`);
          }
          if (updates.length > 0) {
            params.push(txId, user.id);
            await client.query(`UPDATE transactions SET ${updates.join(", ")} WHERE id = $${params.length - 1} AND user_id = $${params.length}`, params);
          }
        }

        await client.query(
          "INSERT INTO review_events (id, transaction_id, action, previous_category, new_category, previous_status, new_status, note, correction_json, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
          [
            uuid(),
            txId,
            action === "approve" || action === "exclude" ? action : newCategory ? "change_category" : action,
            existing.final_category,
            updatedCategory,
            previousStatus,
            nextReviewStatus,
            note || null,
            correction ? JSON.stringify(correction) : null,
            user.id,
          ]
        );
        processed++;
      }
      return processed;
    });

    return NextResponse.json({ success: true, count });
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }
}

function deriveReportType(category: string): "P&L" | "Balance Sheet" {
  const found = CATEGORY_OPTIONS.find((o) => o.value === category);
  if (found) return found.reportType;
  return "Balance Sheet";
}
