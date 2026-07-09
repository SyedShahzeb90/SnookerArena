import {
  CircleCheck,
  CircleDollarSign,
  CircleDot,
  LayoutGrid,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { useTableStore } from "@/store/tableStore";

function DashboardStats() {
  const tables = useTableStore(
    (state) => state.tables
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
  ];

  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon;

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
