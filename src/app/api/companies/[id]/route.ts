import { NextResponse } from "next/server";
import { queryOne, execute } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const company = await queryOne("SELECT * FROM companies WHERE id = $1", [id]);
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ id: company.id, legalName: company.legal_name, createdAt: company.created_at });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await execute("DELETE FROM companies WHERE id = $1", [id]);
  return NextResponse.json({ success: true });
}
