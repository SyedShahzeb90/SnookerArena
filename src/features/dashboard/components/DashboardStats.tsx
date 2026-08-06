import { CircleDollarSign } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Card } from "@/components/ui/card";
import { ProgressIndicator } from "@/components/ui/progress-indicator";
import { useCafeStore } from "@/features/cafe/store/cafeStore";
import { getCollectPaymentPendingCount } from "@/features/billing/utils/collectPaymentSummary";
import { useCustomerAccountStore } from "@/features/customers/store/customerAccountStore";
import { useSalesStore } from "@/features/sales/store/salesStore";
import { calculatePaymentTotals } from "@/features/sales/utils/salesReports";
import { useTableStore } from "@/store/tableStore";
import { CashPositionSummaryCard } from "@/features/business-day/components/BusinessDayCard";
import { useAnimatedNumber } from "@/hooks/useAnimatedNumber";

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
  const customerAccounts = useCustomerAccountStore((state) => state.accounts);
  const sales = useSalesStore((state) => state.sales);
  const menu = useCafeStore((state) => state.menu);
  const total = tables.length;
  const standardTableCount = tables.filter((table) => table.type === "table").length;
  const privateRoomCount = tables.filter((table) => table.type === "private-room").length;
  const available = tables.filter((table) => table.status === "available").length;
  const running = tables.filter((table) => table.status === "running").length;
  const paused = tables.filter((table) => table.status === "paused").length;
  const pendingBillCount = getCollectPaymentPendingCount(
    customerAccounts,
    tables,
  );
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
    pendingBillCount,
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
  const { todayPaymentTotals } = useDashboardStats();
  const stats = [
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
      supportingText: "Paid digital sales",
    },
  ];

  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <CashPositionSummaryCard />
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

export type TableStatusFilter =
  | "all"
  | "running"
  | "paused"
  | "available"
  | "payment-pending";

interface TableStatusStatsProps {
  activeFilter: TableStatusFilter;
  onFilterChange: (filter: TableStatusFilter) => void;
  onPaymentPendingClick: () => void;
}

type StatusMetric = {
  filter: TableStatusFilter;
  label: string;
  value: number;
  valueClassName: string;
  supportingText?: string;
  emphasized?: boolean;
};

function useIncreaseAttention(value: number, enabled: boolean) {
  const previousValueRef = useRef(value);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const previousValue = previousValueRef.current;
    previousValueRef.current = value;

    if (!enabled || value <= previousValue) return;

    setIsActive(false);
    const frame = window.requestAnimationFrame(() => setIsActive(true));
    const timeout = window.setTimeout(() => setIsActive(false), 500);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [enabled, value]);

  return isActive;
}

function StatusMetricButton({
  metric,
  isActive,
  onFilterChange,
  onAction,
}: {
  metric: StatusMetric;
  isActive: boolean;
  onFilterChange: (filter: TableStatusFilter) => void;
  onAction?: () => void;
}) {
  const animatedValue = useAnimatedNumber(metric.value);
  const hasIncreaseAttention = useIncreaseAttention(
    metric.value,
    metric.filter === "running" ||
      metric.filter === "payment-pending",
  );

  return (
    <button
      type="button"
      aria-pressed={onAction ? undefined : isActive}
      onClick={() => {
        if (onAction) {
          onAction();
          return;
        }
        onFilterChange(
          isActive && metric.filter !== "all" ? "all" : metric.filter,
        );
      }}
      className={`min-w-0 px-3 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${
        isActive
          ? "bg-blue-50 ring-1 ring-inset ring-blue-300 dark:bg-blue-950/40 dark:ring-blue-700"
          : metric.emphasized
            ? "bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-950/50"
            : "bg-slate-50/70 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800"
      } ${
        hasIncreaseAttention
          ? metric.filter === "payment-pending"
            ? "summary-metric-attention-pending"
            : "summary-metric-attention-running"
          : ""
      } cursor-pointer`}
    >
      <p className="truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
        {metric.label}
      </p>
      <p
        className={`mt-0.5 text-lg font-bold tabular-nums ${metric.valueClassName}`}
      >
        {Math.round(animatedValue)}
      </p>
      {metric.supportingText && (
        <p className="mt-0.5 text-[10px] leading-3 text-slate-500 dark:text-slate-400">
          {metric.supportingText}
        </p>
      )}
    </button>
  );
}

export function TableStatusStats({
  activeFilter,
  onFilterChange,
  onPaymentPendingClick,
}: TableStatusStatsProps) {
  const {
    total,
    standardTableCount,
    privateRoomCount,
    available,
    running,
    paused,
    pendingBillCount,
    occupiedTables,
  } = useDashboardStats();

  const metrics: StatusMetric[] = [
    {
      filter: "all" as const,
      label: "Total",
      value: total,
      valueClassName: "text-slate-800 dark:text-slate-100",
      supportingText: `${standardTableCount} tables \u00b7 ${privateRoomCount} private rooms`,
    },
    {
      filter: "running" as const,
      label: "Running",
      value: running,
      valueClassName: "text-red-600 dark:text-red-400",
    },
    {
      filter: "paused" as const,
      label: "Paused",
      value: paused,
      valueClassName: "text-amber-600 dark:text-amber-400",
    },
    {
      filter: "available" as const,
      label: "Available",
      value: available,
      valueClassName: "text-emerald-600 dark:text-emerald-400",
    },
    {
      filter: "payment-pending" as const,
      label: "Payment Pending",
      value: pendingBillCount,
      valueClassName:
        pendingBillCount > 0
          ? "text-amber-700 dark:text-amber-300"
          : "text-slate-700 dark:text-slate-200",
      emphasized: pendingBillCount > 0,
    },
  ];

  return (
    <section>
      <Card className="rounded-lg border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center">
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-px overflow-hidden rounded-md border border-slate-200 bg-slate-200 sm:grid-cols-3 lg:grid-cols-5 dark:border-slate-700 dark:bg-slate-700">
            {metrics.map((metric) => {
              const isActive = activeFilter === metric.filter;
              return (
                <StatusMetricButton
                  key={metric.label}
                  metric={metric}
                  isActive={
                    metric.filter === "payment-pending" ? false : isActive
                  }
                  onFilterChange={onFilterChange}
                  onAction={
                    metric.filter === "payment-pending"
                      ? onPaymentPendingClick
                      : undefined
                  }
                />
              );
            })}
          </div>

          <div className="min-w-0 xl:w-64 xl:shrink-0">
            <ProgressIndicator
              label="Occupancy"
              current={occupiedTables}
              maximum={total}
              supportingText={`${occupiedTables} of ${total} occupied`}
              animate
            />
          </div>
        </div>
      </Card>
    </section>
  );
}

export default TableStatusStats;
