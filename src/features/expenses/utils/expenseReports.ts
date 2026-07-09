import type {
  Expense,
  ExpenseCategory,
} from "../types/expense";

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

export function getTodayRange() {
  const now = new Date();

  return {
    start: startOfDay(now),
    end: endOfDay(now),
  };
}

export function getMonthRange() {
  const now = new Date();

  return {
    start: new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    ),
    end: endOfDay(now),
  };
}

export function getExpensesByDateRange(
  expenses: Expense[],
  start: Date,
  end: Date
) {
  const startTime = start.getTime();
  const endTime = end.getTime();

  return expenses.filter((expense) => {
    const expenseTime = new Date(
      expense.expenseDate
    ).getTime();

    return (
      expenseTime >= startTime &&
      expenseTime <= endTime
    );
  });
}

export function getExpensesTotal(
  expenses: Expense[]
) {
  return expenses.reduce(
    (total, expense) =>
      total + expense.amount,
    0
  );
}

export function getExpensesByCategory(
  expenses: Expense[],
  category: ExpenseCategory
) {
  return expenses.filter(
    (expense) =>
      expense.category === category
  );
}

export function getHighestExpenseCategory(
  expenses: Expense[]
) {
  const totals = expenses.reduce<
    Partial<Record<ExpenseCategory, number>>
  >((summary, expense) => {
    summary[expense.category] =
      (summary[expense.category] ?? 0) +
      expense.amount;

    return summary;
  }, {});

  const highest = Object.entries(totals).sort(
    ([, first], [, second]) =>
      second - first
  )[0];

  if (!highest) {
    return {
      category: "None",
      amount: 0,
    };
  }

  return {
    category: highest[0],
    amount: highest[1],
  };
}
