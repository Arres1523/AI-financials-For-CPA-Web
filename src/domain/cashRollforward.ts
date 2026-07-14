export type CashRollforward = {
  openingCash: number;
  totalInflows: number;
  totalOutflows: number;
  calculatedEndingCash: number;
  actualCash: number;
  variance: number;
};

const cents = (v: number) => Math.round(v * 100) / 100;

export function buildCashRollforward(
  openingBalances: number[],
  closingBalances: number[],
  amounts: number[]
): CashRollforward {
  const openingCash = cents(openingBalances.reduce((s, v) => s + (v ?? 0), 0));
  const actualCash = cents(closingBalances.reduce((s, v) => s + (v ?? 0), 0));

  let totalInflows = 0;
  let totalOutflows = 0;
  for (const amt of amounts) {
    if (amt > 0) totalInflows += amt;
    else totalOutflows += Math.abs(amt);
  }
  totalInflows = cents(totalInflows);
  totalOutflows = cents(totalOutflows);

  const calculatedEndingCash = cents(openingCash + totalInflows - totalOutflows);
  const variance = cents(actualCash - calculatedEndingCash);

  return { openingCash, totalInflows, totalOutflows, calculatedEndingCash, actualCash, variance };
}
