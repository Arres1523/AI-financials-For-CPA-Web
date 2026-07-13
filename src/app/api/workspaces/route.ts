import { NextResponse } from "next/server";
import { query, queryOne, execute } from "@/lib/db";
import { v4 as uuid } from "uuid";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");
  let rows: any[];
  if (companyId) {
    rows = await query("SELECT * FROM workspaces WHERE company_id = $1 ORDER BY tax_year DESC", [companyId]);
  } else {
    rows = await query("SELECT * FROM workspaces ORDER BY created_at DESC");
  }
  return NextResponse.json(
    rows.map((w: any) => ({
      id: w.id,
      companyId: w.company_id,
      taxYear: w.tax_year,
      status: w.status,
      createdAt: w.created_at,
      updatedAt: w.updated_at,
    }))
  );
}

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { companyId, taxYear } = body;
  if (!companyId || !taxYear) {
    return NextResponse.json({ error: "companyId and taxYear are required" }, { status: 400 });
  }
  const existing = await queryOne("SELECT id FROM workspaces WHERE company_id = $1 AND tax_year = $2", [companyId, taxYear]);
  if (existing) {
    return NextResponse.json({ error: "Workspace already exists", id: existing.id }, { status: 409 });
  }
  const id = uuid();
  await execute("INSERT INTO workspaces (id, company_id, tax_year) VALUES ($1, $2, $3)", [id, companyId, taxYear]);
  const row = await queryOne("SELECT * FROM workspaces WHERE id = $1", [id]);
  return NextResponse.json({
    id: row.id,
    companyId: row.company_id,
    taxYear: row.tax_year,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export async function PUT(request: Request) {
  const { id, status } = await request.json();
  await execute("UPDATE workspaces SET status = $1, updated_at = NOW() WHERE id = $2", [status, id]);
  const row = await queryOne("SELECT * FROM workspaces WHERE id = $1", [id]);
  return NextResponse.json({
    id: row.id,
    companyId: row.company_id,
    taxYear: row.tax_year,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}
