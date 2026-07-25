import type { PaymentMethod } from "@/types/session";

export type OutsidePurchaseStatus =
  | "pending"
  | "partial"
  | "reimbursed"
  | "cancelled";

export interface OutsidePurchaseReimbursement {
  id: string;
  amount: number;
  paymentMethod: PaymentMethod;
  operator: string;
  businessDayId: string;
  createdAt: string;
  note?: string;
}

export interface OutsidePurchase {
  id: string;
  tableId: number;
  tableName: string;
  sessionId: string;
  customerId?: string;
  customerAccountId?: string;
  customerToken?: string;
  customerName: string;
  description: string;
  note?: string;
  paymentMethod?: PaymentMethod;
  amountPaidFromDrawer: number;
  totalReimbursed: number;
  outstandingAmount: number;
  status: OutsidePurchaseStatus;
  operator: string;
  businessDayId: string;
  createdAt: string;
  reimbursements: OutsidePurchaseReimbursement[];
  cancelledAt?: string;
  cancelledBy?: string;
  cancelledBusinessDayId?: string;
  cancellationReason?: string;
}

export interface OutsidePurchaseInput {
  id: string;
  tableId: number;
  tableName: string;
  sessionId: string;
  customerId?: string;
  customerAccountId?: string;
  customerToken?: string;
  customerName: string;
  description: string;
  note?: string;
  paymentMethod: PaymentMethod;
  amountPaidFromDrawer: number;
  operator: string;
  businessDayId: string;
}
