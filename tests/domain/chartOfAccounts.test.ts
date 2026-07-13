import { describe, expect, it } from "vitest";
import { CPA_ACCOUNT_NAMES, VALORIS_DOCUMENT_CHECKLIST } from "../../src/domain/chartOfAccounts";

describe("Valoris constants", () => {
  it("contains the eight required CPA package folders", () => {
    expect(VALORIS_DOCUMENT_CHECKLIST.map((item) => item.folder)).toEqual([
      "01 Entity Documents",
      "02 Prior-Year Tax Returns",
      "03 K-1s Received",
      "04 Bank Statements",
      "05 IRS and State Notices",
      "06 Financial Statements",
      "07 Other Support",
      "08 CPA Memo"
    ]);
  });

  it("uses CPA-presentable account names without slash-combined uncertainty", () => {
    expect(CPA_ACCOUNT_NAMES.every((name) => !name.includes("/"))).toBe(true);
  });
});
