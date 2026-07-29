import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AdvanceGameTransactionType =
  | "earned"
  | "applied"
  | "undo"
  | "session_offset"
  | "transfer_in"
  | "transfer_out";

export interface AdvanceGameTransaction {
  id: string;
  type: AdvanceGameTransactionType;
  customerId: string;
  customerName: string;
  games: number;
  balanceDelta: number;
  createdAt: string;
  tableId?: number;
  tableName?: string;
  sessionId?: string;
  frameId?: string;
  finalGames?: number;
  opponent?: string;
  operator?: string;
  relatedBillId?: string;
  relatedTransactionId?: string;
  transferId?: string;
  note?: string;
}

interface EarnInput {
  transactionId: string;
  customerId: string;
  customerName: string;
  games: number;
  tableId: number;
  tableName: string;
  sessionId: string;
  frameId: string;
  finalGames: number;
  opponent?: string;
  operator?: string;
}

interface PendingAdvanceGameAward extends EarnInput {
  billId: string;
  stagedAt: string;
}

interface AdvanceGamesStore {
  transactions: AdvanceGameTransaction[];
  pendingAwards: PendingAdvanceGameAward[];
  customersInClub: Record<string, boolean>;
  getBalance: (customerId: string) => number;
  setCustomerInClub: (customerId: string, isInClub: boolean) => void;
  earn: (input: EarnInput) => boolean;
  stageEarn: (
    input: EarnInput & { billId: string }
  ) => boolean;
  releasePendingAwardsForBill: (
    billId: string
  ) => number;
  releasePendingAwardsForSession: (
    sessionId: string
  ) => number;
  cancelPendingAwardsForBill: (
    billId: string
  ) => number;
  cancelPendingAwardsForSession: (
    sessionId: string
  ) => number;
  cancelAwardsForSession: (
    sessionId: string
  ) => number;
  recordSessionOffset: (input: EarnInput) => boolean;
  applyToBill: (input: {
    transactionId: string;
    customerId: string;
    customerName: string;
    games: number;
    billId: string;
    operator?: string;
  }) => boolean;
  undoApplication: (input: {
    transactionId: string;
    applicationId: string;
    customerId: string;
    customerName: string;
    games: number;
    billId: string;
    operator?: string;
  }) => boolean;
  transfer: (input: {
    transferId: string;
    senderId: string;
    senderName: string;
    receiverId: string;
    receiverName: string;
    games: number;
    note?: string;
    operator?: string;
  }) => boolean;
  resetAdvanceGamesStore: () => void;
}

function wholePositive(value: number) {
  return Number.isInteger(value) && value > 0;
}

function safeTransactions(value: AdvanceGameTransaction[] | undefined) {
  return Array.isArray(value) ? value : [];
}

export const useAdvanceGamesStore = create<AdvanceGamesStore>()(
  persist(
    (set, get) => ({
      transactions: [],
      pendingAwards: [],
      customersInClub: {},
      getBalance: (customerId) =>
        safeTransactions(get().transactions)
          .filter((item) => item.customerId === customerId)
          .reduce((total, item) => total + item.balanceDelta, 0),
      setCustomerInClub: (customerId, isInClub) =>
        set((state) => ({
          customersInClub: {
            ...(state.customersInClub ?? {}),
            [customerId]: isInClub,
          },
        })),
      earn: (input) => {
        if (!wholePositive(input.games)) return false;
        if (safeTransactions(get().transactions).some((item) => item.id === input.transactionId)) return false;
        const transaction: AdvanceGameTransaction = {
          id: input.transactionId,
          type: "earned",
          customerId: input.customerId,
          customerName: input.customerName,
          games: input.games,
          balanceDelta: input.games,
          createdAt: new Date().toISOString(),
          tableId: input.tableId,
          tableName: input.tableName,
          sessionId: input.sessionId,
          frameId: input.frameId,
          finalGames: input.finalGames,
          opponent: input.opponent,
          operator: input.operator,
        };
        set((state) => ({ transactions: [transaction, ...(state.transactions ?? [])] }));
        return true;
      },
      stageEarn: (input) => {
        if (!wholePositive(input.games)) return false;
        if (
          safeTransactions(get().transactions).some(
            (item) => item.id === input.transactionId
          ) ||
          (get().pendingAwards ?? []).some(
            (item) => item.transactionId === input.transactionId
          )
        ) {
          return false;
        }
        set((state) => ({
          pendingAwards: [
            {
              ...input,
              stagedAt: new Date().toISOString(),
            },
            ...(state.pendingAwards ?? []),
          ],
        }));
        return true;
      },
      releasePendingAwardsForBill: (billId) => {
        const awards = (get().pendingAwards ?? []).filter(
          (item) => item.billId === billId
        );
        if (awards.length === 0) return 0;
        const existingIds = new Set(
          safeTransactions(get().transactions).map(
            (item) => item.id
          )
        );
        const releasedAt = new Date().toISOString();
        const transactions = awards
          .filter(
            (item) =>
              !existingIds.has(item.transactionId)
          )
          .map<AdvanceGameTransaction>((item) => ({
            id: item.transactionId,
            type: "earned",
            customerId: item.customerId,
            customerName: item.customerName,
            games: item.games,
            balanceDelta: item.games,
            createdAt: releasedAt,
            tableId: item.tableId,
            tableName: item.tableName,
            sessionId: item.sessionId,
            frameId: item.frameId,
            finalGames: item.finalGames,
            opponent: item.opponent,
            operator: item.operator,
            relatedBillId: item.billId,
          }));
        set((state) => ({
          transactions: [
            ...transactions,
            ...safeTransactions(state.transactions),
          ],
          pendingAwards: (
            state.pendingAwards ?? []
          ).filter(
            (item) => item.billId !== billId
          ),
        }));
        return transactions.reduce(
          (total, item) => total + item.games,
          0
        );
      },
      releasePendingAwardsForSession: (sessionId) => {
        const awards = (get().pendingAwards ?? []).filter(
          (item) => item.sessionId === sessionId
        );
        if (awards.length === 0) return 0;
        const existingIds = new Set(
          safeTransactions(get().transactions).map(
            (item) => item.id
          )
        );
        const releasedAt = new Date().toISOString();
        const transactions = awards
          .filter(
            (item) =>
              !existingIds.has(item.transactionId)
          )
          .map<AdvanceGameTransaction>((item) => ({
            id: item.transactionId,
            type: "earned",
            customerId: item.customerId,
            customerName: item.customerName,
            games: item.games,
            balanceDelta: item.games,
            createdAt: releasedAt,
            tableId: item.tableId,
            tableName: item.tableName,
            sessionId: item.sessionId,
            frameId: item.frameId,
            finalGames: item.finalGames,
            opponent: item.opponent,
            operator: item.operator,
            relatedBillId: item.billId,
          }));
        set((state) => ({
          transactions: [
            ...transactions,
            ...safeTransactions(state.transactions),
          ],
          pendingAwards: (
            state.pendingAwards ?? []
          ).filter(
            (item) => item.sessionId !== sessionId
          ),
        }));
        return transactions.reduce(
          (total, item) => total + item.games,
          0
        );
      },
      cancelPendingAwardsForBill: (billId) => {
        const awards = (get().pendingAwards ?? []).filter(
          (item) => item.billId === billId
        );
        if (awards.length === 0) return 0;
        set((state) => ({
          pendingAwards: (
            state.pendingAwards ?? []
          ).filter(
            (item) => item.billId !== billId
          ),
        }));
        return awards.reduce(
          (total, item) => total + item.games,
          0
        );
      },
      cancelPendingAwardsForSession: (sessionId) => {
        const awards = (get().pendingAwards ?? []).filter(
          (item) => item.sessionId === sessionId
        );
        if (awards.length === 0) return 0;
        set((state) => ({
          pendingAwards: (
            state.pendingAwards ?? []
          ).filter(
            (item) => item.sessionId !== sessionId
          ),
        }));
        return awards.reduce(
          (total, item) => total + item.games,
          0
        );
      },
      cancelAwardsForSession: (sessionId) => {
        const pendingAwards = (get().pendingAwards ?? []).filter(
          (item) => item.sessionId === sessionId
        );
        const earnedTransactions = safeTransactions(
          get().transactions
        ).filter(
          (item) =>
            item.sessionId === sessionId &&
            item.type === "earned"
        );

        if (
          pendingAwards.length === 0 &&
          earnedTransactions.length === 0
        ) {
          return 0;
        }

        set((state) => ({
          pendingAwards: (
            state.pendingAwards ?? []
          ).filter(
            (item) => item.sessionId !== sessionId
          ),
          transactions: safeTransactions(
            state.transactions
          ).filter(
            (item) =>
              item.sessionId !== sessionId ||
              item.type !== "earned"
          ),
        }));

        return [
          ...pendingAwards,
          ...earnedTransactions,
        ].reduce(
          (total, item) => total + item.games,
          0
        );
      },
      recordSessionOffset: (input) => {
        if (!wholePositive(input.games)) return false;
        if (safeTransactions(get().transactions).some((item) => item.id === input.transactionId)) return false;
        if (get().getBalance(input.customerId) < input.games) return false;
        const transaction: AdvanceGameTransaction = {
          id: input.transactionId,
          type: "session_offset",
          customerId: input.customerId,
          customerName: input.customerName,
          games: input.games,
          balanceDelta: -input.games,
          createdAt: new Date().toISOString(),
          tableId: input.tableId,
          tableName: input.tableName,
          sessionId: input.sessionId,
          frameId: input.frameId,
          finalGames: input.finalGames,
          opponent: input.opponent,
          operator: input.operator,
        };
        set((state) => ({ transactions: [transaction, ...safeTransactions(state.transactions)] }));
        return true;
      },
      applyToBill: (input) => {
        if (!wholePositive(input.games) || get().getBalance(input.customerId) < input.games) return false;
        if (safeTransactions(get().transactions).some((item) => item.id === input.transactionId)) return false;
        set((state) => ({ transactions: [{
          id: input.transactionId,
          type: "applied",
          customerId: input.customerId,
          customerName: input.customerName,
          games: input.games,
          balanceDelta: -input.games,
          createdAt: new Date().toISOString(),
          relatedBillId: input.billId,
          operator: input.operator,
        }, ...(state.transactions ?? [])] }));
        return true;
      },
      undoApplication: (input) => {
        if (!wholePositive(input.games)) return false;
        const application = safeTransactions(get().transactions).find((item) =>
          item.id === input.applicationId && item.type === "applied" &&
          item.customerId === input.customerId && item.relatedBillId === input.billId
        );
        if (!application || safeTransactions(get().transactions).some((item) => item.id === input.transactionId || item.relatedTransactionId === input.applicationId)) return false;
        set((state) => ({ transactions: [{
          id: input.transactionId,
          type: "undo",
          customerId: input.customerId,
          customerName: input.customerName,
          games: input.games,
          balanceDelta: input.games,
          createdAt: new Date().toISOString(),
          relatedBillId: input.billId,
          relatedTransactionId: input.applicationId,
          operator: input.operator,
        }, ...(state.transactions ?? [])] }));
        return true;
      },
      transfer: (input) => {
        if (input.senderId === input.receiverId || !wholePositive(input.games) || get().getBalance(input.senderId) < input.games) return false;
        if (safeTransactions(get().transactions).some((item) => item.transferId === input.transferId)) return false;
        const now = new Date().toISOString();
        set((state) => ({ transactions: [
          { id: `${input.transferId}-IN`, type: "transfer_in", customerId: input.receiverId, customerName: input.receiverName, games: input.games, balanceDelta: input.games, createdAt: now, transferId: input.transferId, note: input.note?.trim() || undefined, operator: input.operator },
          { id: `${input.transferId}-OUT`, type: "transfer_out", customerId: input.senderId, customerName: input.senderName, games: input.games, balanceDelta: -input.games, createdAt: now, transferId: input.transferId, note: input.note?.trim() || undefined, operator: input.operator },
          ...(state.transactions ?? []),
        ] }));
        return true;
      },
      resetAdvanceGamesStore: () => set({
        transactions: [],
        pendingAwards: [],
        customersInClub: {},
      }),
    }),
    { name: "snooker-arena-advance-games" }
  )
);
