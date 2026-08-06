import {
  ArrowLeftRight,
  BarChart3,
  CalendarDays,
  Coffee,
  DatabaseBackup,
  History,
  Package,
  PackagePlus,
  ReceiptText,
  Settings,
  SlidersHorizontal,
  WalletCards,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeading, PageShell } from "@/components/layout/page-layout";
import { useAdminModeStore } from "@/features/admin-mode/adminModeStore";
import type { AppPermission } from "@/features/admin-mode/permissions";
import { useCheckoutStore } from "@/features/billing/store/checkoutStore";
import { useBusinessDayStore } from "@/features/business-day/store/businessDayStore";
import { calculateBusinessDaySummary } from "@/features/business-day/utils/businessDaySummary";
import { useCafeStore } from "@/features/cafe/store/cafeStore";
import { useExpensesStore } from "@/features/expenses/store/expensesStore";
import { useOutsidePurchaseStore } from "@/features/outside-purchases/store/outsidePurchaseStore";
import BusinessSummaryCards from "@/features/sales/components/BusinessSummaryCards";
import { useSalesStore } from "@/features/sales/store/salesStore";
import { useStaffPayrollStore } from "@/features/staff-payroll/store/staffPayrollStore";

import { AdminNavigationCard } from "./components/AdminNavigationCard";

interface AdminDestination {
  title: string;
  description: string;
  path: string;
  icon: LucideIcon;
  permission: AppPermission;
}

const destinationGroups: Array<{
  title: string;
  description: string;
  items: AdminDestination[];
}> = [
  {
    title: "Reports",
    description: "Review sales, profitability, and completed operating history.",
    items: [
      {
        title: "Sales History",
        description: "Review completed sales and payment records.",
        path: "/admin/sales",
        icon: ReceiptText,
        permission: "view_management_reports",
      },
      {
        title: "Profit / Loss",
        description: "Review revenue, expenses, and profit.",
        path: "/admin/profit-loss",
        icon: BarChart3,
        permission: "view_management_reports",
      },
      {
        title: "Cafe Sales Report",
        description: "Review cafe sales, cost, and profit.",
        path: "/admin/canteen-profit",
        icon: Coffee,
        permission: "view_management_reports",
      },
      {
        title: "Day History",
        description: "Review completed Business Days.",
        path: "/admin/day-history",
        icon: CalendarDays,
        permission: "view_management_reports",
      },
      {
        title: "Table History",
        description: "Review completed table and room sessions.",
        path: "/admin/table-history",
        icon: History,
        permission: "view_management_reports",
      },
    ],
  },
  {
    title: "Operations & Management",
    description: "Maintain cafe products, deliveries, accessories, and staff payroll.",
    items: [
      {
        title: "Staff Payroll",
        description: "Manage employees, salary advances, and salary payments.",
        path: "/admin/staff-payroll",
        icon: WalletCards,
        permission: "manage_payroll",
      },
      {
        title: "Menu Management",
        description: "Manage cafe products, prices, and stock tracking.",
        path: "/admin/menu",
        icon: Coffee,
        permission: "manage_canteen",
      },
      {
        title: "Vendor Restocking",
        description: "Record packaged-product deliveries and stock increases.",
        path: "/admin/menu/vendor-restocking",
        icon: PackagePlus,
        permission: "manage_vendor_restocking",
      },
      {
        title: "Accessories Management",
        description: "Manage accessory products, prices, and stock.",
        path: "/admin/accessories",
        icon: Package,
        permission: "manage_inventory",
      },
    ],
  },
  {
    title: "Settings & System",
    description: "Configure the club, application preferences, and local data tools.",
    items: [
      {
        title: "Club Settings",
        description: "Manage club branding, rates, operators, and business defaults.",
        path: "/operator/club-settings",
        icon: SlidersHorizontal,
        permission: "manage_settings",
      },
      {
        title: "General Settings",
        description: "Manage interface scale, density, theme, date, and time preferences.",
        path: "/operator/general-settings",
        icon: Settings,
        permission: "manage_settings",
      },
      {
        title: "Backup & Restore",
        description: "Export or restore the local application data.",
        path: "/operator/backup-restore",
        icon: DatabaseBackup,
        permission: "manage_backups",
      },
      {
        title: "Developer Tools",
        description: "Open testing and maintenance tools.",
        path: "/admin/developer-tools",
        icon: Wrench,
        permission: "manage_settings",
      },
    ],
  },
];

function money(value: number) {
  return `Rs. ${Math.round(value).toLocaleString()}`;
}

function AdminDashboard() {
  const navigate = useNavigate();
  const can = useAdminModeStore((state) => state.can);
  const pendingBills = useCheckoutStore((state) => state.pendingBills);
  const pendingBillsCount = pendingBills.filter(
    (bill) => bill.status !== "cancelled",
  ).length;
  const sales = useSalesStore((state) => state.sales);
  const expenses = useExpensesStore((state) => state.expenses);
  const activeDay = useBusinessDayStore((state) => state.getActiveBusinessDay());
  const outsidePurchases = useOutsidePurchaseStore((state) => state.purchases);
  const vendorRestockingRecords = useCafeStore(
    (state) => state.vendorRestockingRecords,
  );
  const salaryAdvances = useStaffPayrollStore((state) => state.salaryAdvances);
  const salaryPayments = useStaffPayrollStore((state) => state.salaryPayments);
  const daySummary = activeDay
    ? calculateBusinessDaySummary({
        day: activeDay,
        sales,
        expenses,
        pendingBills,
        outsidePurchases,
        vendorRestockingRecords,
        salaryAdvances,
        salaryPayments,
      })
    : undefined;

  const dayItems = [
    { label: "Active Day / Operator", value: activeDay?.openedBy ?? "No active day" },
    { label: "Current Day Sales", value: money(daySummary?.totalSales ?? 0) },
    { label: "Current Day Expenses", value: money(daySummary?.totalExpenses ?? 0) },
    { label: "Expected Cash", value: money(daySummary?.expectedCash ?? 0), accent: true },
    { label: "Pending Bills", value: String(pendingBillsCount) },
  ];

  return (
    <PageShell>
        <PageHeading
          icon={Settings}
          title="Admin Dashboard"
          description="Review sales, expenses, profit, and business reports."
        />

        <Card className="p-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {dayItems.map((item) => (
              <div key={item.label} className="min-w-0">
                <p className="text-xs font-medium text-slate-500">{item.label}</p>
                <p
                  className={`mt-1 truncate text-lg font-bold tabular-nums ${
                    item.accent ? "text-emerald-700" : "text-slate-950"
                  }`}
                  title={item.value}
                >
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <BusinessSummaryCards />

        {destinationGroups.map((group) => {
          const visibleItems = group.items.filter((item) => can(item.permission));
          if (visibleItems.length === 0) return null;

          return (
            <section key={group.title}>
              <div className="mb-3">
                <h2 className="text-lg font-bold text-slate-950">{group.title}</h2>
                <p className="mt-0.5 text-sm text-slate-500">{group.description}</p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {visibleItems.map((item) => (
                  <AdminNavigationCard
                    key={item.path}
                    icon={item.icon}
                    title={item.title}
                    description={item.description}
                    onClick={() => navigate(item.path)}
                  />
                ))}
              </div>
            </section>
          );
        })}

        <div className="flex justify-end border-t border-slate-200 pt-4">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => navigate("/operator")}
          >
            <ArrowLeftRight className="h-4 w-4" />
            Switch to Operator View
          </Button>
        </div>
    </PageShell>
  );
}

export default AdminDashboard;
