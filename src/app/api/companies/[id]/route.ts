import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const company = db.prepare("SELECT * FROM companies WHERE id = ?").get(id) as any;
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ id: company.id, legalName: company.legal_name, createdAt: company.created_at });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  db.prepare("DELETE FROM companies WHERE id = ?").run(id);
  return NextResponse.json({ success: true });
}
