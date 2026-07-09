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
}

export interface ExpenseInput {
  category: ExpenseCategory;
  amount: number;
  note: string;
  expenseDate: string;
}
