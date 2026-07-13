import { NextResponse } from "next/server";
import { buildReports } from "../../../../domain/reporting";
import type { ClassifiedTransaction } from "../../../../domain/types";
import { buildWorkbookBuffer } from "../../../../exports/workbook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    entityName: string;
    taxYear: number;
    transactions: ClassifiedTransaction[];
  };
  const reports = buildReports(body.entityName, body.taxYear, body.transactions);
  const buffer = await buildWorkbookBuffer({
    entityName: body.entityName,
    taxYear: body.taxYear,
    transactions: body.transactions,
    reports
  });
  const responseBody = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;

  return new NextResponse(responseBody, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${body.entityName.replace(/\s+/g, "_")}_${body.taxYear}_PnL_BS_Detail.xlsx"`
    }
  });
}
