import type {
  PaymentMethod,
} from "@/types/session";

import type {
  ReportRange,
  Sale,
  SalesTotals,
} from "../types/sale";

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

export function getReportDates(
  range: ReportRange,
  customStart?: Date,
  customEnd?: Date
) {
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
      start: new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      ),
      end: endOfDay(now),
    };
  }

  return {
    start: customStart ?? startOfDay(now),
    end: customEnd ?? endOfDay(now),
  };
}

export function filterSalesByRange(
  sales: Sale[],
  range: ReportRange,
  customStart?: Date,
  customEnd?: Date
) {
  const { start, end } = getReportDates(
    range,
    customStart,
    customEnd
  );

  return sales.filter((sale) => {
    const createdAt = new Date(
      sale.createdAt
    ).getTime();

    return (
      createdAt >= start.getTime() &&
      createdAt <= end.getTime()
    );
  });
}

export function calculateSalesTotals(
  sales: Sale[]
): SalesTotals {
  const totals = sales.reduce(
    (summary, sale) => ({
      revenue:
        summary.revenue +
        sale.grandTotal,
      tableRevenue:
        summary.tableRevenue +
        sale.tableAmount,
      cafeRevenue:
        summary.cafeRevenue +
        sale.cafeAmount,
      discount:
        summary.discount +
        sale.discount,
      salesCount:
        summary.salesCount + 1,
    }),
    {
      revenue: 0,
      tableRevenue: 0,
      cafeRevenue: 0,
      discount: 0,
      salesCount: 0,
    }
  );

  return {
    ...totals,
    averageSale:
      totals.salesCount > 0
        ? Math.round(
            totals.revenue /
              totals.salesCount
          )
        : 0,
  };
}

export function calculatePaymentTotals(
  sales: Sale[]
) {
  return sales.reduce<
    Record<PaymentMethod, number>
  >(
    (totals, sale) => ({
      ...totals,
      [sale.paymentMethod]:
        totals[sale.paymentMethod] +
        sale.grandTotal,
    }),
    {
      cash: 0,
      card: 0,
      jazzcash: 0,
      easypaisa: 0,
    }
  );
}
