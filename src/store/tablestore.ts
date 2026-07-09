import { create } from "zustand";

import { initialTables } from "@/data/initialTables";
import { useCheckoutStore } from "@/features/billing/store/checkoutStore";
import { useCafeStore } from "@/features/cafe/store/cafeStore";
import { useSalesStore } from "@/features/sales/store/salesStore";
import { createSaleFromTable } from "@/features/sales/utils/createSale";

import type {
  CafeOrderItem,
  PaymentMethod,
  Session,
  SessionType,
} from "@/types/session";

import type { Table } from "@/types/table";

interface StartSessionData {
  tableId: number;
  sessionType: SessionType;
  player1: string;
  player2?: string;
  startTime: Date;
}

interface UpdateSessionData {
  tableId: number;
  player1: string;
  player2?: string;
  sessionType: SessionType;
  startTime: Date;
}

interface ReceivePaymentData {
  tableId: number;
  paymentMethod: PaymentMethod;
  payerName?: string;
}

interface UpdateSessionCafeData {
  tableId: number;
  cafeOrders: CafeOrderItem[];
}

interface EndSessionData {
  tableId: number;
  winnerName?: string;
  loserName?: string;
  payerName?: string;
}

interface TableStore {
  tables: Table[];

  startSession: (
    data: StartSessionData
  ) => void;

  updateSession: (
    data: UpdateSessionData
  ) => void;

  pauseSession: (
    tableId: number
  ) => void;

  resumeSession: (
    tableId: number
  ) => void;

  endSession: (data: EndSessionData) => void;

  updateSessionCafe: (
    data: UpdateSessionCafeData
  ) => void;

  receivePayment: (
    data: ReceivePaymentData
  ) => void;
}

export const useTableStore =
  create<TableStore>((set) => ({
    tables: initialTables,

    startSession: (data) =>
      set((state) => ({
        tables: state.tables.map((table) => {
          if (table.id !== data.tableId)
            return table;

          const session: Session = {
            id: `SA-${Date.now()}`,
            tableId: table.id,
            sessionType: data.sessionType,
            player1: data.player1,
            player2: data.player2,
            startTime: data.startTime,

            pausedAt: undefined,
            totalPausedMilliseconds: 0,

            cafeAmount: 0,
            cafeOrders: [],
            discount: 0,

            isPaid: false,
          };

          return {
            ...table,
            status: "running",
            session,
          };
        }),
      })),

    updateSession: (data) =>
      set((state) => ({
        tables: state.tables.map((table) => {
          if (table.id !== data.tableId)
            return table;

          if (!table.session)
            return table;

          return {
            ...table,
            session: {
              ...table.session,
              player1: data.player1,
              player2: data.player2,
              sessionType:
                data.sessionType,
              startTime:
                data.startTime,
            },
          };
        }),
      })),

    pauseSession: (tableId) =>
      set((state) => ({
        tables: state.tables.map((table) => {
          if (table.id !== tableId)
            return table;

          if (!table.session)
            return table;

          return {
            ...table,
            status: "paused",
            session: {
              ...table.session,
              pausedAt: new Date(),
            },
          };
        }),
      })),

    resumeSession: (tableId) =>
      set((state) => ({
        tables: state.tables.map((table) => {
          if (table.id !== tableId)
            return table;

          if (
            !table.session ||
            !table.session.pausedAt
          )
            return table;

          const pausedTime =
            Date.now() -
            new Date(
              table.session.pausedAt
            ).getTime();

          return {
            ...table,
            status: "running",
            session: {
              ...table.session,
              pausedAt: undefined,
              totalPausedMilliseconds:
                table.session
                  .totalPausedMilliseconds +
                pausedTime,
            },
          };
        }),
      })),

    endSession: ({
      tableId,
      winnerName,
      loserName,
      payerName,
    }) =>
      set((state) => ({
        tables: state.tables.map((table) => {
          if (table.id !== tableId)
            return table;

          if (!table.session)
            return table;

          let totalPausedMilliseconds =
            table.session
              .totalPausedMilliseconds;

          if (table.session.pausedAt) {
            totalPausedMilliseconds +=
              Date.now() -
              new Date(
                table.session.pausedAt
              ).getTime();
          }

          const endedSession: Session = {
            ...table.session,
            pausedAt: undefined,
            totalPausedMilliseconds,
            endTime: new Date(),
            winnerName,
            loserName,
            payerName,
          };

          useCheckoutStore
            .getState()
            .addPendingBill({
              table,
              session: endedSession,
            });

          return {
            ...table,
            status: "available",
            session: undefined,
          };
        }),
      })),

    updateSessionCafe: ({
      tableId,
      cafeOrders,
    }) =>
      set((state) => {
        let changed = false;

        const tables = state.tables.map((table) => {
          if (table.id !== tableId) {
            return table;
          }

          if (!table.session) {
            return table;
          }

          const cafeAmount =
            cafeOrders.reduce(
              (total, item) =>
                total + item.subtotal,
              0
            );

          const existingSignature =
            JSON.stringify(
              table.session.cafeOrders
            );
          const nextSignature =
            JSON.stringify(cafeOrders);

          if (
            table.session.cafeAmount ===
              cafeAmount &&
            existingSignature === nextSignature
          ) {
            return table;
          }

          changed = true;

          return {
            ...table,
            session: {
              ...table.session,
              cafeOrders,
              cafeAmount,
            },
          };
        });

        if (!changed) {
          return state;
        }

        return { tables };
      }),

    receivePayment: ({
      tableId,
      paymentMethod,
      payerName,
    }) =>
      set((state) => ({
        tables: state.tables.map((table) => {
          if (table.id !== tableId)
            return table;

          if (!table.session)
            return table;

          const salesStore =
            useSalesStore.getState();
          const invoiceNumber =
            salesStore.getNextInvoiceNumber();
          const tableForSale = {
            ...table,
            session: {
              ...table.session,
              payerName:
                payerName ??
                table.session.payerName,
            },
          };
          const sale = createSaleFromTable({
            table: tableForSale,
            paymentMethod,
            invoiceNumber,
          });

          if (sale) {
            salesStore.addSale(sale);
          }

          console.log("Paid Session", {
            ...tableForSale.session,
            paymentMethod,
            isPaid: true,
          });

          useCafeStore
            .getState()
            .clearTableOrders(tableId);

          return {
            ...table,
            status: "available",
            session: undefined,
          };
        }),
      })),
  }));
