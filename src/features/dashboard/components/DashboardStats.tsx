import {
  CircleCheck,
  CircleDollarSign,
  CircleDot,
  LayoutGrid,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { useTableStore } from "@/store/tableStore";
import { useSalesStore } from "@/features/sales/store/salesStore";
import { calculatePaymentTotals } from "@/features/sales/utils/salesReports";

function money(value: number) {
  return `Rs. ${Math.round(value).toLocaleString()}`;
}

function isToday(value?: string) {
  if (!value) return false;

  return (
    new Date(value).toDateString() ===
    new Date().toDateString()
  );
}

function DashboardStats() {
  const tables = useTableStore(
    (state) => state.tables
  );
  const sales = useSalesStore(
    (state) => state.sales
  );
  const total = tables.length;
  const standardTableCount = tables.filter(
    (table) => table.type === "table"
  ).length;
  const privateRoomCount = tables.filter(
    (table) => table.type === "private-room"
  ).length;

  const available = tables.filter(
    (table) => table.status === "available"
  ).length;

  const running = tables.filter(
    (table) =>
      table.status === "running" ||
      table.status === "paused"
  ).length;

  const pendingTables = tables.filter(
    (table) =>
    table.status === "payment-pending"
  ).length;

  const todayCafeTotal = sales
    .filter(
      (sale) =>
        sale.paymentStatus === "paid" &&
        sale.saleType !== "accessories" &&
        sale.cafeAmount > 0 &&
        isToday(sale.paidAt ?? sale.createdAt)
    )
    .reduce(
      (total, sale) => total + sale.cafeAmount,
      0
    );
  const todayPaidSales = sales.filter(
    (sale) =>
      sale.paymentStatus === "paid" &&
      isToday(sale.paidAt ?? sale.createdAt)
  );
  const todayPaymentTotals =
    calculatePaymentTotals(todayPaidSales);

  const stats = [
    {
      label: "Total Tables",
      value: total,
      icon: LayoutGrid,
      tone: "text-slate-700",
      bg: "bg-slate-100",
      secondary: `${standardTableCount} tables · ${privateRoomCount} private rooms`,
    },
    {
      label: "Running",
      value: running,
      icon: CircleDot,
      tone: "text-red-600",
      bg: "bg-red-50",
      secondary: "Active sessions",
    },
    {
      label: "Available",
      value: available,
      icon: CircleCheck,
      tone: "text-emerald-600",
      bg: "bg-emerald-50",
      secondary: "Ready to start",
    },
    {
      label: "Payment-Pending Tables",
      value: pendingTables,
      icon: CircleDollarSign,
      tone: "text-amber-600",
      bg: "bg-amber-50",
      secondary: "Awaiting checkout",
    },
    {
      label: "Cafe Sales Today",
      value: money(todayCafeTotal),
      icon: CircleDollarSign,
      tone: "text-emerald-700",
      bg: "bg-emerald-50",
      secondary: "Paid cafe revenue",
    },
    {
      label: "Digital Payments",
      value: money(
        todayPaymentTotals.card +
          todayPaymentTotals.jazzcash +
          todayPaymentTotals.easypaisa
      ),
      icon: CircleDollarSign,
      tone: "text-blue-700",
      bg: "bg-blue-50",
      details: [
        {
          label: "JazzCash",
          value: todayPaymentTotals.jazzcash,
        },
        {
          label: "Easypaisa",
          value: todayPaymentTotals.easypaisa,
        },
        {
          label: "Card",
          value: todayPaymentTotals.card,
        },
      ],
    },
  ].slice(3);

  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card className="flex h-[160px] flex-col rounded-lg border-slate-200 bg-white p-3 shadow-none transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium text-slate-500">Table Status</p>
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-700">
            <LayoutGrid className="h-4 w-4" />
          </span>
        </div>
        <div className="mt-2 grid grid-cols-3 divide-x divide-slate-200 text-center">
          <div>
            <p className="text-xl font-bold text-slate-700">{total}</p>
            <p className="text-[11px] text-slate-500">Total</p>
          </div>
          <div>
            <p className="text-xl font-bold text-red-600">{running}</p>
            <p className="text-[11px] text-slate-500">Running</p>
          </div>
          <div>
            <p className="text-xl font-bold text-emerald-600">{available}</p>
            <p className="text-[11px] text-slate-500">Available</p>
          </div>
        </div>
        <p className="mt-auto text-xs text-slate-500">
          {standardTableCount} tables / {privateRoomCount} private rooms
        </p>
      </Card>

      {stats.map((stat) => {
        const Icon = stat.icon;
        const details =
          "details" in stat
            ? stat.details
            : undefined;

        return (
          <Card
            key={stat.label}
            className="flex h-[160px] flex-col gap-0 rounded-lg border-slate-200 bg-white p-3 shadow-none transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
          >
            <div className="flex min-h-8 items-start justify-between gap-2">
              <p className="text-xs font-medium leading-4 text-slate-500">
                {stat.label}
              </p>

              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${stat.bg} ${stat.tone}`}
              >
                <Icon className="h-4 w-4" />
              </div>
            </div>

            <p
              className={`mt-1 text-2xl font-bold ${stat.tone}`}
            >
              {stat.value}
            </p>

            {"secondary" in stat && stat.secondary && (
              <p className="mt-auto text-xs leading-4 text-slate-500">
                {stat.secondary}
              </p>
            )}

            {details && (
              <div className="mt-auto space-y-0.5 text-[11px] leading-4 text-slate-500">
                {details.map(
                  (detail) => (
                    <div
                      key={detail.label}
                      className="flex items-center justify-between gap-2"
                    >
                      <span>{detail.label}</span>
                      <span className="font-semibold text-slate-950">
                        {money(detail.value)}
                      </span>
                    </div>
                  )
                )}
              </div>
            )}
          </Card>
        );
      })}
    </section>
  );
}

export default DashboardStats;
