import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { v4 as uuid } from "uuid";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const db = getDb();
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

  const txn = db.transaction(() => {
    for (const txId of transactionIds) {
      const existing = db.prepare("SELECT * FROM classifications WHERE transaction_id = ?").get(txId) as any;
      if (!existing) continue;

      let reviewStatus = existing.review_status;
      if (action === "approve") reviewStatus = "approved";
      else if (action === "exclude") reviewStatus = "excluded";

      const updatedCategory = newCategory || existing.final_category;
      const reportType = deriveReportType(updatedCategory);

      db.prepare(
        "UPDATE classifications SET final_category = ?, report_type = ?, review_status = ?, is_manual_correction = 1, updated_at = datetime('now') WHERE transaction_id = ?"
      ).run(updatedCategory, reportType, reviewStatus, txId);

      db.prepare(
        "INSERT INTO review_events (id, transaction_id, action, previous_category, new_category) VALUES (?, ?, ?, ?, ?)"
      ).run(uuid(), txId, action === "approve" ? "approve" : action === "exclude" ? "exclude" : "change_category", existing.final_category, updatedCategory);
    }
  });

  txn();
  return NextResponse.json({ success: true, count: transactionIds.length });
}

function deriveReportType(category: string): "P&L" | "Balance Sheet" {
  const bsCategories = [
    "Transfer Clearing", "Credit Card Liability", "Owner Contributions", "Owner Distributions",
    "Due To Related Parties", "Due From Related Parties", "Loan Liability", "Capital Improvements",
    "Cash",
  ];
  return bsCategories.includes(category) ? "Balance Sheet" : "P&L";
}
