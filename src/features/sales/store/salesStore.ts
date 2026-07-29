import {
  create,
} from "zustand";
import {
  persist,
} from "zustand/middleware";

import type { Sale } from "../types/sale";
import { generateInvoiceNumber } from "../utils/invoice";
import { formatWalkInBillNumber } from "@/features/sessions/utils/walkInLabel";
import {
  appendOperatorAuditEvent,
  createOperatorAuditEvent,
  getActiveOperatorSnapshot,
} from "@/lib/operatorAttribution";

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
          set((state) => {
            const paymentReceivedBy =
              sale.paymentReceivedBy ?? getActiveOperatorSnapshot();
            const hasPaymentAudit = sale.operatorAudit?.some(
              (event) => event.action === "payment_received",
            );
            const saleWithAttribution = {
              ...sale,
              paymentReceivedBy,
              operatorAudit: hasPaymentAudit
                ? sale.operatorAudit
                : appendOperatorAuditEvent(
                    sale.operatorAudit,
                    createOperatorAuditEvent("payment_received", {
                      occurredAt: sale.paidAt ?? sale.createdAt,
                      operator: paymentReceivedBy,
                    }),
                  ),
            };

            return {
            sales: [
              saleWithAttribution,
              ...state.sales,
            ],
            nextInvoiceSequence:
              state.nextInvoiceSequence + 1,
            };
          }),

        updateSalePaymentMethod: (saleId, paymentMethod) =>
          set((state) => ({
            sales: state.sales.map((sale) =>
              sale.id === saleId
                ? {
                    ...sale,
                    paymentMethod,
                    paymentSplits: undefined,
                    paymentCorrectedBy: getActiveOperatorSnapshot(),
                    operatorAudit: appendOperatorAuditEvent(
                      sale.operatorAudit,
                      createOperatorAuditEvent("payment_method_corrected"),
                    ),
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
