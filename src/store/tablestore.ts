import { create } from "zustand";
import { initialTables } from "../data/initialTables";
import type { SessionType, Table } from "../types/table";

interface TableStore {
  tables: Table[];

  startSession: (
    tableId: number,
    sessionType: SessionType,
    players: string[]
  ) => void;

  endSession: (tableId: number) => void;
}

export const useTableStore = create<TableStore>((set) => ({
  tables: initialTables,

  startSession: (tableId, sessionType, players) =>
    set((state) => ({
      tables: state.tables.map((table) => {
        if (table.id !== tableId) return table;

        return {
          ...table,
          status: "running",
          sessionType,
          players,
          sessionId: `SA-${Date.now()}`,
          startedAt: Date.now(),
        };
      }),
    })),

  endSession: (tableId) =>
    set((state) => ({
      tables: state.tables.map((table) => {
        if (table.id !== tableId) return table;

        return {
          ...table,
          status: "available",
          sessionType: undefined,
          players: [],
          sessionId: undefined,
          startedAt: undefined,
        };
      }),
    })),
}));