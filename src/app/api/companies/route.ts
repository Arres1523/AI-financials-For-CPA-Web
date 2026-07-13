import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { v4 as uuid } from "uuid";

export const runtime = "nodejs";

export async function GET() {
  const rows = await query("SELECT * FROM companies ORDER BY legal_name");
  return NextResponse.json(rows.map((c: any) => ({
    id: c.id,
    legalName: c.legal_name,
    createdAt: c.created_at,
  })));
}

export async function POST(request: Request) {
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
  const existing = await queryOne("SELECT id FROM companies WHERE legal_name = $1", [legalName.trim()]);
  if (existing) {
    return NextResponse.json({ error: "Company already exists", id: existing.id }, { status: 409 });
  }
  const id = uuid();
  await query("INSERT INTO companies (id, legal_name) VALUES ($1, $2)", [id, legalName.trim()]);
  return NextResponse.json({ id, legalName: legalName.trim(), createdAt: new Date().toISOString() });
}
