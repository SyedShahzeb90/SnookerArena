import {
  Banknote,
  Coffee,
  ReceiptText,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { Card } from "@/components/ui/card";

import { useSalesStore } from "../store/salesStore";
import { useExpensesStore } from "@/features/expenses/store/expensesStore";
import {
  calculateSalesTotals,
  filterSalesByRange,
} from "../utils/salesReports";

function BusinessSummaryCards() {
  const sales = useSalesStore(
    (state) => state.sales
  );
  const todayExpenses =
    useExpensesStore(
      (state) =>
        state.getTodayExpensesTotal()
    );

  const totals = calculateSalesTotals(
    filterSalesByRange(sales, "today")
  );
  const todayProfit =
    totals.revenue - todayExpenses;

  const cards = [
    {
      label: "Today's Revenue",
      value: `Rs. ${totals.revenue}`,
      icon: TrendingUp,
      tone: "text-emerald-700",
      bg: "bg-emerald-50",
    },
    {
      label: "Today's Table Sales",
      value: `Rs. ${totals.tableRevenue}`,
      icon: Banknote,
      tone: "text-slate-700",
      bg: "bg-slate-100",
    },
    {
      label: "Today's Cafe Sales",
      value: `Rs. ${totals.cafeRevenue}`,
      icon: Coffee,
      tone: "text-amber-700",
      bg: "bg-amber-50",
    },
    {
      label: "Completed Transactions",
      value: String(totals.salesCount),
      icon: ReceiptText,
      tone: "text-blue-700",
      bg: "bg-blue-50",
    },
    {
      label: "Today's Expenses",
      value: `Rs. ${todayExpenses}`,
      icon: TrendingDown,
      tone: "text-red-700",
      bg: "bg-red-50",
    },
    {
      label:
        todayProfit < 0
          ? "Today's Loss"
          : "Today's Profit",
      value: `Rs. ${Math.abs(todayProfit)}`,
      icon:
        todayProfit < 0
          ? TrendingDown
          : ReceiptText,
      tone:
        todayProfit < 0
          ? "text-red-700"
          : "text-emerald-700",
      bg:
        todayProfit < 0
          ? "bg-red-50"
          : "bg-emerald-50",
    },
  ];

  return (
    <section className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <Card
            key={card.label}
            className="rounded-lg border-slate-200 bg-white p-4 shadow-sm"
          >
            <div
              className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${card.bg} ${card.tone}`}
            >
              <Icon className="h-4 w-4" />
            </div>

            <p className="text-xs font-medium text-slate-500">
              {card.label}
            </p>
            <p className="mt-1 text-xl font-bold text-slate-950">
              {card.value}
            </p>
          </Card>
        );
      })}
    </section>
  );
}

export default BusinessSummaryCards;
