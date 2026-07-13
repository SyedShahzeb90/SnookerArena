import { create } from "zustand";
import { persist } from "zustand/middleware";

import type {
  Expense,
  ExpenseCategory,
  ExpenseInput,
} from "../types/expense";
import {
  isActiveExpense,
} from "../utils/expenseHelpers";
import {
  getExpensesByCategory as filterByCategory,
  getExpensesByDateRange as filterByDateRange,
  getExpensesTotal,
  getMonthRange,
  getTodayRange,
} from "../utils/expenseReports";

interface ExpensesStore {
  expenses: Expense[];
  addExpense: (
    input: ExpenseInput
  ) => Expense;
  updateExpense: (
    id: string,
    input: ExpenseInput
  ) => void;
  deleteExpense: (id: string) => void;
  cancelExpense: (
    id: string,
    reason?: string
  ) => void;
  getExpenses: () => Expense[];
  getTodayExpensesTotal: () => number;
  getMonthExpensesTotal: () => number;
  getExpensesByDateRange: (
    start: Date,
    end: Date
  ) => Expense[];
  getExpensesByCategory: (
    category: ExpenseCategory
  ) => Expense[];
  resetExpensesStore: () => void;
}

export const useExpensesStore =
  create<ExpensesStore>()(
    persist(
      (set, get) => ({
        expenses: [],

        addExpense: (input) => {
          const expense: Expense = {
            id: `EXP-${Date.now()}`,
            ...input,
            status: "active",
            createdAt:
              new Date().toISOString(),
          };

          set((state) => ({
            expenses: [
              expense,
              ...state.expenses,
            ],
          }));

          return expense;
        },

        updateExpense: (id, input) =>
          set((state) => ({
            expenses: state.expenses.map(
              (expense) =>
                expense.id === id
                  ? {
                      ...expense,
                      ...input,
                    }
                  : expense
            ),
          })),

        deleteExpense: (id) =>
          set((state) => ({
            expenses:
              state.expenses.filter(
                (expense) =>
                  expense.id !== id
              ),
          })),

        cancelExpense: (id, reason) =>
          set((state) => ({
            expenses: state.expenses.map(
              (expense) =>
                expense.id === id &&
                isActiveExpense(expense)
                  ? {
                      ...expense,
                      status: "cancelled",
                      cancelledAt:
                        new Date().toISOString(),
                      cancellationReason:
                        reason?.trim() ||
                        undefined,
                    }
                  : expense
            ),
          })),

        getExpenses: () => get().expenses,

        getTodayExpensesTotal: () => {
          const { start, end } =
            getTodayRange();

          return getExpensesTotal(
            filterByDateRange(
              get().expenses,
              start,
              end
            ).filter(isActiveExpense)
          );
        },

        getMonthExpensesTotal: () => {
          const { start, end } =
            getMonthRange();

          return getExpensesTotal(
            filterByDateRange(
              get().expenses,
              start,
              end
            ).filter(isActiveExpense)
          );
        },

        getExpensesByDateRange: (
          start,
          end
        ) =>
          filterByDateRange(
            get().expenses,
            start,
            end
          ).filter(isActiveExpense),

        getExpensesByCategory: (
          category
        ) =>
          filterByCategory(
            get().expenses,
            category
          ).filter(isActiveExpense),

        resetExpensesStore: () =>
          set({
            expenses: [],
          }),
      }),
      {
        name: "snooker-arena-expenses",
      }
    )
  );
