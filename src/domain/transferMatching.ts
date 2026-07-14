import type { Transaction, MatchedTransferPair } from "./types";

const TRANSFER_PATTERNS = [/TRANSFER.*BETWEEN/i, /\bTRF\b.*TO/i, /\bTRF\b.*FROM/i, /ACCT TRANSFER/i, /INTERNAL TRANSFER/i, /ONLINE TRANSFER/i];

function isTransferLike(desc: string): boolean {
  return TRANSFER_PATTERNS.some(p => p.test(desc));
}

type MatchResult = {
  matchedPairs: MatchedTransferPair[];
  unmatchedTransfers: Transaction[];
};

export function matchInternalTransfers(
  transactions: Transaction[],
  companyAccountIds: string[],
  companyId: string,
  maxDateDiffDays: number = 3
): MatchResult {
  const transfers = transactions.filter(t => isTransferLike(t.description) && t.companyId === companyId);
  const used = new Set<string>();
  const matchedPairs: MatchedTransferPair[] = [];
  const unmatchedTransfers: Transaction[] = [];

  for (const outTx of transfers.filter(t => t.amount < 0)) {
    if (used.has(outTx.id)) continue;
    const match = transfers.find(inTx =>
      inTx.amount > 0
      && Math.abs(inTx.amount + outTx.amount) <= 0.01
      && inTx.bankAccountId !== outTx.bankAccountId
      && companyAccountIds.includes(inTx.bankAccountId)
      && !used.has(inTx.id)
      && Math.abs(new Date(inTx.date).getTime() - new Date(outTx.date).getTime()) <= maxDateDiffDays * 86400000
    );
    if (match) {
      matchedPairs.push({
        outTransactionId: outTx.id,
        inTransactionId: match.id,
        outAccountId: outTx.bankAccountId,
        inAccountId: match.bankAccountId,
        amount: Math.abs(outTx.amount),
        dateDifferenceDays: Math.round(Math.abs(new Date(match.date).getTime() - new Date(outTx.date).getTime()) / 86400000),
      });
      used.add(outTx.id);
      used.add(match.id);
    }
  }

  for (const t of transfers) {
    if (!used.has(t.id)) unmatchedTransfers.push(t);
  }

  return { matchedPairs, unmatchedTransfers };
}
