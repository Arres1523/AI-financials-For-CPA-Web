import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { v4 as uuid } from "uuid";

export const runtime = "nodejs";

export async function GET() {
  const db = getDb();
  const companies = db.prepare("SELECT * FROM companies ORDER BY legal_name").all();
  return NextResponse.json(companies.map((c: any) => ({
    id: c.id,
    legalName: c.legal_name,
    createdAt: c.created_at,
  })));
}

export async function POST(request: Request) {
  const db = getDb();
  const { legalName } = await request.json();
  if (!legalName || !legalName.trim()) {
    return NextResponse.json({ error: "Legal name is required" }, { status: 400 });
  }
  const existing = db.prepare("SELECT id FROM companies WHERE legal_name = ?").get(legalName.trim());
  if (existing) {
    return NextResponse.json({ error: "Company already exists", id: (existing as any).id }, { status: 409 });
  }
  const id = uuid();
  db.prepare("INSERT INTO companies (id, legal_name) VALUES (?, ?)").run(id, legalName.trim());
  return NextResponse.json({ id, legalName: legalName.trim(), createdAt: new Date().toISOString() });
}
