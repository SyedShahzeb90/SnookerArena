import { create } from "zustand";
import { persist } from "zustand/middleware";

import { useCafeStore } from "@/features/cafe/store/cafeStore";
import { useBusinessDayStore } from "@/features/business-day/store/businessDayStore";
import { useSalesStore } from "@/features/sales/store/salesStore";
import { createSaleFromTable } from "@/features/sales/utils/createSale";
import { calculateGamePrice } from "@/features/pricing/utils/calculateGamePrice";
import { useTableHistoryStore } from "@/features/table-history/store/tableHistoryStore";
import { useCustomerAccountStore } from "@/features/customers/store/customerAccountStore";
import type {
  PaymentSplit,
} from "@/features/sales/types/sale";
import type {
  PaymentMethod,
  Session,
} from "@/types/session";
import type { Table } from "@/types/table";
import {
  formatWalkInBillNumber,
  getWalkInBillPrefix,
  isWalkInName,
} from "@/features/sessions/utils/walkInLabel";
import { hasPlayerName } from "../utils/playerBillIdentity";

function getPendingBillTableAmount(
  bill: PendingBill
) {
  if (bill.session.settledTableAmount !== undefined) {
    return bill.session.settledTableAmount;
  }
  const lineTotal =
    bill.session.tableChargeLines?.reduce(
      (total, line) => total + line.amount,
      0
    );

  if (lineTotal !== undefined) {
    return lineTotal;
  }

  if (!bill.session.endTime) {
    return 0;
  }

  return calculateGamePrice({
    sessionType: bill.session.sessionType,
    tableType: bill.tableType,
    startTime: new Date(bill.session.startTime),
    endTime: new Date(bill.session.endTime),
  }).gameAmount;
}

export interface PendingBill {
  id: string;
  tableId: number;
  tableName: string;
  tableType: Table["type"];
  session: Session;
  createdAt: string;
  status: "pending" | "cancelled";
  paidPlayerNames?: string[];
  staffBillNumber?: string;
  cancelledAt?: string;
  cancelledReason?: string;
  cancelledNote?: string;
}

interface AddPendingBillInput {
  table: Table;
  session: Session;
}

interface ReceivePendingBillPaymentInput {
  billId: string;
  paymentMethod: PaymentMethod;
  paymentSplits?: PaymentSplit[];
  payerName?: string;
  discount?: number;
}

interface CancelPendingBillInput {
  billId: string;
  reason: string;
  note?: string;
}

interface ReceivePendingPlayerBillPaymentInput
  extends ReceivePendingBillPaymentInput {
  playerName: string;
  tableAmount: number;
  cafeAmount: number;
  cafeItems: Session["cafeOrders"];
  allPlayerNames: string[];
}

interface CheckoutStore {
  pendingBills: PendingBill[];
  walkInBillSequences: Record<string, number>;
  addPendingBill: (
    input: AddPendingBillInput
  ) => PendingBill;
  removePendingBill: (
    billId: string
  ) => void;
  cancelPendingBill: (
    input: CancelPendingBillInput
  ) => void;
  updatePendingBillDiscount: (
    billId: string,
    discount: number
  ) => void;
  receivePendingBillPayment: (
    input: ReceivePendingBillPaymentInput
  ) => void;
  receivePendingPlayerBillPayment: (
    input: ReceivePendingPlayerBillPaymentInput
  ) => void;
  resetBillingStore: () => void;
}

export const useCheckoutStore =
  create<CheckoutStore>()(
    persist(
      (set, get) => ({
        pendingBills: [],
        walkInBillSequences: {},

        addPendingBill: ({
          table,
          session,
        }) => {
          let createdBill: PendingBill | undefined;

          set((state) => {
            const existingBill =
              state.pendingBills.find(
                (pendingBill) =>
                  pendingBill.id ===
                  `BILL-${session.id}`
              );
            const exists = Boolean(existingBill);
            const walkInPayerName =
              session.payerName ??
              session.loserName ??
              session.player1;
            const linkedCustomerAccount =
              [
                session.player1CustomerId,
                session.player2CustomerId,
                session.player3CustomerId,
                session.player4CustomerId,
                session.payerCustomerId,
              ]
                .filter(
                  (id): id is string =>
                    Boolean(id)
                )
                .map((id) =>
                  useCustomerAccountStore
                    .getState()
                    .getCustomerById(id)
                )
                .find(
                  (account) =>
                    account?.staffBillNumber
                );
            const shouldGenerateBillNumber =
              !exists &&
              !linkedCustomerAccount?.staffBillNumber &&
              isWalkInName(walkInPayerName);
            const prefix =
              shouldGenerateBillNumber
                ? getWalkInBillPrefix({
                    tableId: table.id,
                    tableName: table.name,
                    tableType: table.type,
                  })
                : "";
            const nextSequence =
              shouldGenerateBillNumber
                ? ((state.walkInBillSequences ?? {})[
                    prefix
                  ] ?? 0) + 1
                : undefined;
            const bill: PendingBill = {
              id: `BILL-${session.id}`,
              tableId: table.id,
              tableName: table.name,
              tableType: table.type,
              session,
              createdAt:
                new Date().toISOString(),
              status: "pending",
              paidPlayerNames: [],
              staffBillNumber:
                existingBill?.staffBillNumber ??
                linkedCustomerAccount?.staffBillNumber ??
                (nextSequence && prefix
                  ? formatWalkInBillNumber(
                      prefix,
                      nextSequence
                    )
                  : undefined),
            };
            createdBill = bill;

            return {
              walkInBillSequences:
                nextSequence && prefix
                  ? {
                      ...(state.walkInBillSequences ?? {}),
                      [prefix]: nextSequence,
                    }
                  : state.walkInBillSequences ?? {},
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
          });

          return createdBill!;
        },

        removePendingBill: (billId) =>
          set((state) => ({
            pendingBills:
              state.pendingBills.filter(
                (bill) =>
                  bill.id !== billId
              ),
          })),

        cancelPendingBill: ({
          billId,
          reason,
          note,
        }) => {
          const cancelledAt =
            new Date().toISOString();
          const cancelledNote =
            note?.trim() || undefined;

          useTableHistoryStore
            .getState()
            .updateHistoryByPendingBillId(
              billId,
              {
                paymentStatus: "cancelled",
                paidAt: undefined,
                cancelledAt,
                cancelledReason: reason,
                cancelledNote,
              }
            );

          set((state) => ({
            pendingBills:
              state.pendingBills.map(
                (bill) =>
                  bill.id === billId
                    ? {
                        ...bill,
                        status: "cancelled",
                        cancelledAt,
                        cancelledReason: reason,
                        cancelledNote,
                      }
                    : bill
              ),
          }));
        },

        updatePendingBillDiscount: (
          billId,
          discount
        ) =>
          set((state) => ({
            pendingBills:
              state.pendingBills.map(
                (bill) =>
                  bill.id === billId
                    ? (() => {
                        const eligibleDiscount =
                          Math.min(
                            Math.max(0, discount),
                            getPendingBillTableAmount(
                              bill
                            ) + bill.cafeAmount
                          );

                        return {
                          ...bill,
                          session: {
                            ...bill.session,
                            discount: eligibleDiscount,
                          },
                        };
                      })()
                    : bill
              ),
          })),

        receivePendingBillPayment: ({
          billId,
          paymentMethod,
          paymentSplits,
          payerName,
          discount,
        }) => {
          const bill =
            get().pendingBills.find(
              (pendingBill) =>
                pendingBill.id === billId
            );

          if (!bill) return;
          if (bill.status === "cancelled") return;
          const activeDay =
            useBusinessDayStore
              .getState()
              .getActiveBusinessDay();

          if (!activeDay) return;

          const session: Session = {
            ...bill.session,
            discount:
              discount ??
              bill.session.discount,
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
            paymentSplits,
            invoiceNumber,
          });

          if (sale) {
            salesStore.addSale({
              ...sale,
              staffBillNumber:
                bill.staffBillNumber,
              activeBusinessDayId:
                activeDay.id,
            });
            useTableHistoryStore
              .getState()
              .updateHistoryByPendingBillId(
                billId,
                {
                  invoiceNumber:
                    sale.invoiceNumber,
                  billNo:
                    sale.staffBillNumber,
                  displayToken:
                    sale.staffBillNumber,
                  staffBillNumber:
                    sale.staffBillNumber,
                  saleId: sale.id,
                  payerName:
                    sale.payerName,
                  paymentStatus: "paid",
                  paidAt:
                    sale.paidAt ??
                    new Date().toISOString(),
                }
              );
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

        receivePendingPlayerBillPayment: ({
          billId,
          paymentMethod,
          paymentSplits,
          payerName,
          discount,
          playerName,
          tableAmount,
          cafeAmount,
          cafeItems,
          allPlayerNames,
        }) => {
          const bill =
            get().pendingBills.find(
              (pendingBill) =>
                pendingBill.id === billId
            );

          if (!bill) return;
          if (bill.status === "cancelled") return;
          const activeDay =
            useBusinessDayStore
              .getState()
              .getActiveBusinessDay();

          if (!activeDay) return;

          const paidPlayerNames = [
            ...(bill.paidPlayerNames ?? []),
          ];

          if (
            hasPlayerName(
              paidPlayerNames,
              playerName
            )
          ) {
            return;
          }

          const salesStore =
            useSalesStore.getState();
          const invoiceNumber =
            salesStore.getNextInvoiceNumber();
          const session: Session = {
            ...bill.session,
            discount:
              discount ??
              bill.session.discount,
            payerName:
              payerName ??
              bill.session.payerName,
            paymentMethod,
            isPaid: true,
          };
          const sale = createSaleFromTable({
            table: {
              id: bill.tableId,
              name: bill.tableName,
              type: bill.tableType,
              status: "payment-pending",
              session,
            },
            paymentMethod,
            paymentSplits,
            invoiceNumber,
            playerBill: {
              playerName,
              tableAmount,
              cafeAmount,
              cafeItems,
              discount,
            },
          });

          if (sale) {
            salesStore.addSale({
              ...sale,
              staffBillNumber:
                bill.staffBillNumber,
              activeBusinessDayId:
                activeDay.id,
            });
          }

          const nextPaidPlayerNames = [
            ...paidPlayerNames,
            playerName,
          ];
          const allBillsReceived =
            allPlayerNames.every((name) =>
              hasPlayerName(
                nextPaidPlayerNames,
                name
              )
            );

          if (allBillsReceived) {
            useCafeStore
              .getState()
              .clearSessionOrders(
                bill.tableId,
                bill.session.id
              );

            if (sale) {
              useTableHistoryStore
                .getState()
                .updateHistoryByPendingBillId(
                  billId,
                  {
                    invoiceNumber:
                      sale.invoiceNumber,
                    billNo:
                      sale.staffBillNumber,
                    displayToken:
                      sale.staffBillNumber,
                    staffBillNumber:
                      sale.staffBillNumber,
                    saleId: sale.id,
                    payerName:
                      sale.payerName,
                    paymentStatus: "paid",
                    paidAt:
                      sale.paidAt ??
                      new Date().toISOString(),
                  }
                );
            }
          }

          set((state) => ({
            pendingBills:
              allBillsReceived
                ? state.pendingBills.filter(
                    (pendingBill) =>
                      pendingBill.id !== billId
                  )
                : state.pendingBills.map(
                    (pendingBill) =>
                      pendingBill.id === billId
                        ? {
                            ...pendingBill,
                            paidPlayerNames:
                              nextPaidPlayerNames,
                          }
                        : pendingBill
                  ),
          }));
        },

        resetBillingStore: () =>
          set({
            pendingBills: [],
            walkInBillSequences: {},
          }),
      }),
      {
        name: "snooker-arena-checkout",
      }
    )
  );
