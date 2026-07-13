import type { PaymentMethod } from "@/types/session";

export const expenseCategories = [
  "Staff Salary",
  "Electricity",
  "Rent",
  "Maintenance",
  "Cafe Purchase",
  "Cleaning",
  "Internet",
  "Other",
] as const;

export type ExpenseCategory =
  (typeof expenseCategories)[number];

export interface Expense {
  id: string;
  category: ExpenseCategory;
  amount: number;
  note: string;
  expenseDate: string;
  createdAt: string;
  activeBusinessDayId?: string;
  paymentMethod?: PaymentMethod;
  status?: "active" | "cancelled";
  cancelledAt?: string;
  cancellationReason?: string;
  createdByRole?: string;
  createdByName?: string;
}

export interface ExpenseInput {
  category: ExpenseCategory;
  amount: number;
  note: string;
  expenseDate: string;
  paymentMethod: PaymentMethod;
  activeBusinessDayId?: string;
  createdByRole?: string;
  createdByName?: string;
}
