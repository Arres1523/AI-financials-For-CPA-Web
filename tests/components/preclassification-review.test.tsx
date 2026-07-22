import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PreclassificationReview from "../../src/components/wizard/PreclassificationReview";
import type { PreclassifiedImportRow } from "../../src/domain/types";

function row(): PreclassifiedImportRow {
  return {
    date: "2026-01-01",
    description: "Electric company",
    classificationText: "Electric company",
    amount: -120,
    balance: null,
    rowIndex: 0,
    proposedClassification: {
      id: "global-preview-0",
      transactionId: "preview-0",
      finalCategory: "Utilities",
      reportType: "P&L",
      confidence: "medium",
      ruleUsed: "Global classifier — Utilities & Services",
      reviewStatus: "pending",
      isManualCorrection: false,
      createdAt: "",
      updatedAt: "",
    },
    globalSuggestion: {
      category: "Utilities & Services",
      confidence: 0.92,
      source: "huggingface",
    },
  };
}

describe("PreclassificationReview", () => {
  it("confirms global classifier proposals as import overrides", () => {
    const onConfirm = vi.fn();
    render(
      <PreclassificationReview
        fileName="statement.xlsx"
        rows={[row()]}
        errors={[]}
        summary={{ totalRows: 1, validRows: 1, needsReview: 1, highConfidence: 0 }}
        confirming={false}
        onBack={vi.fn()}
        onConfirm={onConfirm}
      />
    );

    fireEvent.click(screen.getByText("Import reviewed transactions (1)"));

    expect(onConfirm).toHaveBeenCalledWith([
      { rowIndex: 0, finalCategory: "Utilities", reviewStatus: "pending" },
    ]);
  });
});
