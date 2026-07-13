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
});
