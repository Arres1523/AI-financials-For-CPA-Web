import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const { accountName, bankName, lastFour, accountType, openingBalance, closingBalance } = await request.json();
  db.prepare(
    "UPDATE bank_accounts SET account_name = ?, bank_name = ?, last_four = ?, account_type = ?, opening_balance = ?, closing_balance = ? WHERE id = ?"
  ).run(accountName, bankName, lastFour, accountType, openingBalance ?? 0, closingBalance ?? 0, id);
  const row = db.prepare("SELECT * FROM bank_accounts WHERE id = ?").get(id) as any;
  return NextResponse.json({
    id: row.id,
    companyId: row.company_id,
    accountName: row.account_name,
    bankName: row.bank_name,
    lastFour: row.last_four,
    accountType: row.account_type,
    openingBalance: row.opening_balance,
    closingBalance: row.closing_balance,
    createdAt: row.created_at,
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  db.prepare("DELETE FROM bank_accounts WHERE id = ?").run(id);
  return NextResponse.json({ success: true });
}
