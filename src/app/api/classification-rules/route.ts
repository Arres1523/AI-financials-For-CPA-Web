import { NextResponse } from "next/server";
import { z } from "zod";
import { v4 as uuid } from "uuid";
import { CATEGORY_OPTIONS } from "@/domain/categoryOptions";
import { buildRulePatternFromText } from "@/domain/classificationRules";
import { query, queryOne } from "@/lib/db";
import { requireUser, UnauthorizedError } from "@/lib/require-user";

export const runtime = "nodejs";

const createRuleSchema = z.object({
  companyId: z.string().min(1),
  pattern: z.string().min(1),
  finalCategory: z.string().min(1),
  direction: z.enum(["in", "out", "any"]).default("any"),
  priority: z.number().int().default(0),
});

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    if (!companyId) return NextResponse.json({ error: "companyId required" }, { status: 400 });

    const rows = await query(
      `SELECT id, company_id, pattern, direction, category, report_type, priority, created_at
       FROM classification_rules
       WHERE company_id = $1 AND user_id = $2
       ORDER BY priority DESC, created_at ASC`,
      [companyId, user.id]
    );
    return NextResponse.json(rows.map(mapRule));
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw e;
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = createRuleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors.map((err) => err.message).join("; ") }, { status: 400 });
    }

    const category = CATEGORY_OPTIONS.find((option) => option.value === parsed.data.finalCategory);
    if (!category) return NextResponse.json({ error: "Invalid finalCategory" }, { status: 400 });

    const company = await queryOne("SELECT id FROM companies WHERE id = $1 AND user_id = $2", [parsed.data.companyId, user.id]);
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

    const id = uuid();
    const pattern = buildRulePatternFromText(parsed.data.pattern);
    const rows = await query(
      `INSERT INTO classification_rules (id, company_id, pattern, category, report_type, priority, direction, review_status, confidence, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', 'medium', $8)
       RETURNING id, company_id, pattern, direction, category, report_type, priority, created_at`,
      [id, parsed.data.companyId, pattern, category.value, category.reportType, parsed.data.priority, parsed.data.direction, user.id]
    );

    return NextResponse.json(mapRule(rows[0]), { status: 201 });
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw e;
  }
}

function mapRule(row: any) {
  return {
    id: row.id,
    companyId: row.company_id,
    pattern: row.pattern,
    direction: row.direction ?? "any",
    finalCategory: row.category,
    reportType: row.report_type,
    priority: row.priority ?? 0,
    createdAt: row.created_at,
  };
}
