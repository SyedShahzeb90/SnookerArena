import { create } from "zustand";

import { initialTables } from "@/data/initialTables";

import type {
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

interface ReceivePaymentData {
  tableId: number;
  paymentMethod: PaymentMethod;
}

interface TableStore {
  tables: Table[];

  startSession: (
    data: StartSessionData
  ) => void;

  endSession: (
    tableId: number
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

            gameAmount: 0,
            cafeAmount: 0,
            discount: 0,
            totalAmount: 0,

            isPaid: false,
          };

          return {
            ...table,
            status: "running",
            session,
          };
        }),
      })),

    endSession: (tableId) =>
      set((state) => ({
        tables: state.tables.map((table) => {
          if (table.id !== tableId)
            return table;

          if (!table.session)
            return table;

          return {
            ...table,
            status: "payment-pending",

            session: {
              ...table.session,
              endTime: new Date(),
            },
          };
        }),
      })),

    receivePayment: ({
      tableId,
      paymentMethod,
    }) =>
      set((state) => ({
        tables: state.tables.map((table) => {
          if (table.id !== tableId)
            return table;

          if (!table.session)
            return table;

          return {
            ...table,

            status: "available",

            session: {
              ...table.session,
              paymentMethod,
              isPaid: true,
            },
          };
        }),
      })),
  }));