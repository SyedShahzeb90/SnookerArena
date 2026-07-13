import type { PaymentMethod } from "@/types/session";

import type {
  Expense,
  ExpenseCategory,
} from "../types/expense";

export function formatCurrency(amount: number) {
  return `Rs. ${amount.toLocaleString()}`;
}

export function getExpenseStatus(expense: Expense) {
  return expense.status === "cancelled"
    ? "cancelled"
    : "active";
}

export function isActiveExpense(expense: Expense) {
  return getExpenseStatus(expense) === "active";
}

export function getExpenseDate(expense: Expense) {
  const date = new Date(expense.expenseDate);

  return Number.isNaN(date.getTime())
    ? undefined
    : date;
}

export function formatExpenseDate(expense: Expense) {
  const date = getExpenseDate(expense);

  if (!date) return "—";

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatExpenseTime(expense: Expense) {
  const date = getExpenseDate(expense);

  if (!date) return "";

  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function getPaymentMethodLabel(
  method?: PaymentMethod
) {
  const labels: Record<PaymentMethod, string> = {
    cash: "Cash",
    card: "Card",
    jazzcash: "JazzCash",
    easypaisa: "EasyPaisa",
  };

  return labels[method ?? "cash"];
}

export function normalizeExpenseCategory(
  category?: ExpenseCategory
) {
  return category ?? "Uncategorized";
}

export function calculateFilteredExpenseTotal(
  expenses: Expense[],
  includeCancelled = false
) {
  return expenses.reduce((total, expense) => {
    if (
      !includeCancelled &&
      !isActiveExpense(expense)
    ) {
      return total;
    }

    return total + expense.amount;
  }, 0);
}
