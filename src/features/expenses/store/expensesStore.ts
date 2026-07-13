import { create } from "zustand";
import { persist } from "zustand/middleware";

import type {
  Expense,
  ExpenseCategory,
  ExpenseInput,
} from "../types/expense";
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

        getExpenses: () => get().expenses,

        getTodayExpensesTotal: () => {
          const { start, end } =
            getTodayRange();

          return getExpensesTotal(
            filterByDateRange(
              get().expenses,
              start,
              end
            )
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
            )
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
          ),

        getExpensesByCategory: (
          category
        ) =>
          filterByCategory(
            get().expenses,
            category
          ),

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
