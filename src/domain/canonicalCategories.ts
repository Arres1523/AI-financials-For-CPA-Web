export type CanonicalCategoryId =
  | "intercompany_transfer_in"
  | "intercompany_transfer_out"
  | "credit_card_clearing"
  | "merchant_processing_fees"
  | "bank_service_charges"
  | "other_ach_income"
  | "operating_merchant_income"
  | "project_cost_pending_support";

export interface CanonicalMapping {
  canonicalId: CanonicalCategoryId;
  displayName: string;
  reportType: "P&L" | "Balance Sheet";
}

export const CANONICAL_CATEGORIES: Record<CanonicalCategoryId, CanonicalMapping> = {
  intercompany_transfer_in: { canonicalId: "intercompany_transfer_in", displayName: "Related-party transfer in", reportType: "Balance Sheet" },
  intercompany_transfer_out: { canonicalId: "intercompany_transfer_out", displayName: "Related-party transfer out", reportType: "Balance Sheet" },
  credit_card_clearing: { canonicalId: "credit_card_clearing", displayName: "Credit card clearing", reportType: "Balance Sheet" },
  merchant_processing_fees: { canonicalId: "merchant_processing_fees", displayName: "Merchant processing fees", reportType: "P&L" },
  bank_service_charges: { canonicalId: "bank_service_charges", displayName: "Bank service charges", reportType: "P&L" },
  other_ach_income: { canonicalId: "other_ach_income", displayName: "Other ACH income", reportType: "P&L" },
  operating_merchant_income: { canonicalId: "operating_merchant_income", displayName: "Operating / merchant income", reportType: "P&L" },
  project_cost_pending_support: { canonicalId: "project_cost_pending_support", displayName: "Project cost (pending support)", reportType: "Balance Sheet" },
};

export const LABEL_TO_CANONICAL: Record<string, CanonicalCategoryId> = {
  "Intercompany / related-party transfer in": "intercompany_transfer_in",
  "Transfer Clearing": "intercompany_transfer_in",
  "Intercompany / related-party transfer out": "intercompany_transfer_out",
  "Credit card clearing / due from support": "credit_card_clearing",
  "Credit card payable": "credit_card_clearing",
  "Merchant / processing fees": "merchant_processing_fees",
  "Merchant Processing Fees": "merchant_processing_fees",
  "Bank service charges": "bank_service_charges",
  "Bank Fees": "bank_service_charges",
  "Other ACH income": "other_ach_income",
  "Other Income": "other_ach_income",
  "Operating / merchant income": "operating_merchant_income",
  "Project feasibility cost pending support": "project_cost_pending_support",
  "Project/vendor cost pending capitalization support": "project_cost_pending_support",
  "Wire Transfers": "project_cost_pending_support",
};

export function resolveCanonical(label: string): CanonicalCategoryId | null {
  return LABEL_TO_CANONICAL[label] ?? null;
}
