import { create } from "zustand";
import { persist } from "zustand/middleware";

import type {
  OutsidePurchase,
  OutsidePurchaseInput,
  OutsidePurchaseReimbursement,
} from "../types/outsidePurchase";
import { getActiveOperatorSnapshot } from "@/lib/operatorAttribution";

interface ReimbursementInput {
  id: string;
  purchaseId: string;
  amount: number;
  paymentMethod: OutsidePurchaseReimbursement["paymentMethod"];
  operator: string;
  businessDayId: string;
  note?: string;
}

interface VoidInput {
  purchaseId: string;
  reason: string;
  operator: string;
  businessDayId: string;
}

interface ActionResult {
  ok: boolean;
  error?: string;
}

interface OutsidePurchaseStore {
  purchases: OutsidePurchase[];
  createOutsidePurchase: (
    input: OutsidePurchaseInput
  ) => ActionResult;
  recordReimbursement: (
    input: ReimbursementInput
  ) => ActionResult;
  voidOutsidePurchase: (
    input: VoidInput
  ) => ActionResult;
  resetOutsidePurchaseStore: () => void;
}

function money(value: number) {
  return Math.round(value * 100) / 100;
}

function isValidPurchase(value: unknown): value is OutsidePurchase {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<OutsidePurchase>;
  return (
    typeof item.id === "string" &&
    typeof item.tableId === "number" &&
    typeof item.sessionId === "string" &&
    typeof item.customerName === "string" &&
    typeof item.amountPaidFromDrawer === "number" &&
    Array.isArray(item.reimbursements)
  );
}

export const useOutsidePurchaseStore =
  create<OutsidePurchaseStore>()(
    persist(
      (set, get) => ({
        purchases: [],

        createOutsidePurchase: (input) => {
          if (get().purchases.some((item) => item.id === input.id)) {
            return { ok: false, error: "This customer outside purchase was already recorded." };
          }

          const amount = money(input.amountPaidFromDrawer);
          if (!input.description.trim() || amount <= 0) {
            return { ok: false, error: "Enter a description and a valid amount." };
          }

          const purchase: OutsidePurchase = {
            ...input,
            customerName: input.customerName.trim(),
            description: input.description.trim(),
            note: input.note?.trim() || undefined,
            amountPaidFromDrawer: amount,
            totalReimbursed: 0,
            outstandingAmount: amount,
            status: "pending",
            createdByOperator:
              getActiveOperatorSnapshot(),
            createdAt: new Date().toISOString(),
            reimbursements: [],
          };

          set((state) => ({ purchases: [purchase, ...state.purchases] }));
          return { ok: true };
        },

        recordReimbursement: (input) => {
          const purchase = get().purchases.find((item) => item.id === input.purchaseId);
          if (!purchase) return { ok: false, error: "Customer outside purchase not found." };
          if (purchase.status === "cancelled" || purchase.status === "reimbursed") {
            return { ok: false, error: "This record cannot receive another reimbursement." };
          }
          if (purchase.reimbursements.some((item) => item.id === input.id)) {
            return { ok: false, error: "This reimbursement was already recorded." };
          }

          const amount = money(input.amount);
          if (amount <= 0 || amount > purchase.outstandingAmount) {
            return { ok: false, error: "Amount must be greater than zero and cannot exceed the outstanding balance." };
          }

          const reimbursement: OutsidePurchaseReimbursement = {
            id: input.id,
            amount,
            paymentMethod: input.paymentMethod,
            operator: input.operator,
            operatorSnapshot:
              getActiveOperatorSnapshot(),
            businessDayId: input.businessDayId,
            createdAt: new Date().toISOString(),
            note: input.note?.trim() || undefined,
          };

          set((state) => ({
            purchases: state.purchases.map((item) => {
              if (item.id !== input.purchaseId) return item;
              const totalReimbursed = money(item.totalReimbursed + amount);
              const outstandingAmount = money(
                Math.max(0, item.amountPaidFromDrawer - totalReimbursed)
              );
              return {
                ...item,
                reimbursements: [...item.reimbursements, reimbursement],
                totalReimbursed,
                outstandingAmount,
                status: outstandingAmount === 0 ? "reimbursed" : "partial",
              };
            }),
          }));
          return { ok: true };
        },

        voidOutsidePurchase: (input) => {
          const purchase = get().purchases.find((item) => item.id === input.purchaseId);
          if (!purchase) return { ok: false, error: "Customer outside purchase not found." };
          if (purchase.status !== "pending" || purchase.totalReimbursed > 0) {
            return { ok: false, error: "Only an unreimbursed pending record can be voided." };
          }
          if (!input.reason.trim()) return { ok: false, error: "A cancellation reason is required." };

          set((state) => ({
            purchases: state.purchases.map((item) =>
              item.id === input.purchaseId
                ? {
                    ...item,
                    status: "cancelled",
                    outstandingAmount: 0,
                    cancelledAt: new Date().toISOString(),
                    cancelledBy: input.operator,
                    cancelledByOperator:
                      getActiveOperatorSnapshot(),
                    cancelledBusinessDayId: input.businessDayId,
                    cancellationReason: input.reason.trim(),
                  }
                : item
            ),
          }));
          return { ok: true };
        },

        resetOutsidePurchaseStore: () => set({ purchases: [] }),
      }),
      {
        name: "snooker-arena-outside-purchases",
        merge: (persisted, current) => {
          const saved = persisted as Partial<OutsidePurchaseStore> | undefined;
          return {
            ...current,
            purchases: Array.isArray(saved?.purchases)
              ? saved.purchases.filter(isValidPurchase)
              : [],
          };
        },
      }
    )
  );

export function getOutsidePurchaseSummary(purchases: OutsidePurchase[]) {
  return purchases.reduce(
    (summary, purchase) => {
      if (purchase.status === "cancelled") return summary;
      const paymentMethod = purchase.paymentMethod ?? "cash";
      summary.paidOut += purchase.amountPaidFromDrawer;
      summary.fundingByMethod[paymentMethod] += purchase.amountPaidFromDrawer;
      if (paymentMethod === "cash") {
        summary.paidFromDrawer += purchase.amountPaidFromDrawer;
      }
      summary.reimbursed += purchase.totalReimbursed;
      summary.outstanding += purchase.outstandingAmount;
      purchase.reimbursements.forEach((item) => {
        summary.byMethod[item.paymentMethod] += item.amount;
      });
      return summary;
    },
    {
      paidOut: 0,
      paidFromDrawer: 0,
      reimbursed: 0,
      outstanding: 0,
      fundingByMethod: { cash: 0, card: 0, jazzcash: 0, easypaisa: 0 },
      byMethod: { cash: 0, card: 0, jazzcash: 0, easypaisa: 0 },
    }
  );
}
