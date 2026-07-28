import { NextResponse } from "next/server";
import { z } from "zod";
import type { ColumnMapping } from "@/domain/types";
import { hashFile } from "@/domain/importXlsx";
import { preclassifyImportRows } from "@/domain/importPreclassification";
import {
  classifyWithGlobalFinancialModel,
  mapGlobalCategoryToClassification,
} from "@/domain/globalTransactionClassifier";
import { queryOne } from "@/lib/db";
import { requireUser, UnauthorizedError } from "@/lib/require-user";

export const runtime = "nodejs";

const mappingSchema = z.object({
  date: z.string().min(1, "Date column required"),
  description: z.string().min(1, "Description column required"),
  payee: z.string().optional(),
  merchantCategory: z.string().optional(),
  transactionType: z.string().optional(),
  amount: z.string().optional(),
  debit: z.string().optional(),
  credit: z.string().optional(),
  balance: z.string().optional(),
}).refine(
  (d) => d.amount || (d.debit && d.credit),
  { message: "Either amount or both debit+credit must be specified" }
);

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
    const workspaceId = formData.get("workspaceId") as string;
    const bankAccountId = formData.get("bankAccountId") as string;
    const taxYear = parseInt(formData.get("taxYear") as string);
    const mappingJson = formData.get("mapping") as string;

    if (!file || !workspaceId || !bankAccountId || !taxYear) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    let mapping: ColumnMapping;
    try {
      mapping = mappingSchema.parse(JSON.parse(mappingJson));
    } catch (err: any) {
      const message = err instanceof z.ZodError
        ? err.errors.map((e: any) => e.message).join("; ")
        : "Invalid column mapping JSON";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileHash = hashFile(buffer);
    const existingStmt = await queryOne(
      "SELECT id, imported_rows FROM uploaded_statements WHERE workspace_id = $1 AND file_hash = $2 AND user_id = $3",
      [workspaceId, fileHash, user.id]
    );

    const workspace = await queryOne(
      "SELECT company_id FROM workspaces WHERE id = $1 AND user_id = $2",
      [workspaceId, user.id]
    );
    const companyRules = workspace ? await queryCompanyRules(workspace.company_id, user.id) : [];
    const result = preclassifyImportRows(buffer, file.name, mapping, workspaceId, bankAccountId, taxYear, companyRules);
    const rows = await Promise.all(result.rows.map(async (row) => {
      const globalSuggestion = await classifyWithGlobalFinancialModel(row.classificationText || row.description);
      if (!globalSuggestion) return row;

      const globalClassification = mapGlobalCategoryToClassification(
        globalSuggestion.category,
        globalSuggestion.confidence,
        row.proposedClassification.transactionId
      );

      return {
        ...row,
        globalSuggestion: {
          ...globalSuggestion,
          source: "huggingface" as const,
        },
        proposedClassification: row.proposedClassification.finalCategory.includes("Uncategorized") && globalClassification
          ? globalClassification
          : row.proposedClassification,
      };
    }));

    return NextResponse.json({
      fileHash,
      duplicateStatement: !!existingStmt,
      existingStatementId: existingStmt?.id ?? null,
      rows,
      errors: result.errors,
      summary: {
        ...result.summary,
        needsReview: rows.filter((row) =>
          ["pending", "support_needed", "cpa_review", "card_statements_needed"].includes(row.proposedClassification.reviewStatus)
        ).length,
        highConfidence: rows.filter((row) => row.proposedClassification.confidence === "high").length,
      },
    });
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }
}

async function queryCompanyRules(companyId: string, userId: string) {
  const rows = await (await import("@/lib/db")).query(
    `SELECT id, company_id, pattern, direction, category, report_type, priority, created_at
     FROM classification_rules
     WHERE company_id = $1 AND user_id = $2
     ORDER BY priority DESC, created_at ASC`,
    [companyId, userId]
  );
  return rows.map((row: any) => ({
    id: row.id,
    companyId: row.company_id,
    pattern: row.pattern,
    direction: row.direction ?? "any",
    finalCategory: row.category,
    reportType: row.report_type,
    priority: row.priority ?? 0,
    createdAt: row.created_at,
  }));
}
