import {
  CalendarClock,
  Grid3X3,
  LayoutDashboard,
  Map,
} from "lucide-react";
import { useState } from "react";
import { Navigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { clearTestDataForTesting } from "@/features/admin/DeveloperToolsPage";
import { useAdvanceGamesStore } from "@/features/advance-games/store/advanceGamesStore";
import { useCheckoutStore } from "@/features/billing/store/checkoutStore";
import BusinessDayCard from "@/features/business-day/components/BusinessDayCard";
import { useBusinessDayStore } from "@/features/business-day/store/businessDayStore";
import { useCafeStore } from "@/features/cafe/store/cafeStore";
import { useCreditLedgerStore } from "@/features/credit-ledger/store/creditLedgerStore";
import { useCustomerAccountStore } from "@/features/customers/store/customerAccountStore";
import { useExpensesStore } from "@/features/expenses/store/expensesStore";
import FloorPlanView from "@/features/floor-plan/FloorPlanView";
import { useOutsidePurchaseStore } from "@/features/outside-purchases/store/outsidePurchaseStore";
import { useSalesStore } from "@/features/sales/store/salesStore";
import { useTableHistoryStore } from "@/features/table-history/store/tableHistoryStore";
import { useTableStore } from "@/store/tableStore";

import type { DashboardView } from "./components/DashboardHeader";
import {
  BusinessDayStats,
  TableStatusStats,
} from "./components/DashboardStats";
import TableGrid from "./components/TableGrid";

const pageClassName =
  "mx-auto max-w-7xl px-4 py-4 sm:px-5 sm:py-5 lg:px-6 lg:py-6";

function PageHeader({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: typeof LayoutDashboard;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-slate-700 ring-1 ring-slate-200">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-slate-950">{title}</h1>
        <p className="mt-0.5 text-sm leading-5 text-slate-500">{description}</p>
      </div>
    </div>
  );
}

function TestDataBanner() {
  const [isClearing, setIsClearing] = useState(false);
  const [message, setMessage] = useState("");
  const resetSalesStore = useSalesStore((state) => state.resetSalesStore);
  const resetBillingStore = useCheckoutStore((state) => state.resetBillingStore);
  const resetCafeTestData = useCafeStore((state) => state.resetCafeTestData);
  const resetExpensesStore = useExpensesStore((state) => state.resetExpensesStore);
  const resetTableHistoryStore = useTableHistoryStore(
    (state) => state.resetTableHistoryStore,
  );
  const resetBusinessDayStore = useBusinessDayStore(
    (state) => state.resetBusinessDayStore,
  );
  const resetCustomerAccountsForTesting = useCustomerAccountStore(
    (state) => state.resetCustomerAccountsForTesting,
  );
  const resetCreditLedgerStore = useCreditLedgerStore(
    (state) => state.resetCreditLedgerStore,
  );
  const resetAdvanceGamesStore = useAdvanceGamesStore(
    (state) => state.resetAdvanceGamesStore,
  );
  const resetOutsidePurchaseStore = useOutsidePurchaseStore(
    (state) => state.resetOutsidePurchaseStore,
  );
  const resetTableStoreToDefault = useTableStore(
    (state) => state.resetTableStoreToDefault,
  );

  if (!import.meta.env.DEV && !message) return null;

  const handleClearTestData = () => {
    if (isClearing) return;
    setIsClearing(true);
    setMessage("");
    try {
      clearTestDataForTesting({
        resetSalesStore,
        resetBillingStore,
        resetCafeTestData,
        resetExpensesStore,
        resetTableHistoryStore,
        resetBusinessDayStore,
        resetCustomerAccountsForTesting,
        resetCreditLedgerStore,
        resetAdvanceGamesStore,
        resetOutsidePurchaseStore,
        resetTableStoreToDefault,
      });
      setMessage("Test data cleared successfully.");
    } catch {
      setMessage("Unable to clear test data.");
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="space-y-3">
      {import.meta.env.DEV && (
        <div className="flex flex-col gap-3 rounded-lg border border-red-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-red-700">Testing only</p>
            <p className="text-sm text-slate-600">
              Clear the local test data set from Operator view.
            </p>
          </div>
          <Button
            className="shrink-0 bg-red-700 text-white hover:bg-red-800"
            disabled={isClearing}
            onClick={handleClearTestData}
          >
            Clear Test Data
          </Button>
        </div>
      )}
      {message && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 ring-1 ring-amber-200">
          {message}
        </p>
      )}
    </div>
  );
}

export function OperatorLandingRedirect() {
  const hasActiveBusinessDay = useBusinessDayStore((state) =>
    state.days.some((day) => day.status === "active"),
  );
  return (
    <Navigate
      replace
      to={hasActiveBusinessDay ? "/operator/tables-rooms" : "/operator/business-day"}
    />
  );
}

export function BusinessDayPage() {
  return (
    <main className={pageClassName}>
      <div className="space-y-5 lg:space-y-6">
        <PageHeader
          icon={CalendarClock}
          title="Business Day"
          description="Start, monitor, and close the current business day."
        />
        <TestDataBanner />
        <BusinessDayCard />
        <BusinessDayStats />
      </div>
    </main>
  );
}

export function TablesRoomsPage() {
  const [activeView, setActiveView] = useState<DashboardView>("grid");

  return (
    <main className={pageClassName}>
      <div className="space-y-5 lg:space-y-6">
        <PageHeader
          icon={LayoutDashboard}
          title="Tables & Rooms"
          description="Manage active sessions, availability, and table bookings."
        />
        <TestDataBanner />
        <TableStatusStats />
        <section>
          <div className="mb-4 flex flex-col gap-3 border-b border-slate-200 pb-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Floor View</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Start sessions and manage active tables and private rooms.
              </p>
            </div>
            <div className="flex w-fit rounded-md border border-slate-200 bg-white p-1">
              <Button
                variant={activeView === "grid" ? "default" : "ghost"}
                className={`h-8 gap-1.5 rounded px-3 text-xs ${
                  activeView === "grid"
                    ? "bg-slate-950 !text-white hover:bg-slate-800 dark:!bg-blue-600 dark:hover:!bg-blue-500"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
                onClick={() => setActiveView("grid")}
              >
                <Grid3X3 className="h-3.5 w-3.5" />
                Grid View
              </Button>
              <Button
                variant={activeView === "floor-plan" ? "default" : "ghost"}
                className={`h-8 gap-1.5 rounded px-3 text-xs ${
                  activeView === "floor-plan"
                    ? "bg-slate-950 !text-white hover:bg-slate-800 dark:!bg-blue-600 dark:hover:!bg-blue-500"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
                onClick={() => setActiveView("floor-plan")}
              >
                <Map className="h-3.5 w-3.5" />
                Floor Plan
              </Button>
            </div>
          </div>
          {activeView === "grid" ? (
            <div className="animate-in fade-in duration-300">
              <TableGrid />
            </div>
          ) : (
            <FloorPlanView />
          )}
        </section>
      </div>
    </main>
  );
}

export default OperatorLandingRedirect;
