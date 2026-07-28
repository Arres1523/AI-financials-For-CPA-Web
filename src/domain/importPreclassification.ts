import { classifyTransaction } from "./classification";
import { applyCompanyClassificationRules } from "./classificationRules";
import { CATEGORY_OPTIONS } from "./categoryOptions";
import { importStatementRows } from "./statementImport";
import type {
  Classification,
  CompanyClassificationRule,
  ColumnMapping,
  PreclassificationOverride,
  PreclassificationResult,
  Transaction,
} from "./types";

export function preclassifyImportRows(
  data: ArrayBuffer | Uint8Array | Buffer,
  fileName: string,
  mapping: ColumnMapping,
  workspaceId: string,
  bankAccountId: string,
  taxYear: number,
  companyRules: CompanyClassificationRule[] = []
): PreclassificationResult {
  const { rows, errors } = importStatementRows(data, fileName, mapping, workspaceId, bankAccountId, taxYear);

  const preclassifiedRows = rows.map((row) => {
    const transactionForClassification: Transaction = {
      id: `preview-${row.rowIndex}`,
      workspaceId,
      bankAccountId,
      statementId: "preview",
      date: row.date,
      description: row.classificationText || row.description,
      amount: row.amount,
      balance: row.balance,
      originalRowIndex: row.rowIndex,
      createdAt: new Date().toISOString(),
    };

    const proposedClassification = applyCompanyClassificationRules(
      classifyTransaction(transactionForClassification),
      transactionForClassification,
      companyRules
    );

    return {
      ...row,
      proposedClassification,
      globalSuggestion: null,
    };
  });

  return {
    rows: preclassifiedRows,
    errors,
    summary: {
      totalRows: rows.length,
      validRows: rows.length,
      needsReview: preclassifiedRows.filter((row) =>
        ["pending", "support_needed", "cpa_review", "card_statements_needed"].includes(row.proposedClassification.reviewStatus)
      ).length,
      highConfidence: preclassifiedRows.filter((row) => row.proposedClassification.confidence === "high").length,
    },
  };
}

export function applyPreclassificationOverride(
  classification: Classification,
  override: PreclassificationOverride | undefined
): Classification {
  if (!override) return classification;

  const now = new Date().toISOString();
  if (override.excluded) {
    return {
      ...classification,
      reviewStatus: "excluded",
      isManualCorrection: true,
      updatedAt: now,
    };
  }

  if (!override.finalCategory) {
    return {
      ...classification,
      reviewStatus: override.reviewStatus ?? classification.reviewStatus,
      isManualCorrection: !!override.reviewStatus || classification.isManualCorrection,
      updatedAt: now,
    };
  }

  const category = CATEGORY_OPTIONS.find((option) => option.value === override.finalCategory);
  if (!category) return classification;

  return {
    ...classification,
    finalCategory: category.value,
    reportType: category.reportType,
    reviewStatus: override.reviewStatus ?? "approved",
    isManualCorrection: true,
    updatedAt: now,
  };
}
