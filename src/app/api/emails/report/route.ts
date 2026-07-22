import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { buildFinancialReport } from "@/domain/reporting";
import { buildWorkbookBuffer } from "@/exports/workbook";
import { buildCpaMemoBuffer } from "@/exports/cpaMemo";
import { buildMemoModel } from "@/domain/cpaPackage";
import type { CpaPackage, TransactionWithClassification } from "@/domain/types";
import { getResend } from "@/lib/resend";
import { requireUser, UnauthorizedError } from "@/lib/require-user";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json() as {
      recipientEmail: string;
      reportType: "workbook" | "memo";
      workspaceId?: string;
      includeTransactions?: boolean;
      pkg?: CpaPackage;
      transactions?: TransactionWithClassification[];
    };

    if (!body.recipientEmail || !body.reportType) {
      return NextResponse.json({ error: "recipientEmail and reportType required" }, { status: 400 });
    }

    let buffer: Buffer;
    let attachmentFilename: string;
    let companyName: string;
    let taxYear: number;

    if (body.reportType === "workbook") {
      if (!body.workspaceId) {
        return NextResponse.json({ error: "workspaceId required for workbook reports" }, { status: 400 });
      }
      const ws = await queryOne(`
        SELECT w.*, c.legal_name FROM workspaces w
        JOIN companies c ON c.id = w.company_id
        WHERE w.id = $1 AND w.user_id = $2
      `, [body.workspaceId, user.id]);
      if (!ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

      companyName = ws.legal_name;
      taxYear = ws.tax_year;

      const txRows = await query(`
        SELECT t.*, c.final_category, c.report_type, c.confidence, c.rule_used, c.review_status
        FROM transactions t
        JOIN classifications c ON c.transaction_id = t.id
        WHERE t.workspace_id = $1 AND t.user_id = $2 AND c.review_status != 'excluded'
        ORDER BY t.date ASC, t.original_row_index ASC
      `, [body.workspaceId, user.id]);

      const transactions = txRows.map((r: any) => ({
        id: r.id,
        workspaceId: r.workspace_id,
        bankAccountId: r.bank_account_id,
        statementId: r.statement_id,
        date: r.date,
        description: r.description,
        amount: r.amount,
        balance: r.balance,
        originalRowIndex: r.original_row_index,
        createdAt: r.created_at,
      }));
      const classifications = txRows.map((r: any) => ({
        id: r.id,
        transactionId: r.id,
        finalCategory: r.final_category,
        reportType: r.report_type,
        confidence: r.confidence,
        ruleUsed: r.rule_used,
        reviewStatus: r.review_status,
        isManualCorrection: false,
        createdAt: r.created_at,
        updatedAt: r.created_at,
      }));
      const accounts = await query(
        "SELECT * FROM bank_accounts WHERE company_id = (SELECT company_id FROM workspaces WHERE id = $1) AND user_id = $2",
        [body.workspaceId, user.id]
      );
      const typedAccounts = accounts.map((a: any) => ({
        id: a.id,
        accountName: a.account_name,
        bankName: a.bank_name,
        lastFour: a.last_four,
        accountType: a.account_type,
        openingBalance: a.opening_balance,
        closingBalance: a.closing_balance,
        companyId: a.company_id,
        createdAt: a.created_at,
      }));
      const reports = buildFinancialReport(companyName, taxYear, typedAccounts, transactions, classifications);
      const flaggedTransactions = transactions.filter((_: any, i: number) => {
        const s = classifications[i]?.reviewStatus;
        return (s && !["approved", "excluded"].includes(s)) || classifications[i]?.confidence === "low";
      });
      const accountReconData = await query(`
        SELECT a.id, a.account_name, a.opening_balance, a.closing_balance,
               COALESCE(SUM(t.amount), 0) as movement_total
        FROM bank_accounts a
        LEFT JOIN transactions t ON t.bank_account_id = a.id AND t.workspace_id = $1 AND t.user_id = $2
        WHERE a.company_id = (SELECT company_id FROM workspaces WHERE id = $3) AND a.user_id = $4
        GROUP BY a.id
      `, [body.workspaceId, user.id, body.workspaceId, user.id]);

      buffer = await buildWorkbookBuffer({
        companyName, taxYear, transactions, classifications, reports,
        flaggedTransactions, accountReconData,
        includeTransactions: body.includeTransactions ?? false,
      });
      const suffix = body.includeTransactions ? "_with_transactions" : "";
      attachmentFilename = `${companyName.replace(/\s+/g, "_")}_${taxYear}_Financial_Statements${suffix}.xlsx`;
    } else {
      if (!body.pkg || !body.transactions) {
        return NextResponse.json({ error: "pkg and transactions required for memo" }, { status: 400 });
      }
      companyName = body.pkg.llcName;
      taxYear = body.pkg.taxYear;
      const model = buildMemoModel(body.pkg, body.transactions);
      buffer = await buildCpaMemoBuffer(model);
      attachmentFilename = `${companyName.replace(/\s+/g, "_")}_${taxYear}_CPA_Memo.docx`;
    }

    const resend = getResend();
    const from = process.env.RESEND_FROM_EMAIL ?? "Valoris <noreply@valoris.cpa>";

    const { error } = await resend.emails.send({
      from,
      to: [body.recipientEmail],
      subject: `Financial Report — ${companyName} (${taxYear})`,
      html: `<p>Please find attached the financial report for <strong>${companyName}</strong> for tax year ${taxYear}.</p>`,
      attachments: [{
        filename: attachmentFilename,
        content: Buffer.from(buffer).toString("base64"),
      }],
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ sent: true });
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }
}
