import { NextResponse } from "next/server";
import { queryOne, execute } from "@/lib/db";
import { requireUser, UnauthorizedError } from "@/lib/auth";

export const runtime = "nodejs";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { accountName, bankName, lastFour, accountType, openingBalance, closingBalance } = body;
    if (!accountName || !bankName || !lastFour) {
      return NextResponse.json({
        error: "accountName, bankName, lastFour are required"
      }, { status: 400 });
    }
    const existing = await queryOne(
      "SELECT id FROM bank_accounts WHERE id = $1 AND user_id = $2",
      [id, user.id]
    );
    if (!existing) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }
    await execute(
      "UPDATE bank_accounts SET account_name = $1, bank_name = $2, last_four = $3, account_type = $4, opening_balance = $5, closing_balance = $6 WHERE id = $7 AND user_id = $8",
      [accountName, bankName, lastFour, accountType, openingBalance ?? 0, closingBalance ?? 0, id, user.id]
    );
    const row = await queryOne(
      "SELECT * FROM bank_accounts WHERE id = $1 AND user_id = $2",
      [id, user.id]
    );
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
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await execute("DELETE FROM bank_accounts WHERE id = $1 AND user_id = $2", [id, user.id]);
    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }
}
