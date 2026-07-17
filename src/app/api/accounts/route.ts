import { NextResponse } from "next/server";
import { query, execute } from "@/lib/db";
import { v4 as uuid } from "uuid";
import { requireUser, UnauthorizedError } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    if (!companyId) {
      return NextResponse.json({ error: "companyId required" }, { status: 400 });
    }
    const rows = await query(
      "SELECT * FROM bank_accounts WHERE company_id = $1 AND user_id = $2 ORDER BY account_name",
      [companyId, user.id]
    );
    return NextResponse.json(
      rows.map((a: any) => ({
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
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { companyId, accountName, bankName, lastFour, accountType, openingBalance, closingBalance } = body;
    if (!companyId || !accountName || !bankName || !lastFour) {
      return NextResponse.json({
        error: "companyId, accountName, bankName, lastFour are required"
      }, { status: 400 });
    }
    const id = uuid();
    await execute(
      "INSERT INTO bank_accounts (id, company_id, account_name, bank_name, last_four, account_type, opening_balance, closing_balance, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
      [id, companyId, accountName, bankName, lastFour, accountType || "Checking", openingBalance || 0, closingBalance || 0, user.id]
    );
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
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }
}
