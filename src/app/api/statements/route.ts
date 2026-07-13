import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  const db = getDb();
  const statements = db.prepare("SELECT id, file_name, sheet_name, total_rows, imported_rows, uploaded_at FROM uploaded_statements WHERE workspace_id = ? ORDER BY uploaded_at DESC").all(workspaceId);
  return NextResponse.json(statements.map((s: any) => ({
    id: s.id,
    fileName: s.file_name,
    sheetName: s.sheet_name,
    totalRows: s.total_rows,
    importedRows: s.imported_rows,
    uploadedAt: s.uploaded_at,
  })));
}
