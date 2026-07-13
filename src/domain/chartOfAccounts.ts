import type { DocumentChecklistItem } from "./types";

export const VALORIS_DOCUMENT_CHECKLIST: DocumentChecklistItem[] = [
  { folder: "01 Entity Documents", label: "Entity documents", status: "Missing", memoNote: "" },
  { folder: "02 Prior-Year Tax Returns", label: "Prior-year tax returns", status: "Missing", memoNote: "" },
  { folder: "03 K-1s Received", label: "K-1s received", status: "Missing", memoNote: "" },
  { folder: "04 Bank Statements", label: "Monthly bank statements", status: "Missing", memoNote: "" },
  { folder: "05 IRS and State Notices", label: "IRS and state notices", status: "Missing", memoNote: "" },
  { folder: "06 Financial Statements", label: "Financial workbook", status: "Missing", memoNote: "" },
  { folder: "07 Other Support", label: "Other support", status: "Missing", memoNote: "" },
  { folder: "08 CPA Memo", label: "CPA memo", status: "Missing", memoNote: "" }
];

export const CPA_ACCOUNT_NAMES = [
  "Rental Income",
  "Management fee income",
  "Other operating income",
  "Bank fees",
  "Legal and accounting",
  "Software and subscriptions",
  "Administrative expenses",
  "Interest expense",
  "Capital contributions",
  "Member distributions",
  "Credit card payable",
  "Due from related parties",
  "Due to related parties",
  "Transfer clearing",
  "Investment in partnerships",
  "Project deposits",
  "Loan payable",
  "Current year net income"
];
