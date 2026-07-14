export interface CategoryOption {
  value: string;
  label: string;
  reportType: "P&L" | "Balance Sheet";
}

export const CATEGORY_OPTIONS: CategoryOption[] = [
  { value: "Rental Income", label: "Rental Income", reportType: "P&L" },
  { value: "Other Income", label: "Other Income", reportType: "P&L" },
  { value: "Repairs & Maintenance", label: "Repairs & Maintenance", reportType: "P&L" },
  { value: "Utilities", label: "Utilities", reportType: "P&L" },
  { value: "Insurance", label: "Insurance", reportType: "P&L" },
  { value: "Property Taxes", label: "Property Taxes", reportType: "P&L" },
  { value: "Legal & Accounting", label: "Legal & Accounting", reportType: "P&L" },
  { value: "Management Fees", label: "Management Fees", reportType: "P&L" },
  { value: "Rent Expense", label: "Rent Expense", reportType: "P&L" },
  { value: "Bank Fees", label: "Bank Fees", reportType: "P&L" },
  { value: "Interest Expense", label: "Interest Expense", reportType: "P&L" },
  { value: "Other Expense", label: "Other Expense", reportType: "P&L" },
  { value: "Merchant Processing Fees", label: "Merchant Processing Fees", reportType: "P&L" },
  { value: "Operating / merchant income", label: "Operating / merchant income", reportType: "P&L" },
  { value: "Transfer Clearing", label: "Transfer Clearing", reportType: "Balance Sheet" },
  { value: "Wire Transfers", label: "Wire Transfers", reportType: "Balance Sheet" },
  { value: "Credit card payable", label: "Credit card payable", reportType: "Balance Sheet" },
  { value: "Capital contributions", label: "Capital contributions", reportType: "Balance Sheet" },
  { value: "Member distributions", label: "Member distributions", reportType: "Balance Sheet" },
  { value: "Due from related parties", label: "Due from related parties", reportType: "Balance Sheet" },
  { value: "Due to related parties", label: "Due to related parties", reportType: "Balance Sheet" },
  { value: "Loan Liability", label: "Loan Liability", reportType: "Balance Sheet" },
  { value: "Capital Improvements", label: "Capital Improvements", reportType: "Balance Sheet" },
  { value: "Uncategorized / Needs Review", label: "Uncategorized / Needs Review", reportType: "Balance Sheet" },
];

export function getCategoriesByReport(reportType: string): string[] {
  return CATEGORY_OPTIONS
    .filter((o) => o.reportType === reportType)
    .map((o) => o.value);
}

export function isValidCategory(value: string): boolean {
  return CATEGORY_OPTIONS.some((o) => o.value === value);
}
