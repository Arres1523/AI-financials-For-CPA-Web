import { NextResponse } from "next/server";
import { buildMemoModel } from "../../../../domain/cpaPackage";
import type { CpaPackage, TransactionWithClassification } from "../../../../domain/types";
import { buildCpaMemoBuffer } from "../../../../exports/cpaMemo";
import { requireUser, UnauthorizedError } from "@/lib/require-user";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as {
      pkg: CpaPackage;
      transactions: TransactionWithClassification[];
    };
    const model = buildMemoModel(body.pkg, body.transactions);
    const buffer = await buildCpaMemoBuffer(model);
    const responseBody = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    return new NextResponse(responseBody, {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "content-disposition": `attachment; filename="${body.pkg.llcName.replace(/\s+/g, "_")}_${body.pkg.taxYear}_CPA_Memo.docx"`
      }
    });
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }
}
