export type ReportType = "P&L" | "Balance Sheet";

export type Confidence = "high" | "medium" | "low";

export type ReviewStatus = "pending" | "approved" | "excluded" | "support_needed" | "cpa_review" | "card_statements_needed";

export type Company = {
  id: string;
  legalName: string;
  createdAt: string;
};

export type Workspace = {
  id: string;
  companyId: string;
  taxYear: number;
  status: "in_progress" | "completed";
  createdAt: string;
  updatedAt: string;
};

export type BankAccount = {
  id: string;
  companyId: string;
  accountName: string;
  bankName: string;
  lastFour: string;
  accountType: string;
  openingBalance: number;
  closingBalance: number;
  createdAt: string;
};

export type UploadedStatement = {
  id: string;
  workspaceId: string;
  bankAccountId: string;
  fileName: string;
  sheetName: string | null;
  totalRows: number;
  importedRows: number;
  uploadedAt: string;
};

export type Transaction = {
  id: string;
  workspaceId: string;
  bankAccountId: string;
  statementId: string;
  date: string;
  description: string;
  amount: number;
  balance: number | null;
  originalRowIndex: number;
  createdAt: string;
};

export type Classification = {
  id: string;
  transactionId: string;
  finalCategory: string;
  reportType: ReportType;
  confidence: Confidence;
  ruleUsed: string | null;
  reviewStatus: ReviewStatus;
  isManualCorrection: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TransactionWithClassification = Transaction & {
  classification: Classification | null;
};

export type ClassifiedTransaction = Transaction & {
  finalCategory: string;
  reportType: ReportType;
  confidence: Confidence;
  ruleUsed: string | null;
  reviewStatus: ReviewStatus;
  isManualCorrection: boolean;
  classification?: Classification | null;
};

export type ClassificationRule = {
  id: string;
  pattern: string;
  category: string;
  reportType: ReportType;
  createdAt: string;
};

export type ReviewEvent = {
  id: string;
  transactionId: string;
  action: string;
  previousCategory: string | null;
  newCategory: string | null;
  note: string | null;
  createdAt: string;
};

export type XlsxImportRow = {
  date: string;
  description: string;
  amount: number;
  balance: number | null;
  rowIndex: number;
  sheetName?: string;
};

export type ReconciliationResult = {
  accountId: string;
  accountName: string;
  openingBalance: number;
  movementTotal: number;
  expectedClosingBalance: number;
  closingBalance: number;
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

export type ColumnMapping = {
  date: string;
  description: string;
  amount?: string;
  debit?: string;
  credit?: string;
  balance?: string;
};

export type UploadPreview = {
  fileName: string;
  sheetName: string | null;
  totalRows: number;
  sampleRows: Record<string, string>[];
  columns: string[];
  detectedMapping: Partial<ColumnMapping>;
  confidence: "high" | "medium" | "low";
  errors: string[];
};

export type ImportError = {
  row: number;
  type: "empty_file" | "invalid_format" | "unrecognized_date" | "unrecognized_amount" | "incomplete_row" | "duplicate_transaction" | "duplicate_statement" | "outside_fiscal_year";
  message: string;
};

export type BulkReviewAction = {
  transactionIds: string[];
  action: "approve" | "exclude";
  newCategory?: string;
};

// Legacy CPA package types (kept for compatibility)
export type StatementKind = "P&L" | "Balance Sheet";
export type ChecklistStatus = "Missing" | "Uploaded" | "Reviewed" | "Not applicable" | "Listed in CPA memo";
export type DocumentChecklistItem = {
  folder: string;
  label: string;
  status: ChecklistStatus;
  memoNote: string;
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
