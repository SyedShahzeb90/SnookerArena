import type { AdvanceGameTransaction } from "../store/advanceGamesStore";

interface PendingAdvanceGameAward {
  customerId: string;
  customerName: string;
  games: number;
}

export interface AdvanceGameBalanceRow {
  customerId: string;
  customerName: string;
  availableGames: number;
  pendingGames: number;
}

export function buildAdvanceGameBalanceRows(
  transactions: AdvanceGameTransaction[],
  pendingAwards: PendingAdvanceGameAward[]
) {
  const balances = new Map<string, AdvanceGameBalanceRow>();

  transactions.forEach((transaction) => {
    const current = balances.get(transaction.customerId) ?? {
      customerId: transaction.customerId,
      customerName: transaction.customerName,
      availableGames: 0,
      pendingGames: 0,
    };
    current.availableGames += transaction.balanceDelta;
    current.customerName = transaction.customerName;
    balances.set(transaction.customerId, current);
  });

  pendingAwards.forEach((award) => {
    const current = balances.get(award.customerId) ?? {
      customerId: award.customerId,
      customerName: award.customerName,
      availableGames: 0,
      pendingGames: 0,
    };
    current.pendingGames += award.games;
    current.customerName = award.customerName;
    balances.set(award.customerId, current);
  });

  return [...balances.values()].sort(
    (left, right) =>
      right.availableGames +
        right.pendingGames -
        (left.availableGames + left.pendingGames) ||
      left.customerName.localeCompare(right.customerName)
  );
}
