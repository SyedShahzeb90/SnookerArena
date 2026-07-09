import { create } from "zustand";
import { persist } from "zustand/middleware";

import { useCafeStore } from "@/features/cafe/store/cafeStore";
import { useSalesStore } from "@/features/sales/store/salesStore";
import { createSaleFromTable } from "@/features/sales/utils/createSale";
import type {
  PaymentMethod,
  Session,
} from "@/types/session";
import type { Table } from "@/types/table";

export interface PendingBill {
  id: string;
  tableId: number;
  tableName: string;
  tableType: Table["type"];
  session: Session;
  createdAt: string;
  status: "pending";
}

interface AddPendingBillInput {
  table: Table;
  session: Session;
}

interface ReceivePendingBillPaymentInput {
  billId: string;
  paymentMethod: PaymentMethod;
  payerName?: string;
}

interface CheckoutStore {
  pendingBills: PendingBill[];
  addPendingBill: (
    input: AddPendingBillInput
  ) => void;
  removePendingBill: (
    billId: string
  ) => void;
  receivePendingBillPayment: (
    input: ReceivePendingBillPaymentInput
  ) => void;
}

export const useCheckoutStore =
  create<CheckoutStore>()(
    persist(
      (set, get) => ({
        pendingBills: [],

        addPendingBill: ({
          table,
          session,
        }) =>
          set((state) => {
            const bill: PendingBill = {
              id: `BILL-${session.id}`,
              tableId: table.id,
              tableName: table.name,
              tableType: table.type,
              session,
              createdAt:
                new Date().toISOString(),
              status: "pending",
            };

            const exists =
              state.pendingBills.some(
                (pendingBill) =>
                  pendingBill.id === bill.id
              );

            return {
              pendingBills: exists
                ? state.pendingBills.map(
                    (pendingBill) =>
                      pendingBill.id === bill.id
                        ? bill
                        : pendingBill
                  )
                : [
                    bill,
                    ...state.pendingBills,
                  ],
            };
          }),

        removePendingBill: (billId) =>
          set((state) => ({
            pendingBills:
              state.pendingBills.filter(
                (bill) =>
                  bill.id !== billId
              ),
          })),

        receivePendingBillPayment: ({
          billId,
          paymentMethod,
          payerName,
        }) => {
          const bill =
            get().pendingBills.find(
              (pendingBill) =>
                pendingBill.id === billId
            );

          if (!bill) return;

          const session: Session = {
            ...bill.session,
            payerName:
              payerName ??
              bill.session.payerName,
            paymentMethod,
            isPaid: true,
          };

          const salesStore =
            useSalesStore.getState();
          const invoiceNumber =
            salesStore.getNextInvoiceNumber();
          const sale = createSaleFromTable({
            table: {
              id: bill.tableId,
              name: bill.tableName,
              type: bill.tableType,
              status: "payment-pending",
              session,
            },
            paymentMethod,
            invoiceNumber,
          });

          if (sale) {
            salesStore.addSale(sale);
          }

          useCafeStore
            .getState()
            .clearSessionOrders(
              bill.tableId,
              bill.session.id
            );

          set((state) => ({
            pendingBills:
              state.pendingBills.filter(
                (pendingBill) =>
                  pendingBill.id !== billId
              ),
          }));
        },
      }),
      {
        name: "snooker-arena-checkout",
      }
    )
  );
