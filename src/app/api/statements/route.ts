import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  const rows = await query(
    "SELECT id, file_name, sheet_name, total_rows, imported_rows, uploaded_at FROM uploaded_statements WHERE workspace_id = $1 ORDER BY uploaded_at DESC",
    [workspaceId]
  );
  return NextResponse.json(rows.map((s: any) => ({
    id: s.id,
    fileName: s.file_name,
    sheetName: s.sheet_name,
    totalRows: s.total_rows,
    importedRows: s.imported_rows,
    uploadedAt: s.uploaded_at,
  })));
}
