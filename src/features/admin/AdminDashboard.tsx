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
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import BusinessSummaryCards from "@/features/sales/components/BusinessSummaryCards";
import { useCheckoutStore } from "@/features/billing/store/checkoutStore";
import { useBusinessDayStore } from "@/features/business-day/store/businessDayStore";
import { calculateBusinessDaySummary } from "@/features/business-day/utils/businessDaySummary";
import { useSalesStore } from "@/features/sales/store/salesStore";
import { useExpensesStore } from "@/features/expenses/store/expensesStore";
import { useOutsidePurchaseStore } from "@/features/outside-purchases/store/outsidePurchaseStore";
import { useCafeStore } from "@/features/cafe/store/cafeStore";

function AdminDashboard() {
  const navigate = useNavigate();
  const pendingBillsCount =
    useCheckoutStore(
      (state) =>
        state.pendingBills.filter(
          (bill) =>
            bill.status !== "cancelled"
        ).length
    );
  const pendingBills =
    useCheckoutStore(
      (state) => state.pendingBills
    );
  const sales = useSalesStore(
    (state) => state.sales
  );
  const expenses = useExpensesStore(
    (state) => state.expenses
  );
  const activeDay =
    useBusinessDayStore((state) =>
      state.getActiveBusinessDay()
    );
  const outsidePurchases = useOutsidePurchaseStore(
    (state) => state.purchases
  );
  const vendorRestockingRecords = useCafeStore((state) => state.vendorRestockingRecords);
  const daySummary = activeDay
    ? calculateBusinessDaySummary({
        day: activeDay,
        sales,
        expenses,
        pendingBills,
        outsidePurchases,
        vendorRestockingRecords,
      })
    : undefined;

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">
              Admin Dashboard
            </h1>
            <p className="text-sm text-slate-500">
              Review sales, expenses, profit, and business reports.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="gap-2"
              size="lg"
              onClick={() =>
                navigate("/admin/sales")
              }
            >
              <ReceiptText className="h-4 w-4" />
              Sales History
            </Button>

            <Button
              variant="outline"
              className="gap-2"
              size="lg"
              onClick={() =>
                navigate("/admin/profit-loss")
              }
            >
              <BarChart3 className="h-4 w-4" />
              Profit / Loss
            </Button>

            <Button
              variant="outline"
              className="gap-2"
              size="lg"
              onClick={() => navigate("/admin/canteen-profit")}
            >
              <Coffee className="h-4 w-4" />
              Canteen Profit Report
            </Button>

            <Button
              variant="outline"
              className="gap-2"
              size="lg"
              onClick={() =>
                navigate("/admin/day-history")
              }
            >
              <CalendarDays className="h-4 w-4" />
              Day History
            </Button>

            <Button
              variant="outline"
              className="gap-2"
              size="lg"
              onClick={() =>
                navigate("/admin/table-history")
              }
            >
              <History className="h-4 w-4" />
              Table History
            </Button>

            <Button
              variant="outline"
              className="gap-2"
              size="lg"
              onClick={() =>
                navigate("/admin/menu")
              }
            >
              <Coffee className="h-4 w-4" />
              Menu Management
            </Button>

            <Button
              variant="outline"
              className="gap-2"
              size="lg"
              onClick={() =>
                navigate("/admin/menu/vendor-restocking")
              }
            >
              <PackagePlus className="h-4 w-4" />
              Vendor Restocking
            </Button>

            <Button
              variant="outline"
              className="gap-2"
              size="lg"
              onClick={() =>
                navigate("/admin/accessories")
              }
            >
              <Package className="h-4 w-4" />
              Accessories Management
            </Button>

            <Button
              variant="outline"
              className="gap-2"
              size="lg"
              onClick={() =>
                navigate("/operator/club-settings")
              }
            >
              <SlidersHorizontal className="h-4 w-4" />
              Club Settings
            </Button>

            <Button
              variant="outline"
              className="gap-2"
              size="lg"
              onClick={() =>
                navigate("/operator/backup-restore")
              }
            >
              <DatabaseBackup className="h-4 w-4" />
              Backup & Restore
            </Button>

            <Button
              variant="outline"
              className="gap-2"
              size="lg"
              onClick={() =>
                navigate("/admin/developer-tools")
              }
            >
              <Settings className="h-4 w-4" />
              Developer Tools
            </Button>

            <Button
              variant="outline"
              className="gap-2"
              size="lg"
              onClick={() =>
                navigate("/admin/expenses")
              }
            >
              <WalletCards className="h-4 w-4" />
              Expenses
            </Button>

            <Button
              className="gap-2 bg-emerald-950 hover:bg-emerald-900"
              size="lg"
              onClick={() =>
                navigate("/operator")
              }
            >
              <ArrowLeftRight className="h-4 w-4" />
              Operator View
            </Button>
          </div>
        </div>

        <Card className="mb-4 p-4">
          <div className="grid gap-4 md:grid-cols-5">
            <div>
              <p className="text-sm text-slate-500">
                Active Day
              </p>
              <p className="mt-1 text-xl font-bold text-slate-950">
                {activeDay
                  ? activeDay.openedBy
                  : "No active day"}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">
                Current Day Sales
              </p>
              <p className="mt-1 text-xl font-bold text-slate-950">
                Rs. {daySummary?.totalSales ?? 0}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">
                Current Day Expenses
              </p>
              <p className="mt-1 text-xl font-bold text-slate-950">
                Rs.{" "}
                {daySummary?.totalExpenses ?? 0}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">
                Expected Cash
              </p>
              <p className="mt-1 text-xl font-bold text-emerald-700">
                Rs.{" "}
                {daySummary?.expectedCash ?? 0}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">
                Pending Bills
              </p>
              <p className="mt-1 text-xl font-bold text-slate-950">
                {pendingBillsCount}
              </p>
            </div>
          </div>
        </Card>

        <BusinessSummaryCards />
      </div>
    </main>
  );
}

export default AdminDashboard;
