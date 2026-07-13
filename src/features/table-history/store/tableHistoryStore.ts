import { create } from "zustand";
import { persist } from "zustand/middleware";

import type {
  TableHistoryPaymentStatus,
  TableHistoryRecord,
} from "../types/tableHistory";

interface TableHistoryStore {
  records: TableHistoryRecord[];
  addTableHistoryRecord: (
    record: TableHistoryRecord
  ) => void;
  updateTableHistoryRecord: (
    id: string,
    updates: Partial<TableHistoryRecord>
  ) => void;
  updateHistoryByPendingBillId: (
    pendingBillId: string,
    updates: Partial<TableHistoryRecord>
  ) => void;
  getHistoryByTableId: (
    tableId: number
  ) => TableHistoryRecord[];
  getHistoryByPlayerName: (
    playerName: string
  ) => TableHistoryRecord[];
  getHistoryByDateRange: (
    start: Date,
    end: Date
  ) => TableHistoryRecord[];
  getTodayHistory: () => TableHistoryRecord[];
  getHistoryByPaymentStatus: (
    status: TableHistoryPaymentStatus
  ) => TableHistoryRecord[];
  resetTableHistoryStore: () => void;
}

function isSameDay(date: Date, target: Date) {
  return (
    date.getFullYear() === target.getFullYear() &&
    date.getMonth() === target.getMonth() &&
    date.getDate() === target.getDate()
  );
}

export const useTableHistoryStore =
  create<TableHistoryStore>()(
    persist(
      (set, get) => ({
        records: [],

        addTableHistoryRecord: (record) =>
          set((state) => {
            const exists =
              state.records.some(
                (item) =>
                  item.id === record.id ||
                  item.sessionId ===
                    record.sessionId
              );

            return {
              records: exists
                ? state.records.map((item) =>
                    item.id === record.id ||
                    item.sessionId ===
                      record.sessionId
                      ? {
                          ...item,
                          ...record,
                          updatedAt:
                            new Date().toISOString(),
                        }
                      : item
                  )
                : [record, ...state.records],
            };
          }),

        updateTableHistoryRecord: (
          id,
          updates
        ) =>
          set((state) => ({
            records: state.records.map(
              (record) =>
                record.id === id
                  ? {
                      ...record,
                      ...updates,
                      updatedAt:
                        new Date().toISOString(),
                    }
                  : record
            ),
          })),

        updateHistoryByPendingBillId: (
          pendingBillId,
          updates
        ) =>
          set((state) => ({
            records: state.records.map(
              (record) =>
                record.pendingBillId ===
                pendingBillId
                  ? {
                      ...record,
                      ...updates,
                      updatedAt:
                        new Date().toISOString(),
                    }
                  : record
            ),
          })),

        getHistoryByTableId: (tableId) =>
          get().records.filter(
            (record) =>
              record.tableId === tableId
          ),

        getHistoryByPlayerName: (
          playerName
        ) => {
          const query =
            playerName.toLowerCase();

          return get().records.filter(
            (record) =>
              [
                ...record.players,
                record.payerName,
                record.winnerName,
                record.loserName,
              ]
                .filter(Boolean)
                .some((name) =>
                  String(name)
                    .toLowerCase()
                    .includes(query)
                )
          );
        },

        getHistoryByDateRange: (
          start,
          end
        ) =>
          get().records.filter(
            (record) => {
              const endedAt = new Date(
                record.endedAt
              );

              return (
                endedAt >= start &&
                endedAt <= end
              );
            }
          ),

        getTodayHistory: () => {
          const today = new Date();

          return get().records.filter(
            (record) =>
              isSameDay(
                new Date(record.endedAt),
                today
              )
          );
        },

        getHistoryByPaymentStatus: (
          status
        ) =>
          get().records.filter(
            (record) =>
              record.paymentStatus === status
          ),

        resetTableHistoryStore: () =>
          set({
            records: [],
          }),
      }),
      {
        name: "snooker-arena-table-history",
      }
    )
  );
