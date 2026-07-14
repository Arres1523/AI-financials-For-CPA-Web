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
  companyId?: string;
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

export type CounterpartyRule = {
  id: string;
  companyId: string;
  pattern: string;
  direction: "in" | "out" | "any";
  finalCategory: string;
  reportType: ReportType;
  confidence: Confidence;
  reviewStatus: ReviewStatus;
  ruleUsed: string;
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
  classificationText?: string;
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

// ─── New reporting controls ────────────────────────────────────
export type CheckStatus = "passed" | "failed" | "incomplete_data";

export type BankReconciliationCheck = {
  accountId: string;
  accountName: string;
  openingBalance: number;
  movementTotal: number;
  expectedClosingBalance: number;
  actualClosingBalance: number;
  variance: number;
  status: "reconciled" | "unreconciled";
};

export type ClassificationCompletenessCheck = {
  totalTransactions: number;
  approved: number;
  excluded: number;
  unresolved: number;
  unresolvedAmount: number;
  suspenseAmount: number;
  status: "complete" | "incomplete";
  classified: number;
  documentationComplete: number;
  documentationPending: number;
};

export type AccountingEquationCheck = {
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  difference: number;
  status: CheckStatus;
  missingInputs: string[];
};

export type FinancialReportMode = "classified_bank_activity" | "preliminary_balance_sheet" | "complete_balance_sheet";

export type SuspenseItem = {
  transactionId: string;
  date: string;
  description: string;
  amount: number;
  currentCategory: string;
  reviewStatus: ReviewStatus;
  reason: string;
};

export type MatchedTransferPair = {
  outTransactionId: string;
  inTransactionId: string;
  outAccountId: string;
  inAccountId: string;
  amount: number;
  dateDifferenceDays: number;
};

export type OpeningBalanceEntry = {
  id: string;
  workspaceId: string;
  accountName: string;
  accountType: "asset" | "liability" | "equity";
  amount: number;
  source: string;
  supportStatus: "provided" | "missing" | "reviewed";
};

export type OpeningBalanceSheetInput = {
  entries: OpeningBalanceEntry[];
  isValid: boolean;
  difference: number;
};

export type FinancialReport = {
  mode: FinancialReportMode;
  modeReasons: string[];
  entityName: string;
  taxYear: number;
  pnl: PnlReport;
  balanceSheet: BalanceSheetReport;
  bankReconciliation: BankReconciliationCheck[];
  classificationCompleteness: ClassificationCompletenessCheck;
  accountingEquation: AccountingEquationCheck;
  suspense: SuspenseItem[];
  actualCash: number;
  expectedCash: number;
  totalCashVariance: number;
  matchedTransferCount: number;
  matchedTransferAmount: number;
  openingCash: number;
  totalInflows: number;
  totalOutflows: number;
};

export type ColumnMapping = {
  date: string;
  description: string;
  payee?: string;
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
