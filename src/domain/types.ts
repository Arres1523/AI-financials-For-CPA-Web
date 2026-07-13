export type StatementKind = "P&L" | "Balance Sheet";

export type ReviewStatus =
  | ""
  | "Support Needed"
  | "CPA Review"
  | "Credit Card Statements Needed"
  | "Missing Document"
  | "Unresolved Delta"
  | "Potential Related Party";

export type ChecklistStatus = "Missing" | "Uploaded" | "Reviewed" | "Not applicable" | "Listed in CPA memo";

export type DocumentChecklistItem = {
  folder: string;
  label: string;
  status: ChecklistStatus;
  memoNote: string;
};

export type Transaction = {
  id: string;
  date: string;
  sourceAccount: string;
  description: string;
  amount: number;
  sourceCategory: string;
  type: string;
  sourceBalance: number | null;
  sourceFile: string;
};

export type ClassificationResult = {
  transactionId: string;
  finalCategory: string;
  statement: StatementKind;
  pnlLine: string;
  pnlAmount: number;
  bsLine: string;
  bsCounterpartAmount: number;
  reviewStatus: ReviewStatus;
  source: "rule" | "manual" | "fallback";
};

export type ClassifiedTransaction = Transaction & ClassificationResult;

export type ReconciliationResult = {
  movementTotal: number;
  expectedClosingBalance: number;
  variance: number;
  status: "reconciled" | "unreconciled";
};

export type PnlReport = {
  income: Record<string, number>;
  expenses: Record<string, number>;
  netIncome: number;
};

export type BalanceSheetReport = {
  assets: Record<string, number>;
  liabilities: Record<string, number>;
  equity: Record<string, number>;
  balanceCheck: number;
};

export type ReportPackage = {
  entityName: string;
  taxYear: number;
  pnl: PnlReport;
  balanceSheet: BalanceSheetReport;
};

export type CpaPackage = {
  llcName: string;
  taxYear: number;
  checklist: DocumentChecklistItem[];
  reviewerApproved: boolean;
  balanceCheckExplanation: string;
  balanceCheck?: number;
};

export type CpaPackageStatus = {
  canDraft: boolean;
  canCompletePackage: boolean;
  blockers: string[];
};

export type CpaMemoModel = {
  llcName: string;
  taxYear: number;
  cpaName: string;
  included: string[];
  missingDocuments: string[];
  openReviewItems: string[];
};
