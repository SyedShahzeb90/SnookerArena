import {
  CircleDollarSign,
  LayoutGrid,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { ProgressIndicator } from "@/components/ui/progress-indicator";
import { useCafeStore } from "@/features/cafe/store/cafeStore";
import { useSalesStore } from "@/features/sales/store/salesStore";
import { calculatePaymentTotals } from "@/features/sales/utils/salesReports";
import { useTableStore } from "@/store/tableStore";

import { DashboardMetricCard } from "./DashboardMetricCard";

function money(value: number) {
  return `Rs. ${Math.round(value).toLocaleString()}`;
}

function isToday(value?: string) {
  if (!value) return false;
  return new Date(value).toDateString() === new Date().toDateString();
}

function useDashboardStats() {
  const tables = useTableStore((state) => state.tables);
  const sales = useSalesStore((state) => state.sales);
  const menu = useCafeStore((state) => state.menu);
  const total = tables.length;
  const standardTableCount = tables.filter((table) => table.type === "table").length;
  const privateRoomCount = tables.filter((table) => table.type === "private-room").length;
  const available = tables.filter((table) => table.status === "available").length;
  const running = tables.filter((table) => table.status === "running").length;
  const paused = tables.filter((table) => table.status === "paused").length;
  const pendingTables = tables.filter(
    (table) => table.status === "payment-pending",
  ).length;
  const occupiedTables = tables.filter(
    (table) =>
      table.status === "running" ||
      table.status === "paused" ||
      table.status === "payment-pending",
  ).length;
  const trackedProducts = menu.filter((item) => item.trackStock);
  const healthyProducts = trackedProducts.filter(
    (item) => (item.currentStock ?? 0) > (item.lowStockAlertQuantity ?? 0),
  ).length;
  const lowStockProducts = trackedProducts.filter((item) => {
    const stock = item.currentStock ?? 0;
    return stock > 0 && stock <= (item.lowStockAlertQuantity ?? 0);
  }).length;
  const outOfStockProducts = trackedProducts.filter(
    (item) => (item.currentStock ?? 0) <= 0,
  ).length;
  const todayCafeTotal = sales
    .filter(
      (sale) =>
        sale.paymentStatus === "paid" &&
        sale.saleType !== "accessories" &&
        sale.cafeAmount > 0 &&
        isToday(sale.paidAt ?? sale.createdAt),
    )
    .reduce((sum, sale) => sum + sale.cafeAmount, 0);
  const todayPaymentTotals = calculatePaymentTotals(
    sales.filter(
      (sale) =>
        sale.paymentStatus === "paid" &&
        isToday(sale.paidAt ?? sale.createdAt),
    ),
  );

  return {
    total,
    standardTableCount,
    privateRoomCount,
    available,
    running,
    paused,
    pendingTables,
    occupiedTables,
    trackedProducts,
    healthyProducts,
    lowStockProducts,
    outOfStockProducts,
    todayCafeTotal,
    todayPaymentTotals,
  };
}

export function BusinessDayStats() {
  const { todayCafeTotal, todayPaymentTotals } = useDashboardStats();
  const stats = [
    {
      label: "Canteen Sales Today",
      value: money(todayCafeTotal),
      tone: "text-emerald-700",
      bg: "bg-emerald-50",
      supportingText: "Paid canteen revenue",
    },
    {
      label: "Digital Payments",
      value: money(
        todayPaymentTotals.card +
          todayPaymentTotals.jazzcash +
          todayPaymentTotals.easypaisa,
      ),
      tone: "text-blue-700",
      bg: "bg-blue-50",
      details: [
        { label: "JazzCash", value: money(todayPaymentTotals.jazzcash) },
        { label: "Easypaisa", value: money(todayPaymentTotals.easypaisa) },
        { label: "Card", value: money(todayPaymentTotals.card) },
      ],
    },
  ];

  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {stats.map((stat) => (
        <DashboardMetricCard
          key={stat.label}
          title={stat.label}
          value={stat.value}
          icon={CircleDollarSign}
          tone={stat.tone}
          iconBackground={stat.bg}
          supportingText={stat.supportingText}
          details={stat.details}
        />
      ))}
    </section>
  );
}

export function TableStatusStats() {
  const {
    total,
    standardTableCount,
    privateRoomCount,
    available,
    running,
    paused,
    pendingTables,
    occupiedTables,
    trackedProducts,
    healthyProducts,
    lowStockProducts,
    outOfStockProducts,
  } = useDashboardStats();

  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card className="flex h-full min-h-[184px] flex-col rounded-lg border-slate-200 bg-white p-4 shadow-sm transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium text-slate-500">Table Status</p>
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-700">
            <LayoutGrid className="h-4 w-4" />
          </span>
        </div>
        <div className="mt-2 grid grid-cols-4 divide-x divide-slate-200 text-center">
          <div>
            <p className="text-xl font-bold text-slate-700">{total}</p>
            <p className="text-[11px] text-slate-500">Total</p>
          </div>
          <div>
            <p className="text-xl font-bold text-red-600">{running}</p>
            <p className="text-[11px] text-slate-500">Running</p>
          </div>
          <div>
            <p className="text-xl font-bold text-amber-600">{paused}</p>
            <p className="text-[11px] text-slate-500">Paused</p>
          </div>
          <div>
            <p className="text-xl font-bold text-emerald-600">{available}</p>
            <p className="text-[11px] text-slate-500">Available</p>
          </div>
        </div>
        <p className="mt-auto text-xs text-slate-500">
          {standardTableCount} tables / {privateRoomCount} private rooms
        </p>
        <div className="mt-2">
          <ProgressIndicator
            label="Table Occupancy"
            current={occupiedTables}
            maximum={total}
            supportingText={`${occupiedTables} of ${total} occupied`}
          />
        </div>
        {trackedProducts.length > 0 && (
          <div className="mt-2">
            <ProgressIndicator
              label="Tracked Stock"
              current={healthyProducts}
              maximum={trackedProducts.length}
              supportingText={`${healthyProducts} of ${trackedProducts.length} healthy`}
              status={`${lowStockProducts} low / ${outOfStockProducts} out`}
            />
          </div>
        )}
      </Card>

      <DashboardMetricCard
        title="Payment-Pending Tables"
        value={pendingTables}
        icon={CircleDollarSign}
        tone="text-amber-600"
        iconBackground="bg-amber-50"
        supportingText="Awaiting checkout"
      />
    </section>
  );
}

export default TableStatusStats;
