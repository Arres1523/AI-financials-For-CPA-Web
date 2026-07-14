import { describe, expect, it } from "vitest";
import { buildCashRollforward } from "../../src/domain/cashRollforward";

describe("buildCashRollforward", () => {
  it("compute from zero opening balance and sample transactions", () => {
    const rf = buildCashRollforward(
      [0],
      [53275],
      [12000, 50000, -35, -2400, -5000, -900, -210, -180]
    );
    expect(rf.openingCash).toBe(0);
    expect(rf.totalInflows).toBe(62000);
    expect(rf.totalOutflows).toBe(8725);
    expect(rf.calculatedEndingCash).toBe(53275);
    expect(rf.actualCash).toBe(53275);
    expect(rf.variance).toBe(0);
  });

  it("handle non-zero opening balance", () => {
    const rf = buildCashRollforward(
      [10000],
      [15000],
      [3000, 2000]
    );
    expect(rf.openingCash).toBe(10000);
    expect(rf.totalInflows).toBe(5000);
    expect(rf.totalOutflows).toBe(0);
    expect(rf.calculatedEndingCash).toBe(15000);
    expect(rf.actualCash).toBe(15000);
    expect(rf.variance).toBe(0);
  });

  it("handle multiple bank accounts", () => {
    const rf = buildCashRollforward(
      [5000, 3000],
      [8000, 5000],
      [1000, 500, -200, -300]
    );
    expect(rf.openingCash).toBe(8000);
    expect(rf.totalInflows).toBe(1500);
    expect(rf.totalOutflows).toBe(500);
    expect(rf.calculatedEndingCash).toBe(9000);
    expect(rf.actualCash).toBe(13000);
    expect(rf.variance).toBe(4000);
  });

  it("handle no transactions", () => {
    const rf = buildCashRollforward([5000], [5000], []);
    expect(rf.openingCash).toBe(5000);
    expect(rf.totalInflows).toBe(0);
    expect(rf.totalOutflows).toBe(0);
    expect(rf.calculatedEndingCash).toBe(5000);
    expect(rf.actualCash).toBe(5000);
    expect(rf.variance).toBe(0);
  });

  it("handle null and undefined as zero", () => {
    const rf = buildCashRollforward(
      [null as unknown as number, undefined as unknown as number],
      [null as unknown as number, undefined as unknown as number],
      []
    );
    expect(rf.openingCash).toBe(0);
    expect(rf.actualCash).toBe(0);
    expect(rf.variance).toBe(0);
  });

  it("only positive contributions to inflows", () => {
    const rf = buildCashRollforward([0], [100], [100, -50, 200]);
    expect(rf.totalInflows).toBe(300);
    expect(rf.totalOutflows).toBe(50);
    expect(rf.calculatedEndingCash).toBe(250);
    expect(rf.actualCash).toBe(100);
    expect(rf.variance).toBe(-150);
  });

  it("do not use net income to derive opening cash", () => {
    const netIncome = 62000 - 8725;
    const rf = buildCashRollforward([0], [53275], []);
    expect(rf.openingCash).toBe(0);
    expect(rf.calculatedEndingCash).toBe(0);
    expect(rf.calculatedEndingCash).not.toBe(netIncome);
  });
});
