import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { v4 as uuid } from "uuid";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");
  const db = getDb();
  let workspaces: any[];
  if (companyId) {
    workspaces = db.prepare("SELECT * FROM workspaces WHERE company_id = ? ORDER BY tax_year DESC").all(companyId);
  } else {
    workspaces = db.prepare("SELECT * FROM workspaces ORDER BY created_at DESC").all();
  }
  return NextResponse.json(
    workspaces.map((w: any) => ({
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
  const db = getDb();
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
  const existing = db.prepare("SELECT id FROM workspaces WHERE company_id = ? AND tax_year = ?").get(companyId, taxYear);
  if (existing) {
    return NextResponse.json({ error: "Workspace already exists", id: (existing as any).id }, { status: 409 });
  }
  const id = uuid();
  db.prepare("INSERT INTO workspaces (id, company_id, tax_year) VALUES (?, ?, ?)").run(id, companyId, taxYear);
  const row = db.prepare("SELECT * FROM workspaces WHERE id = ?").get(id) as any;
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
  const db = getDb();
  const { id, status } = await request.json();
  db.prepare("UPDATE workspaces SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id);
  const row = db.prepare("SELECT * FROM workspaces WHERE id = ?").get(id) as any;
  return NextResponse.json({
    id: row.id,
    companyId: row.company_id,
    taxYear: row.tax_year,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}
