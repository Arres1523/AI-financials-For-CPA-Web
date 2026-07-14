import { NextResponse } from "next/server";
import { query, queryOne, withTransaction } from "@/lib/db";
import { v4 as uuid } from "uuid";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { transactionIds, action, newCategory } = body;

  if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
    return NextResponse.json({ error: "transactionIds array required" }, { status: 400 });
  }

  if (!["approve", "exclude"].includes(action) && !newCategory) {
    return NextResponse.json({ error: "action must be 'approve' or 'exclude', or provide newCategory" }, { status: 400 });
  }

  const count = await withTransaction(async (client) => {
    let processed = 0;
    for (const txId of transactionIds) {
      const { rows } = await client.query("SELECT * FROM classifications WHERE transaction_id = $1", [txId]);
      if (rows.length === 0) continue;

      const existing = rows[0];
      let reviewStatus = existing.review_status;
      if (action === "approve") reviewStatus = "approved";
      else if (action === "exclude") reviewStatus = "excluded";

      const updatedCategory = newCategory || existing.final_category;
      const reportType = deriveReportType(updatedCategory);

      await client.query(
        "UPDATE classifications SET final_category = $1, report_type = $2, review_status = $3, is_manual_correction = 1, updated_at = NOW() WHERE transaction_id = $4",
        [updatedCategory, reportType, reviewStatus, txId]
      );

      await client.query(
        "INSERT INTO review_events (id, transaction_id, action, previous_category, new_category) VALUES ($1, $2, $3, $4, $5)",
        [uuid(), txId, action === "approve" ? "approve" : action === "exclude" ? "exclude" : "change_category", existing.final_category, updatedCategory]
      );
      processed++;
    }
    return processed;
  });

  return NextResponse.json({ success: true, count });
}

function deriveReportType(category: string): "P&L" | "Balance Sheet" {
  const bsCategories = [
    "Transfer Clearing", "Credit card payable", "Capital contributions", "Member distributions",
    "Due to related parties", "Due from related parties", "Loan Liability", "Capital Improvements",
    "Cash", "Wire Transfers",
  ];
  return bsCategories.includes(category) ? "Balance Sheet" : "P&L";
}
