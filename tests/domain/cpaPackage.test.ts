import { describe, expect, it } from "vitest";
import { buildCpaPackageStatus } from "../../src/domain/cpaPackage";

describe("buildCpaPackageStatus", () => {
  it("requires missing documents to be listed in the memo before completion", () => {
    const status = buildCpaPackageStatus({
      llcName: "Demo LLC",
      taxYear: 2025,
      checklist: [{ folder: "03 K-1s Received", label: "K-1s received", status: "Missing", memoNote: "" }],
      reviewerApproved: false,
      balanceCheckExplanation: ""
    });
    expect(status.canCompletePackage).toBe(false);
    expect(status.blockers).toContain("Missing documents must be listed in CPA memo.");
  });
});
