import { NextResponse } from "next/server";
import { buildStatementPreview, detectStatementFileType } from "@/domain/statementImport";
import { requireUser, UnauthorizedError } from "@/lib/require-user";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    }

    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const fileName = file.name;
    if (!detectStatementFileType(fileName)) {
      return NextResponse.json({ error: "Only .csv, .xlsx, and text-based .pdf files are accepted" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const preview = buildStatementPreview(buffer, fileName);
    return NextResponse.json(preview);
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }
}
