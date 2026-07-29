import { create } from "zustand";
import { persist } from "zustand/middleware";

import type {
  CustomerAccount,
  CustomerAccessoryCharge,
  CustomerCafeCharge,
  CustomerGameCharge,
} from "@/features/customers/types/customerAccount";
import type { PaymentMethod } from "@/types/session";
import type { PaymentSplit } from "@/features/sales/types/sale";
import {
  appendOperatorAuditEvent,
  createOperatorAuditEvent,
  getActiveOperatorSnapshot,
} from "@/lib/operatorAttribution";
import type {
  OperatorSnapshot,
  TransactionAuditEvent,
} from "@/types/operatorAudit";

export type CreditLedgerStatus =
  | "outstanding"
  | "paid"
  | "cancelled";

export interface CreditLedgerEntry {
  id: string;
  status: CreditLedgerStatus;
  sourceType: "customer_account";
  sourceCustomerAccountId: string;
  sourceCustomerToken: string;
  originalBillNumber: string;
  customerName: string;
  customerNote?: string;
  phone?: string;
  tableName?: string;
  openedAt: string;
  creditedAt: string;
  creditedBusinessDayId?: string;
  issuedBy?: OperatorSnapshot;
  recoveredBy?: OperatorSnapshot;
  cancelledBy?: OperatorSnapshot;
  operatorAudit?: TransactionAuditEvent[];
  creditNote?: string;
  gameCharges: CustomerGameCharge[];
  cafeCharges: CustomerCafeCharge[];
  accessoryCharges: CustomerAccessoryCharge[];
  tableTotal: number;
  cafeTotal: number;
  accessoryTotal: number;
  discount: number;
  finalAmount: number;
  paidAt?: string;
  paymentBusinessDayId?: string;
  paymentMethod?: PaymentMethod;
  paymentSplits?: PaymentSplit[];
  saleId?: string;
  cancelledAt?: string;
  cancelReason?: string;
}

interface AddCreditInput {
  account: CustomerAccount;
  originalBillNumber: string;
  tableName?: string;
  cafeTotal: number;
  accessoryTotal: number;
  finalAmount: number;
  tableTotal?: number;
  discount?: number;
  creditNote?: string;
  businessDayId?: string;
}

interface MarkPaidInput {
  id: string;
  paymentMethod: PaymentMethod;
  paymentSplits?: PaymentSplit[];
  paymentBusinessDayId: string;
  saleId: string;
}

interface CreditLedgerStore {
  entries: CreditLedgerEntry[];
  addCreditFromCustomerBill: (
    input: AddCreditInput
  ) => CreditLedgerEntry | undefined;
  markCreditPaid: (input: MarkPaidInput) => void;
  updateCreditCustomer: (
    id: string,
    input: {
      customerName: string;
      customerNote?: string;
      phone?: string;
    }
  ) => void;
  cancelCredit: (
    id: string,
    reason: string
  ) => void;
  resetCreditLedgerStore: () => void;
}

export const selectOutstandingCreditCount = (
  state: Pick<CreditLedgerStore, "entries">
) =>
  state.entries.filter(
    (entry) => entry.status === "outstanding"
  ).length;

function cloneArray<T>(value: T[] | undefined) {
  return Array.isArray(value) ? [...value] : [];
}

export const useCreditLedgerStore =
  create<CreditLedgerStore>()(
    persist(
      (set, get) => ({
        entries: [],

        addCreditFromCustomerBill: (input) => {
          const exists = get().entries.some(
            (entry) =>
              entry.sourceCustomerAccountId ===
                input.account.id &&
              entry.status !== "cancelled"
          );

          if (exists) return undefined;

          const now = new Date().toISOString();
          const cappedDiscount = Math.min(
            input.account.discount,
            input.account.totalGameAmount
          );

          const entry: CreditLedgerEntry = {
            id: `CREDIT-${Date.now()}`,
            status: "outstanding",
            sourceType: "customer_account",
            sourceCustomerAccountId:
              input.account.id,
            sourceCustomerToken:
              input.account.customerToken,
            originalBillNumber:
              input.originalBillNumber,
            customerName:
              input.account.customerName,
            customerNote:
              input.account.customerNote,
            phone: input.account.phone,
            tableName: input.tableName,
            openedAt: input.account.openedAt,
            creditedAt: now,
            creditedBusinessDayId:
              input.businessDayId,
            issuedBy: getActiveOperatorSnapshot(),
            operatorAudit: appendOperatorAuditEvent(
              undefined,
              createOperatorAuditEvent("credit_issued", { occurredAt: now }),
            ),
            creditNote:
              input.creditNote?.trim() ||
              undefined,
            gameCharges: cloneArray(
              input.account.gameCharges
            ),
            cafeCharges: cloneArray(
              input.account.cafeCharges
            ).filter(
              (charge) =>
                !charge.name.startsWith(
                  "[Accessory]"
                )
            ),
            accessoryCharges: [
              ...cloneArray(
                input.account.accessoryCharges
              ),
              ...cloneArray(
                input.account.cafeCharges
              ).filter((charge) =>
                charge.name.startsWith(
                  "[Accessory]"
                )
              ),
            ],
            tableTotal:
              input.tableTotal ?? input.account.totalGameAmount,
            cafeTotal: input.cafeTotal,
            accessoryTotal:
              input.accessoryTotal,
            discount: input.discount ?? cappedDiscount,
            finalAmount: input.finalAmount,
          };

          set((state) => ({
            entries: [entry, ...state.entries],
          }));

          return entry;
        },

        markCreditPaid: (input) =>
          set((state) => ({
            entries: state.entries.map((entry) =>
              entry.id === input.id &&
              entry.status === "outstanding"
                ? {
                    ...entry,
                    status: "paid",
                    paidAt:
                      new Date().toISOString(),
                    paymentBusinessDayId:
                      input.paymentBusinessDayId,
                    paymentMethod:
                      input.paymentMethod,
                    paymentSplits:
                      input.paymentSplits,
                    saleId: input.saleId,
                    recoveredBy: getActiveOperatorSnapshot(),
                    operatorAudit: appendOperatorAuditEvent(
                      entry.operatorAudit,
                      createOperatorAuditEvent("credit_recovered"),
                    ),
                  }
                : entry
            ),
          })),

        updateCreditCustomer: (id, input) =>
          set((state) => ({
            entries: state.entries.map((entry) =>
              entry.id === id
                ? {
                    ...entry,
                    customerName:
                      input.customerName.trim(),
                    customerNote:
                      input.customerNote?.trim() ||
                      undefined,
                    phone:
                      input.phone?.trim() ||
                      undefined,
                  }
                : entry
            ),
          })),

        cancelCredit: (id, reason) =>
          set((state) => ({
            entries: state.entries.map((entry) =>
              entry.id === id &&
              entry.status === "outstanding"
                ? {
                    ...entry,
                    status: "cancelled",
                    cancelledAt:
                      new Date().toISOString(),
                    cancelReason: reason.trim(),
                    cancelledBy: getActiveOperatorSnapshot(),
                    operatorAudit: appendOperatorAuditEvent(
                      entry.operatorAudit,
                      createOperatorAuditEvent("cancelled", {
                        note: reason,
                      }),
                    ),
                  }
                : entry
            ),
          })),

        resetCreditLedgerStore: () =>
          set({ entries: [] }),
      }),
      {
        name: "snooker-arena-credit-ledger",
      }
    )
  );
