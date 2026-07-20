import type { PaymentMethod } from "@/types/session";

export type BusinessDayStatus =
  | "active"
  | "closed";

export interface BusinessDaySummary {
  totalSales: number;
  tableSales: number;
  cafeSales: number;
  cashSales: number;
  cardSales: number;
  jazzCashSales: number;
  easypaisaSales: number;
  completedPaymentsCount: number;
  totalExpenses: number;
  cashExpenses: number;
  expenseCount: number;
  outsidePurchasesPaidFromDrawer?: number;
  outsidePurchaseCashRestored?: number;
  cashCustomerReimbursements?: number;
  cardCustomerReimbursements?: number;
  jazzCashCustomerReimbursements?: number;
  easypaisaCustomerReimbursements?: number;
  digitalCustomerReimbursements?: number;
  outstandingCustomerReimbursements?: number;
  pendingBillsCount: number;
  pendingBillsAmount: number;
  expectedCash: number;
  netProfit: number;
}

export interface BusinessDay
  extends BusinessDaySummary {
  id: string;
  dayName: string;
  startedAt: string;
  endedAt?: string;
  status: BusinessDayStatus;
  openedBy: string;
  closedBy?: string;
  openingCash: number;
  actualCashCounted?: number;
  cashLeftForStaff?: number;
  cashTakenHome?: number;
  cashDifference?: number;
  openingNotes?: string;
  closingNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StartBusinessDayInput {
  openedBy: string;
  openingCash: number;
  openingNotes?: string;
}

export interface CloseBusinessDayInput {
  actualCashCounted: number;
  cashLeftForStaff: number;
  closedBy: string;
  closingNotes?: string;
  summary?: BusinessDaySummary;
}

export const paymentMethodLabels: Record<
  PaymentMethod,
  string
> = {
  cash: "Cash",
  card: "Card",
  jazzcash: "JazzCash",
  easypaisa: "Easypaisa",
};
