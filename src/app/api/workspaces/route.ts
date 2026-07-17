import { NextResponse } from "next/server";
import { query, queryOne, execute } from "@/lib/db";
import { v4 as uuid } from "uuid";
import { requireUser, UnauthorizedError } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    let rows: any[];
    if (companyId) {
      rows = await query(
        "SELECT * FROM workspaces WHERE company_id = $1 AND user_id = $2 ORDER BY tax_year DESC",
        [companyId, user.id]
      );
    } else {
      rows = await query(
        "SELECT * FROM workspaces WHERE user_id = $1 ORDER BY created_at DESC",
        [user.id]
      );
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
    const { companyId, taxYear } = body;
    if (!companyId || !taxYear) {
      return NextResponse.json({ error: "companyId and taxYear are required" }, { status: 400 });
    }
    const existing = await queryOne(
      "SELECT id FROM workspaces WHERE company_id = $1 AND tax_year = $2 AND user_id = $3",
      [companyId, taxYear, user.id]
    );
    if (existing) {
      return NextResponse.json({ error: "Workspace already exists", id: existing.id }, { status: 409 });
    }
    const id = uuid();
    await execute(
      "INSERT INTO workspaces (id, company_id, tax_year, user_id) VALUES ($1, $2, $3, $4)",
      [id, companyId, taxYear, user.id]
    );
    const row = await queryOne(
      "SELECT * FROM workspaces WHERE id = $1 AND user_id = $2",
      [id, user.id]
    );
    return NextResponse.json({
      id: row.id,
      companyId: row.company_id,
      taxYear: row.tax_year,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireUser();
    const { id, status } = await request.json();
    await execute(
      "UPDATE workspaces SET status = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3",
      [status, id, user.id]
    );
    const row = await queryOne(
      "SELECT * FROM workspaces WHERE id = $1 AND user_id = $2",
      [id, user.id]
    );
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({
      id: row.id,
      companyId: row.company_id,
      taxYear: row.tax_year,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }
}
