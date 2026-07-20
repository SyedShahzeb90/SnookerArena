import {
  create,
} from "zustand";
import {
  persist,
} from "zustand/middleware";

import type { Sale } from "../types/sale";
import { generateInvoiceNumber } from "../utils/invoice";
import { formatWalkInBillNumber } from "@/features/sessions/utils/walkInLabel";

interface SalesStore {
  sales: Sale[];
  nextInvoiceSequence: number;
  walkInBillSequences: Record<string, number>;
  getNextInvoiceNumber: () => string;
  getNextWalkInBillNumber: (
    prefix: string
  ) => string;
  addSale: (sale: Sale) => void;
  updateSalePaymentMethod: (
    saleId: string,
    paymentMethod: Sale["paymentMethod"]
  ) => void;
  deleteSale: (saleId: string) => void;
  resetSalesStore: () => void;
}

export const useSalesStore =
  create<SalesStore>()(
    persist(
      (set, get) => ({
        sales: [],
        nextInvoiceSequence: 1,
        walkInBillSequences: {},

        getNextInvoiceNumber: () =>
          generateInvoiceNumber(
            get().nextInvoiceSequence
          ),

        getNextWalkInBillNumber: (prefix) => {
          const sequence =
            ((get().walkInBillSequences ?? {})[
              prefix
            ] ?? 0) + 1;

          set((state) => ({
            walkInBillSequences: {
              ...(state.walkInBillSequences ?? {}),
              [prefix]: sequence,
            },
          }));

          return formatWalkInBillNumber(
            prefix,
            sequence
          );
        },

        addSale: (sale) =>
          set((state) => ({
            sales: [
              sale,
              ...state.sales,
            ],
            nextInvoiceSequence:
              state.nextInvoiceSequence + 1,
          })),

        updateSalePaymentMethod: (saleId, paymentMethod) =>
          set((state) => ({
            sales: state.sales.map((sale) =>
              sale.id === saleId
                ? {
                    ...sale,
                    paymentMethod,
                    paymentSplits: undefined,
                  }
                : sale
            ),
          })),

        deleteSale: (saleId) =>
          set((state) => ({
            sales: state.sales.filter(
              (sale) => sale.id !== saleId
            ),
          })),

        resetSalesStore: () =>
          set({
            sales: [],
            nextInvoiceSequence: 1,
            walkInBillSequences: {},
          }),
      }),
      {
        name: "snooker-arena-sales",
      }
    )
  );
