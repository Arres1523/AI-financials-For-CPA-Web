import { NextResponse } from "next/server";
import { buildMemoModel } from "../../../../domain/cpaPackage";
import type { ClassifiedTransaction, CpaPackage } from "../../../../domain/types";
import { buildCpaMemoBuffer } from "../../../../exports/cpaMemo";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    pkg: CpaPackage;
    transactions: ClassifiedTransaction[];
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
}
