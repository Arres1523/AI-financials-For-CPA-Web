import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireUser, UnauthorizedError } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
    }
    const rows = await query(
      "SELECT id, file_name, sheet_name, total_rows, imported_rows, uploaded_at FROM uploaded_statements WHERE workspace_id = $1 AND user_id = $2 ORDER BY uploaded_at DESC",
      [workspaceId, user.id]
    );
    return NextResponse.json(rows.map((s: any) => ({
      id: s.id,
      fileName: s.file_name,
      sheetName: s.sheet_name,
      totalRows: s.total_rows,
      importedRows: s.imported_rows,
      uploadedAt: s.uploaded_at,
    })));
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }
}
