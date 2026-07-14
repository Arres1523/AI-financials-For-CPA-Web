import { NextResponse } from "next/server";
import { query, execute } from "@/lib/db";
import { v4 as uuid } from "uuid";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  const rows = await query("SELECT * FROM opening_balance_entries WHERE workspace_id = $1", [workspaceId]);
  return NextResponse.json(rows.map((r: any) => ({
    id: r.id,
    workspaceId: r.workspace_id,
    accountName: r.account_name,
    accountType: r.account_type,
    amount: r.amount,
    source: r.source,
    supportStatus: r.support_status,
  })));
}

export async function POST(request: Request) {
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const { workspaceId, entries } = body;
  if (!workspaceId || !entries) return NextResponse.json({ error: "workspaceId and entries required" }, { status: 400 });
  await execute("DELETE FROM opening_balance_entries WHERE workspace_id = $1", [workspaceId]);
  for (const e of entries) {
    await execute(
      "INSERT INTO opening_balance_entries (id, workspace_id, account_name, account_type, amount, source, support_status) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [uuid(), workspaceId, e.accountName, e.accountType, e.amount, e.source || "manual", e.supportStatus || "provided"]
    );
  }
  return NextResponse.json({ success: true });
}
