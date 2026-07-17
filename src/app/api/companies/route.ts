import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { v4 as uuid } from "uuid";
import { requireUser, UnauthorizedError } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    const rows = await query(
      "SELECT * FROM companies WHERE user_id = $1 ORDER BY legal_name",
      [user.id]
    );
    return NextResponse.json(rows.map((c: any) => ({
      id: c.id,
      legalName: c.legal_name,
      createdAt: c.created_at,
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
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { legalName } = body;
    if (!legalName || !legalName.trim()) {
      return NextResponse.json({ error: "Legal name is required" }, { status: 400 });
    }
    const existing = await queryOne(
      "SELECT id FROM companies WHERE legal_name = $1 AND user_id = $2",
      [legalName.trim(), user.id]
    );
    if (existing) {
      return NextResponse.json({ error: "Company already exists", id: existing.id }, { status: 409 });
    }
    const id = uuid();
    await query(
      "INSERT INTO companies (id, legal_name, user_id) VALUES ($1, $2, $3)",
      [id, legalName.trim(), user.id]
    );
    return NextResponse.json({ id, legalName: legalName.trim(), createdAt: new Date().toISOString() });
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }
}
