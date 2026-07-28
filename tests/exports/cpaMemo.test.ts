import { describe, expect, it } from "vitest";
import { buildCpaMemoText } from "../../src/exports/cpaMemo";

describe("buildCpaMemoText", () => {
  it("includes missing documents and open CPA review items", () => {
    const text = buildCpaMemoText({
      llcName: "Demo LLC",
      taxYear: 2025,
      cpaName: "CPA",
      included: ["Financial workbook"],
      missingDocuments: ["K-1 from ABC LLC"],
      openReviewItems: ["Wire to related party requires support"]
    });
    expect(text).toContain("Missing documents:");
    expect(text).toContain("K-1 from ABC LLC");
    expect(text).toContain("Open CPA review items:");
  });

  it("includes import formats, related party items, variances, and PDF limitation when provided", () => {
    const text = buildCpaMemoText({
      llcName: "Demo LLC",
      taxYear: 2025,
      cpaName: "CPA",
      included: ["Financial workbook"],
      missingDocuments: [],
      openReviewItems: [],
      statementFormats: ["CSV", "PDF"],
      relatedPartyItems: ["Transfer to Valoris affiliate"],
      reconciliationVariances: ["Operating account variance $100.00"],
      importNotes: ["PDF import supports text-based files only"],
    });

    expect(text).toContain("Import summary:");
    expect(text).toContain("Formats imported: CSV, PDF");
    expect(text).toContain("Related-party items:");
    expect(text).toContain("Transfer to Valoris affiliate");
    expect(text).toContain("Reconciliation variances:");
    expect(text).toContain("Operating account variance $100.00");
    expect(text).toContain("PDF import supports text-based files only");
  });
});
