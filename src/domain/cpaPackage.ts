import type { CpaMemoModel, CpaPackage, CpaPackageStatus, TransactionWithClassification } from "./types";

export function buildCpaPackageStatus(pkg: CpaPackage): CpaPackageStatus {
  const blockers: string[] = [];
  const hasUnlistedMissingDocs = pkg.checklist.some((item) => item.status === "Missing" && !item.memoNote.trim());
  const balanceCheck = pkg.balanceCheck ?? 0;

  if (hasUnlistedMissingDocs) blockers.push("Missing documents must be listed in CPA memo.");
  if (Math.abs(balanceCheck) > 0.01 && !pkg.balanceCheckExplanation.trim()) {
    blockers.push("Non-zero Balance Check must be explained in CPA memo.");
  }
  if (!pkg.reviewerApproved) blockers.push("Reviewer approval is required before package completion.");

  return {
    canDraft: true,
    canCompletePackage: blockers.length === 0,
    blockers
  };
}

export function buildMemoModel(pkg: CpaPackage, classifications: TransactionWithClassification[]): CpaMemoModel {
  const missingDocuments = pkg.checklist
    .filter((item) => item.status === "Missing" || item.status === "Listed in CPA memo")
    .map((item) => item.memoNote.trim() || item.label);

  const openReviewItems = classifications
    .filter((row) => {
      const s = row.classification?.reviewStatus;
      return s && !["approved", "excluded"].includes(s);
    })
    .map((row) => `${row.date} - ${row.description}: ${row.classification?.finalCategory}`);

  if (Math.abs(pkg.balanceCheck ?? 0) > 0.01 && pkg.balanceCheckExplanation.trim()) {
    openReviewItems.push(`Balance Check delta: ${pkg.balanceCheckExplanation}`);
  }

  return {
    llcName: pkg.llcName,
    taxYear: pkg.taxYear,
    cpaName: "CPA",
    included: [
      "Financial workbook with Transaction Detail, P&L, and Balance Sheet",
      "Monthly bank statements provided in the CPA package folder",
      "Entity documents and available support"
    ],
    missingDocuments,
    openReviewItems
  };
}
