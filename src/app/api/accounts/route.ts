import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { v4 as uuid } from "uuid";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");
  if (!companyId) return NextResponse.json({ error: "companyId required" }, { status: 400 });
  const db = getDb();
  const accounts = db.prepare("SELECT * FROM bank_accounts WHERE company_id = ? ORDER BY account_name").all(companyId);
  return NextResponse.json(
    accounts.map((a: any) => ({
      id: a.id,
      companyId: a.company_id,
      accountName: a.account_name,
      bankName: a.bank_name,
      lastFour: a.last_four,
      accountType: a.account_type,
      openingBalance: a.opening_balance,
      closingBalance: a.closing_balance,
      createdAt: a.created_at,
    }))
  );
}

export async function POST(request: Request) {
  const db = getDb();
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { companyId, accountName, bankName, lastFour, accountType, openingBalance, closingBalance } = body;
  if (!companyId || !accountName || !bankName || !lastFour) {
    return NextResponse.json({ error: "companyId, accountName, bankName, lastFour are required" }, { status: 400 });
  }
  const id = uuid();
  db.prepare(
    "INSERT INTO bank_accounts (id, company_id, account_name, bank_name, last_four, account_type, opening_balance, closing_balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(id, companyId, accountName, bankName, lastFour, accountType || "Checking", openingBalance || 0, closingBalance || 0);
  return NextResponse.json({
    id,
    companyId,
    accountName,
    bankName,
    lastFour,
    accountType: accountType || "Checking",
    openingBalance: openingBalance || 0,
    closingBalance: closingBalance || 0,
    createdAt: new Date().toISOString(),
  });
}
