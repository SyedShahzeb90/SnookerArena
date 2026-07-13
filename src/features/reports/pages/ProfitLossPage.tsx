import {
  ArrowLeft,
  CalendarDays,
  CreditCard,
  ReceiptText,
  WalletCards,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useExpensesStore } from "@/features/expenses/store/expensesStore";
import { expenseCategories } from "@/features/expenses/types/expense";
import { useSalesStore } from "@/features/sales/store/salesStore";

import ProfitLossSummaryCards from "../components/ProfitLossSummaryCards";
import {
  calculateProfitLoss,
  getProfitLossDateRange,
  type ProfitLossRange,
} from "../utils/calculateProfitLoss";

const rangeLabels: Record<ProfitLossRange, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "this-week": "This Week",
  "this-month": "This Month",
  custom: "Custom Range",
};

const paymentLabels = {
  cash: "Cash",
  card: "Card",
  jazzcash: "JazzCash",
  easypaisa: "EasyPaisa",
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString([], {
    dateStyle: "medium",
  });
}

function formatProfit(value: number) {
  return value < 0
    ? `Loss Rs. ${Math.abs(value)}`
    : `Profit Rs. ${value}`;
}

function ProfitLossPage() {
  const navigate = useNavigate();
  const sales = useSalesStore((state) => state.sales);
  const expenses = useExpensesStore((state) => state.expenses);

  const [range, setRange] =
    useState<ProfitLossRange>("today");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const dateRange = useMemo(
    () =>
      getProfitLossDateRange(
        range,
        customStart,
        customEnd
      ),
    [range, customStart, customEnd]
  );

  const report = useMemo(
    () =>
      calculateProfitLoss(
        sales,
        expenses,
        dateRange
      ),
    [sales, expenses, dateRange]
  );

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Button
              variant="ghost"
              className="mb-3 gap-2"
              onClick={() => navigate("/admin")}
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Button>

            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-slate-700 shadow-sm ring-1 ring-slate-200">
                <ReceiptText className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-950">
                  Profit / Loss
                </h1>
                <p className="text-sm text-slate-500">
                  Compare sales, expenses, profit, and loss.
                </p>
              </div>
            </div>
          </div>
        </div>

        <Card className="mb-5 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {Object.entries(rangeLabels).map(
                ([value, label]) => (
                  <Button
                    key={value}
                    variant={
                      range === value
                        ? "default"
                        : "outline"
                    }
                    onClick={() =>
                      setRange(
                        value as ProfitLossRange
                      )
                    }
                  >
                    {label}
                  </Button>
                )
              )}
            </div>

            {range === "custom" && (
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  type="date"
                  value={customStart}
                  onChange={(event) =>
                    setCustomStart(
                      event.target.value
                    )
                  }
                />
                <Input
                  type="date"
                  value={customEnd}
                  onChange={(event) =>
                    setCustomEnd(
                      event.target.value
                    )
                  }
                />
              </div>
            )}
          </div>
        </Card>

        <ProfitLossSummaryCards totals={report.totals} />

        <section className="mt-5 grid gap-4 lg:grid-cols-3">
          <Card className="p-4 lg:col-span-1">
            <div className="mb-4 flex items-center gap-2">
              <ReceiptText className="h-5 w-5 text-emerald-700" />
              <h2 className="font-bold text-slate-950">
                Revenue Breakdown
              </h2>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span>Table revenue</span>
                <span className="font-bold">
                  Rs. {report.totals.tableRevenue}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Cafe revenue</span>
                <span className="font-bold">
                  Rs. {report.totals.cafeRevenue}
                </span>
              </div>
              <hr />
              {Object.entries(paymentLabels).map(
                ([method, label]) => (
                  <div
                    key={method}
                    className="flex justify-between"
                  >
                    <span>{label}</span>
                    <span className="font-bold">
                      Rs.{" "}
                      {
                        report.paymentTotals[
                          method as keyof typeof report.paymentTotals
                        ]
                      }
                    </span>
                  </div>
                )
              )}
            </div>
          </Card>

          <Card className="p-4 lg:col-span-1">
            <div className="mb-4 flex items-center gap-2">
              <WalletCards className="h-5 w-5 text-red-700" />
              <h2 className="font-bold text-slate-950">
                Expense Breakdown
              </h2>
            </div>

            <div className="space-y-3 text-sm">
              {expenseCategories.map((category) => (
                <div
                  key={category}
                  className="flex justify-between"
                >
                  <span>{category}</span>
                  <span className="font-bold">
                    Rs.{" "}
                    {
                      report.expenseTotals[
                        category
                      ]
                    }
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4 lg:col-span-1">
            <div className="mb-4 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-slate-700" />
              <h2 className="font-bold text-slate-950">
                Report Totals
              </h2>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span>Completed sales</span>
                <span className="font-bold">
                  {report.totals.salesCount}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Expense count</span>
                <span className="font-bold">
                  {report.totals.expenseCount}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Average sale</span>
                <span className="font-bold">
                  Rs. {report.totals.averageSale}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Average expense</span>
                <span className="font-bold">
                  Rs. {report.totals.averageExpense}
                </span>
              </div>
            </div>
          </Card>
        </section>

        <Card className="mt-5 overflow-hidden">
          <div className="flex items-center gap-2 border-b p-4">
            <CalendarDays className="h-5 w-5 text-slate-500" />
            <h2 className="font-bold text-slate-950">
              Daily Profit / Loss
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Revenue</th>
                  <th className="px-4 py-3">Expenses</th>
                  <th className="px-4 py-3">Net Profit</th>
                  <th className="px-4 py-3">Sales Count</th>
                  <th className="px-4 py-3">Expense Count</th>
                </tr>
              </thead>
              <tbody>
                {report.dailyRows.map((row) => (
                  <tr
                    key={row.date}
                    className="border-t bg-white"
                  >
                    <td className="px-4 py-3 font-semibold">
                      {formatDate(row.date)}
                    </td>
                    <td className="px-4 py-3">
                      Rs. {row.revenue}
                    </td>
                    <td className="px-4 py-3">
                      Rs. {row.expenses}
                    </td>
                    <td
                      className={`px-4 py-3 font-bold ${
                        row.netProfit < 0
                          ? "text-red-700"
                          : "text-emerald-700"
                      }`}
                    >
                      {formatProfit(row.netProfit)}
                    </td>
                    <td className="px-4 py-3">
                      {row.salesCount}
                    </td>
                    <td className="px-4 py-3">
                      {row.expenseCount}
                    </td>
                  </tr>
                ))}

                {report.dailyRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-center text-slate-500"
                    >
                      No sales or expenses found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </main>
  );
}

export default ProfitLossPage;
