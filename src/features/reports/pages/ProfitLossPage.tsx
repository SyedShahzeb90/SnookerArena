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
import { PageShell } from "@/components/layout/page-layout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useExpensesStore } from "@/features/expenses/store/expensesStore";
import { expenseCategories } from "@/features/expenses/types/expense";
import { useSalesStore } from "@/features/sales/store/salesStore";
import { formatAppDate, useAppDateTimeFormats } from "@/lib/dateTime";

import ProfitLossSummaryCards from "../components/ProfitLossSummaryCards";
import type { CafeSalesBreakdown } from "../components/ProfitLossSummaryCards";
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
  return formatAppDate(value);
}

function formatProfit(value: number) {
  return value < 0
    ? `Loss Rs. ${Math.abs(value).toLocaleString()}`
    : `Profit Rs. ${value.toLocaleString()}`;
}

function formatCurrency(value: number) {
  return `Rs. ${Math.round(value).toLocaleString()}`;
}

function formatPercent(value: number) {
  return `${value.toLocaleString()}%`;
}

function getProfitStatusClass(value: number) {
  return value < 0
    ? "bg-red-50 text-red-700 ring-1 ring-red-200"
    : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
}

function isWithinDateRange(value: string, range: { start: Date; end: Date }) {
  const time = new Date(value).getTime();
  return time >= range.start.getTime() && time <= range.end.getTime();
}

function getCafeSalesBreakdown(
  sales: ReturnType<typeof useSalesStore.getState>["sales"],
  dateRange: { start: Date; end: Date },
  cafeRevenue: number
): CafeSalesBreakdown {
  const cafeSales = sales.filter(
    (sale) =>
      sale.paymentStatus === "paid" &&
      sale.cafeAmount > 0 &&
      isWithinDateRange(sale.createdAt, dateRange)
  );
  const rowsByItem = cafeSales.reduce<
    Record<string, { item: string; quantity: number; sales: number }>
  >((summary, sale) => {
    (sale.orderedItems ?? [])
      .filter((item) => !item.name.startsWith("[Accessory]"))
      .forEach((item) => {
        const key = item.menuItemId || item.name.trim().toLowerCase();
        const current = summary[key] ?? {
          item: item.name,
          quantity: 0,
          sales: 0,
        };

        summary[key] = {
          item: current.item,
          quantity: current.quantity + item.quantity,
          sales: current.sales + item.subtotal,
        };
      });

    return summary;
  }, {});
  const itemRows = Object.values(rowsByItem);
  const allocatedRevenue = itemRows.reduce(
    (total, row) => total + row.sales,
    0
  );
  const unallocatedRevenue = Math.max(0, cafeRevenue - allocatedRevenue);
  const rows =
    unallocatedRevenue > 0
      ? [
          ...itemRows,
          {
            item: "Unallocated Cafe Sales",
            quantity: 0,
            sales: unallocatedRevenue,
          },
        ]
      : itemRows;

  return {
    rows: rows.sort(
      (a, b) =>
        b.quantity - a.quantity ||
        b.sales - a.sales ||
        a.item.localeCompare(b.item)
    ),
    totalRevenue: cafeRevenue,
    totalItemsSold: itemRows.reduce(
      (total, row) => total + row.quantity,
      0
    ),
  };
}

function ProfitLossPage() {
  useAppDateTimeFormats();
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
  const cafeBreakdown = useMemo(
    () =>
      getCafeSalesBreakdown(
        sales,
        dateRange,
        report.totals.cafeRevenue
      ),
    [sales, dateRange, report.totals.cafeRevenue]
  );
  const visibleExpenseTotals = useMemo(
    () =>
      expenseCategories
        .map((category) => ({
          category,
          total: report.expenseTotals[category] ?? 0,
        }))
        .filter((item) => item.total > 0),
    [report.expenseTotals]
  );

  return (
    <PageShell contentClassName="space-y-0">
      <div className="space-y-5">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Button
              variant="ghost"
              className="mb-3 gap-2"
              onClick={() => navigate("/admin")}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Admin Dashboard
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

        <ProfitLossSummaryCards
          totals={report.totals}
          cafeBreakdown={cafeBreakdown}
        />

        <section className="mt-5 grid gap-4 lg:grid-cols-3">
          <Card className="p-4 lg:col-span-1">
            <div className="mb-4 flex items-center gap-2">
              <ReceiptText className="h-5 w-5 text-emerald-700" />
              <h2 className="font-bold text-slate-950">
                Revenue Sources
              </h2>
            </div>

            <div className="space-y-4 text-sm">
              <div className="space-y-3 rounded-lg border p-3">
                <p className="text-xs font-semibold uppercase text-slate-500">
                  Revenue Sources
                </p>
                <div className="flex justify-between gap-3">
                  <span>Table revenue</span>
                  <span className="font-bold">
                    {formatCurrency(report.totals.tableRevenue)}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>Cafe revenue</span>
                  <span className="font-bold">
                    {formatCurrency(report.totals.cafeRevenue)}
                  </span>
                </div>
              </div>

              <div className="space-y-3 rounded-lg border p-3">
                <p className="text-xs font-semibold uppercase text-slate-500">
                  Payment Methods
                </p>
                {Object.entries(paymentLabels).map(
                  ([method, label]) => (
                    <div
                      key={method}
                      className="flex justify-between gap-3"
                    >
                      <span>{label}</span>
                      <span className="font-bold">
                        {formatCurrency(
                          report.paymentTotals[
                            method as keyof typeof report.paymentTotals
                          ]
                        )}
                      </span>
                    </div>
                  )
                )}
              </div>
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
              {visibleExpenseTotals.map((item) => (
                <div
                  key={item.category}
                  className="flex justify-between gap-3"
                >
                  <span>{item.category}</span>
                  <span className="font-bold">
                    {formatCurrency(item.total)}
                  </span>
                </div>
              ))}

              {visibleExpenseTotals.length === 0 && (
                <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-slate-500">
                  No expenses recorded.
                </p>
              )}
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
              <div className="flex justify-between gap-3">
                <span>Completed sales</span>
                <span className="font-bold">
                  {report.totals.salesCount.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span>Transactions</span>
                <span className="font-bold">
                  {report.totals.transactions.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span>Highest sale</span>
                <span className="font-bold">
                  {formatCurrency(report.totals.highestSale)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span>Lowest sale</span>
                <span className="font-bold">
                  {formatCurrency(report.totals.lowestSale)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span>Average sale</span>
                <span className="font-bold">
                  {formatCurrency(report.totals.averageSale)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span>Average expense</span>
                <span className="font-bold">
                  {formatCurrency(report.totals.averageExpense)}
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
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Revenue</th>
                  <th className="px-4 py-3 text-right">Expenses</th>
                  <th className="px-4 py-3 text-right">Profit</th>
                  <th className="px-4 py-3 text-right">Profit Margin</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {report.dailyRows.map((row) => (
                  <tr
                    key={row.date}
                    className="border-t bg-white transition-colors hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 font-semibold">
                      {formatDate(row.date)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatCurrency(row.revenue)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatCurrency(row.expenses)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-bold ${
                        row.netProfit < 0
                          ? "text-red-700"
                          : "text-emerald-700"
                      }`}
                    >
                      {formatProfit(row.netProfit)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {formatPercent(row.profitMargin)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${getProfitStatusClass(row.netProfit)}`}>
                        {row.netProfit < 0 ? "Loss" : "Profit"}
                      </span>
                    </td>
                  </tr>
                ))}

                {report.dailyRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-center text-slate-500"
                    >
                      No sales or expenses found for the selected period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </PageShell>
  );
}

export default ProfitLossPage;
