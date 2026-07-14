import { describe, expect, it } from "vitest";
import { matchInternalTransfers } from "../../src/domain/transferMatching";

const tx = (id: string, amt: number, desc: string, acctId: string, companyId: string, date: string) => ({
  id, amount: amt, description: desc, bankAccountId: acctId, companyId, date,
});

describe("matchInternalTransfers", () => {
  it("matches exact internal transfer pair", () => {
    const txs = [
      tx("t1", -50000, "TRF TO CHK 1234", "a1", "c1", "2025-01-01"),
      tx("t2", 50000, "TRF FROM CHK 5678", "a2", "c1", "2025-01-02"),
    ];
    const result = matchInternalTransfers(txs as any, ["a1", "a2"], "c1");
    expect(result.matchedPairs).toHaveLength(1);
    expect(result.unmatchedTransfers).toHaveLength(0);
  });

  it("does not match different amounts", () => {
    const txs = [
      tx("t1", -50000, "TRF TO CHK 1234", "a1", "c1", "2025-01-01"),
      tx("t2", 50001, "TRF FROM CHK 5678", "a2", "c1", "2025-01-02"),
    ];
    const result = matchInternalTransfers(txs as any, ["a1", "a2"], "c1");
    expect(result.matchedPairs).toHaveLength(0);
    expect(result.unmatchedTransfers).toHaveLength(2);
  });

  it("does not match same account", () => {
    const txs = [
      tx("t1", -50000, "TRF TO CHK 1234", "a1", "c1", "2025-01-01"),
      tx("t2", 50000, "TRF FROM CHK 5678", "a1", "c1", "2025-01-02"),
    ];
    const result = matchInternalTransfers(txs as any, ["a1", "a2"], "c1");
    expect(result.matchedPairs).toHaveLength(0);
  });

  it("does not match different company", () => {
    const txs = [
      tx("t1", -50000, "TRF TO CHK 1234", "a1", "c1", "2025-01-01"),
      tx("t2", 50000, "TRF FROM CHK 5678", "a2", "c2", "2025-01-02"),
    ];
    const result = matchInternalTransfers(txs as any, ["a1", "a2"], "c1");
    expect(result.matchedPairs).toHaveLength(0);
  });

  it("ignores vendor wire (non-transfer description)", () => {
    const txs = [
      tx("t1", -50000, "WIRE TRANSFER TO VENDOR", "a1", "c1", "2025-01-01"),
      tx("t2", 50000, "WIRE TRANSFER FROM CLIENT", "a2", "c1", "2025-01-02"),
    ];
    const result = matchInternalTransfers(txs as any, ["a1", "a2"], "c1");
    expect(result.matchedPairs).toHaveLength(0);
    expect(result.unmatchedTransfers).toHaveLength(0);
  });

  it("returns list of unmatched transfers", () => {
    const txs = [
      tx("t1", -50000, "TRF TO CHK 1234", "a1", "c1", "2025-01-01"),
    ];
    const result = matchInternalTransfers(txs as any, ["a1", "a2"], "c1");
    expect(result.unmatchedTransfers).toHaveLength(1);
    expect(result.unmatchedTransfers[0].id).toBe("t1");
  });
});
