import type { Expense } from "@/features/expenses/types/expense";
import { expenseCategories } from "@/features/expenses/types/expense";
import { isActiveExpense } from "@/features/expenses/utils/expenseHelpers";
import type { Sale } from "@/features/sales/types/sale";
import type { PaymentMethod } from "@/types/session";

export type ProfitLossRange =
  | "today"
  | "yesterday"
  | "this-week"
  | "this-month"
  | "custom";

export interface ProfitLossDateRange {
  start: Date;
  end: Date;
}

export interface ProfitLossTotals {
  totalRevenue: number;
  tableRevenue: number;
  cafeRevenue: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
  salesCount: number;
  expenseCount: number;
  transactions: number;
  highestSale: number;
  lowestSale: number;
  averageSale: number;
  averageExpense: number;
}

export interface ProfitLossReport {
  totals: ProfitLossTotals;
  paymentTotals: Record<PaymentMethod, number>;
  expenseTotals: Record<string, number>;
  dailyRows: {
    date: string;
    revenue: number;
    expenses: number;
    netProfit: number;
    profitMargin: number;
    salesCount: number;
    expenseCount: number;
  }[];
}

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

function startOfWeek(date: Date) {
  const value = startOfDay(date);
  const day = value.getDay();
  const diff = day === 0 ? 6 : day - 1;
  value.setDate(value.getDate() - diff);
  return value;
}

export function getProfitLossDateRange(
  range: ProfitLossRange,
  customStart?: string,
  customEnd?: string
): ProfitLossDateRange {
  const now = new Date();

  if (range === "today") {
    return {
      start: startOfDay(now),
      end: endOfDay(now),
    };
  }

  if (range === "yesterday") {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    return {
      start: startOfDay(yesterday),
      end: endOfDay(yesterday),
    };
  }

  if (range === "this-week") {
    return {
      start: startOfWeek(now),
      end: endOfDay(now),
    };
  }

  if (range === "this-month") {
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: endOfDay(now),
    };
  }

  return {
    start: customStart ? startOfDay(new Date(customStart)) : startOfDay(now),
    end: customEnd ? endOfDay(new Date(customEnd)) : endOfDay(now),
  };
}

function isWithinRange(value: string, range: ProfitLossDateRange) {
  const time = new Date(value).getTime();
  return time >= range.start.getTime() && time <= range.end.getTime();
}

function dateKey(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

export function calculateProfitLoss(
  sales: Sale[],
  expenses: Expense[],
  range: ProfitLossDateRange
): ProfitLossReport {
  const filteredSales = sales.filter((sale) =>
    isWithinRange(sale.createdAt, range)
  );
  const filteredExpenses = expenses.filter((expense) =>
    isActiveExpense(expense) &&
    isWithinRange(expense.expenseDate, range)
  );

  const totals = filteredSales.reduce(
    (summary, sale) => ({
      totalRevenue: summary.totalRevenue + sale.grandTotal,
      tableRevenue: summary.tableRevenue + sale.tableAmount,
      cafeRevenue: summary.cafeRevenue + sale.cafeAmount,
      salesCount: summary.salesCount + 1,
    }),
    {
      totalRevenue: 0,
      tableRevenue: 0,
      cafeRevenue: 0,
      salesCount: 0,
    }
  );

  const totalExpenses = filteredExpenses.reduce(
    (total, expense) => total + expense.amount,
    0
  );
  const netProfit = totals.totalRevenue - totalExpenses;
  const saleAmounts = filteredSales.map((sale) => sale.grandTotal);
  const highestSale = saleAmounts.length > 0 ? Math.max(...saleAmounts) : 0;
  const lowestSale = saleAmounts.length > 0 ? Math.min(...saleAmounts) : 0;

  const paymentTotals = filteredSales.reduce<Record<PaymentMethod, number>>(
    (paymentSummary, sale) => {
      if (sale.paymentSplits?.length) {
        return sale.paymentSplits.reduce(
          (splitSummary, split) => ({
            ...splitSummary,
            [split.method]:
              (splitSummary[split.method] ?? 0) + split.amount,
          }),
          paymentSummary
        );
      }

      return {
        ...paymentSummary,
        [sale.paymentMethod]:
          (paymentSummary[sale.paymentMethod] ?? 0) + sale.grandTotal,
      };
    },
    {
      cash: 0,
      card: 0,
      jazzcash: 0,
      easypaisa: 0,
    }
  );

  const expenseTotals = expenseCategories.reduce<Record<string, number>>(
    (summary, category) => ({
      ...summary,
      [category]: filteredExpenses
        .filter((expense) => expense.category === category)
        .reduce((total, expense) => total + expense.amount, 0),
    }),
    {}
  );

  const dailyMap = new Map<
    string,
    {
      date: string;
      revenue: number;
      expenses: number;
      netProfit: number;
      profitMargin: number;
      salesCount: number;
      expenseCount: number;
    }
  >();

  filteredSales.forEach((sale) => {
    const key = dateKey(sale.createdAt);
    const current =
      dailyMap.get(key) ??
      {
        date: key,
        revenue: 0,
        expenses: 0,
        netProfit: 0,
        profitMargin: 0,
        salesCount: 0,
        expenseCount: 0,
      };

    current.revenue += sale.grandTotal;
    current.salesCount += 1;
    current.netProfit = current.revenue - current.expenses;
    current.profitMargin =
      current.revenue > 0
        ? Math.round((current.netProfit / current.revenue) * 1000) / 10
        : 0;
    dailyMap.set(key, current);
  });

  filteredExpenses.forEach((expense) => {
    const key = dateKey(expense.expenseDate);
    const current =
      dailyMap.get(key) ??
      {
        date: key,
        revenue: 0,
        expenses: 0,
        netProfit: 0,
        profitMargin: 0,
        salesCount: 0,
        expenseCount: 0,
      };

    current.expenses += expense.amount;
    current.expenseCount += 1;
    current.netProfit = current.revenue - current.expenses;
    current.profitMargin =
      current.revenue > 0
        ? Math.round((current.netProfit / current.revenue) * 1000) / 10
        : 0;
    dailyMap.set(key, current);
  });

  return {
    totals: {
      totalRevenue: totals.totalRevenue,
      tableRevenue: totals.tableRevenue,
      cafeRevenue: totals.cafeRevenue,
      totalExpenses,
      netProfit,
      profitMargin:
        totals.totalRevenue > 0
          ? Math.round((netProfit / totals.totalRevenue) * 1000) / 10
          : 0,
      salesCount: totals.salesCount,
      expenseCount: filteredExpenses.length,
      transactions: totals.salesCount + filteredExpenses.length,
      highestSale,
      lowestSale,
      averageSale:
        totals.salesCount > 0
          ? Math.round(totals.totalRevenue / totals.salesCount)
          : 0,
      averageExpense:
        filteredExpenses.length > 0
          ? Math.round(totalExpenses / filteredExpenses.length)
          : 0,
    },
    paymentTotals,
    expenseTotals,
    dailyRows: Array.from(dailyMap.values()).sort(
      (first, second) =>
        new Date(second.date).getTime() - new Date(first.date).getTime()
    ),
  };
}
