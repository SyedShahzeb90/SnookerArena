import {
  create,
} from "zustand";
import {
  persist,
} from "zustand/middleware";

import type { Sale } from "../types/sale";
import { generateInvoiceNumber } from "../utils/invoice";

interface SalesStore {
  sales: Sale[];
  nextInvoiceSequence: number;
  getNextInvoiceNumber: () => string;
  addSale: (sale: Sale) => void;
}

export const useSalesStore =
  create<SalesStore>()(
    persist(
      (set, get) => ({
        sales: [],
        nextInvoiceSequence: 1,

        getNextInvoiceNumber: () =>
          generateInvoiceNumber(
            get().nextInvoiceSequence
          ),

        addSale: (sale) =>
          set((state) => ({
            sales: [
              sale,
              ...state.sales,
            ],
            nextInvoiceSequence:
              state.nextInvoiceSequence + 1,
          })),
      }),
      {
        name: "snooker-arena-sales",
      }
    )
  );
