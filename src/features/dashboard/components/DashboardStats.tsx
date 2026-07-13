import {
  CircleCheck,
  CircleDollarSign,
  CircleDot,
  LayoutGrid,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { useTableStore } from "@/store/tableStore";
import { useSalesStore } from "@/features/sales/store/salesStore";

function DashboardStats() {
  const tables = useTableStore(
    (state) => state.tables
  );
  const sales = useSalesStore(
    (state) => state.sales
  );

  const total = tables.length;

  const available = tables.filter(
    (table) => table.status === "available"
  ).length;

  const running = tables.filter(
    (table) =>
      table.status === "running" ||
      table.status === "paused"
  ).length;

  const pending = tables.filter(
    (table) =>
    table.status === "payment-pending"
  ).length;

  const todaySales = sales.filter(
    (sale) =>
      new Date(
        sale.createdAt
      ).toDateString() ===
      new Date().toDateString()
  );

  const todayReceived = todaySales
    .reduce(
      (total, sale) =>
        total + sale.grandTotal,
      0
    );

  const todayPaymentTotals =
    todaySales.reduce(
      (totals, sale) => {
        if (sale.paymentSplits?.length) {
          return sale.paymentSplits.reduce(
            (summary, split) => ({
              ...summary,
              [split.method]:
                summary[split.method] +
                split.amount,
            }),
            totals
          );
        }

        return {
          ...totals,
          [sale.paymentMethod]:
            totals[sale.paymentMethod] +
            sale.grandTotal,
        };
      },
      {
        cash: 0,
        card: 0,
        jazzcash: 0,
        easypaisa: 0,
      }
    );

  const stats = [
    {
      label: "Total Tables",
      value: total,
      icon: LayoutGrid,
      tone: "text-slate-700",
      bg: "bg-slate-100",
    },
    {
      label: "Running",
      value: running,
      icon: CircleDot,
      tone: "text-red-600",
      bg: "bg-red-50",
    },
    {
      label: "Available",
      value: available,
      icon: CircleCheck,
      tone: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Pending",
      value: pending,
      icon: CircleDollarSign,
      tone: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: "Today Received",
      value: `Rs. ${todayReceived}`,
      icon: CircleDollarSign,
      tone: "text-emerald-700",
      bg: "bg-emerald-50",
      details: [
        {
          label: "Cash",
          value: todayPaymentTotals.cash,
        },
        {
          label: "Easypaisa",
          value:
            todayPaymentTotals.easypaisa,
        },
      ],
    },
    {
      label: "Digital / Bank",
      value: `Rs. ${
        todayPaymentTotals.jazzcash +
        todayPaymentTotals.card
      }`,
      icon: CircleDollarSign,
      tone: "text-blue-700",
      bg: "bg-blue-50",
      details: [
        {
          label: "JazzCash",
          value:
            todayPaymentTotals.jazzcash,
        },
        {
          label: "Bank",
          value: todayPaymentTotals.card,
        },
      ],
    },
  ];

  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
      {stats.map((stat) => {
        const Icon = stat.icon;
        const details =
          "details" in stat
            ? stat.details
            : undefined;

        return (
          <Card
            key={stat.label}
            className="flex items-center justify-between rounded-lg border-slate-200 bg-white p-5 shadow-sm"
          >
            <div>
              <p className="text-sm font-medium text-slate-500">
                {stat.label}
              </p>

              <p
                className={`mt-2 text-3xl font-bold ${stat.tone}`}
              >
                {stat.value}
              </p>

              {details && (
                <div className="mt-3 space-y-1.5 text-xs text-slate-500">
                  {details.map(
                    (detail) => (
                      <div
                        key={detail.label}
                        className="flex items-center justify-between gap-3"
                      >
                        <span className="truncate">
                          {detail.label}
                        </span>
                        <span className="font-semibold text-slate-950">
                          Rs. {detail.value}
                        </span>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

            <div
              className={`flex h-11 w-11 items-center justify-center rounded-lg ${stat.bg} ${stat.tone}`}
            >
              <Icon className="h-5 w-5" />
            </div>
          </Card>
        );
      })}
    </section>
  );
}

export default DashboardStats;
