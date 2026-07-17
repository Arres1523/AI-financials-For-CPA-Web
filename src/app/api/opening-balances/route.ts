import { NextResponse } from "next/server";
import { query, execute } from "@/lib/db";
import { v4 as uuid } from "uuid";
import { requireUser, UnauthorizedError } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
    }
    const rows = await query(
      "SELECT * FROM opening_balance_entries WHERE workspace_id = $1 AND user_id = $2",
      [workspaceId, user.id]
    );
    return NextResponse.json(rows.map((r: any) => ({
      id: r.id,
      workspaceId: r.workspace_id,
      accountName: r.account_name,
      accountType: r.account_type,
      amount: r.amount,
      source: r.source,
      supportStatus: r.support_status,
    })));
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    let body;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
    const { workspaceId, entries } = body;
    if (!workspaceId || !entries) return NextResponse.json({ error: "workspaceId and entries required" }, { status: 400 });
    await execute(
      "DELETE FROM opening_balance_entries WHERE workspace_id = $1 AND user_id = $2",
      [workspaceId, user.id]
    );
    for (const e of entries) {
      await execute(
        "INSERT INTO opening_balance_entries (id, workspace_id, account_name, account_type, amount, source, support_status, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        [uuid(), workspaceId, e.accountName, e.accountType, e.amount, e.source || "manual", e.supportStatus || "provided", user.id]
      );
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }
}
