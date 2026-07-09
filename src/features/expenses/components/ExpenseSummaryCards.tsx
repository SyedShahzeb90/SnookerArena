import {
  CalendarDays,
  ListChecks,
  TrendingDown,
  Wallet,
} from "lucide-react";

import { Card } from "@/components/ui/card";

import type { Expense } from "../types/expense";
import {
  getExpensesTotal,
  getHighestExpenseCategory,
  getMonthRange,
  getTodayRange,
  getExpensesByDateRange,
} from "../utils/expenseReports";

interface Props {
  expenses: Expense[];
}

function ExpenseSummaryCards({
  expenses,
}: Props) {
  const todayRange = getTodayRange();
  const monthRange = getMonthRange();

  const todayTotal = getExpensesTotal(
    getExpensesByDateRange(
      expenses,
      todayRange.start,
      todayRange.end
    )
  );

  const monthTotal = getExpensesTotal(
    getExpensesByDateRange(
      expenses,
      monthRange.start,
      monthRange.end
    )
  );

  const highest =
    getHighestExpenseCategory(expenses);

  const cards = [
    {
      label: "Today's Expenses",
      value: `Rs. ${todayTotal}`,
      icon: Wallet,
      tone: "text-red-700",
      bg: "bg-red-50",
    },
    {
      label: "This Month's Expenses",
      value: `Rs. ${monthTotal}`,
      icon: CalendarDays,
      tone: "text-amber-700",
      bg: "bg-amber-50",
    },
    {
      label: "Total Expenses Count",
      value: String(expenses.length),
      icon: ListChecks,
      tone: "text-slate-700",
      bg: "bg-slate-100",
    },
    {
      label: "Highest Expense Category",
      value:
        highest.category === "None"
          ? "None"
          : `${highest.category} · Rs. ${highest.amount}`,
      icon: TrendingDown,
      tone: "text-indigo-700",
      bg: "bg-indigo-50",
    },
  ];

  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <Card
            key={card.label}
            className="rounded-lg border-slate-200 bg-white p-5 shadow-sm"
          >
            <div
              className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${card.bg} ${card.tone}`}
            >
              <Icon className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-slate-500">
              {card.label}
            </p>
            <p className="mt-2 text-xl font-bold text-slate-950">
              {card.value}
            </p>
          </Card>
        );
      })}
    </section>
  );
}

export default ExpenseSummaryCards;
