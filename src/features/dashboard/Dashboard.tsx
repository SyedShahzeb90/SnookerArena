import {
  CalendarClock,
  Grid3X3,
  LayoutDashboard,
  Map,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { PageBanner, PageHeading, PageShell } from "@/components/layout/page-layout";
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
import { usePrefersReducedMotion } from "@/hooks/useAnimatedNumber";
import { useTableStore } from "@/store/tableStore";

import type { DashboardView } from "./components/DashboardHeader";
import {
  BusinessDayStats,
  TableStatusStats,
} from "./components/DashboardStats";
import type { TableStatusFilter } from "./components/DashboardStats";
import TableGrid from "./components/TableGrid";

function TestDataBanner() {
  const [isClearing, setIsClearing] = useState(false);
  const toast = useToast();
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

  if (!import.meta.env.DEV) return null;

  const handleClearTestData = () => {
    if (isClearing) return;
    setIsClearing(true);
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
      toast.success({
        title: "Test Data Cleared",
        description: "The local test data set was cleared successfully.",
      });
    } catch {
      toast.error({
        title: "Unable to Clear Test Data",
        description: "Please try again.",
      });
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <PageBanner className="border-red-200 dark:border-red-900/70">
      <details className="group">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm marker:hidden">
        <span className="font-semibold text-red-700 dark:text-red-400">
          Testing tools
        </span>
        <span className="text-xs text-slate-500 group-open:hidden dark:text-slate-400">
          Clear local test data
        </span>
      </summary>
      <div className="mt-2 flex flex-col gap-2 border-t border-red-100 pt-2 sm:flex-row sm:items-center sm:justify-between dark:border-red-900/50">
        <p className="text-xs text-slate-600 dark:text-slate-300">
          Clear the local test data set from Operator view.
        </p>
        <Button
          size="sm"
          className="h-8 shrink-0 bg-red-700 px-3 text-white hover:bg-red-800"
          disabled={isClearing}
          onClick={handleClearTestData}
        >
          {isClearing ? "Clearing..." : "Clear Test Data"}
        </Button>
      </div>
      </details>
    </PageBanner>
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
    <PageShell>
        <PageHeading
          icon={CalendarClock}
          title="Business Day"
          description="Start, monitor, and close the current business day."
        />
        <TestDataBanner />
        <BusinessDayCard />
        <BusinessDayStats />
    </PageShell>
  );
}

export function TablesRoomsPage() {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState<DashboardView>("grid");
  const [focusedTableId, setFocusedTableId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] =
    useState<TableStatusFilter>("all");
  const [renderedStatusFilter, setRenderedStatusFilter] =
    useState<TableStatusFilter>("all");
  const [filterTransition, setFilterTransition] =
    useState<"idle" | "out" | "in">("idle");
  const filterTimerRef = useRef<number | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  const handleStatusFilterChange = useCallback(
    (nextFilter: TableStatusFilter) => {
      setStatusFilter(nextFilter);

      if (filterTimerRef.current !== null) {
        window.clearTimeout(filterTimerRef.current);
      }

      if (prefersReducedMotion) {
        setRenderedStatusFilter(nextFilter);
        setFilterTransition("idle");
        return;
      }

      setFilterTransition("out");
      filterTimerRef.current = window.setTimeout(() => {
        setRenderedStatusFilter(nextFilter);
        setFilterTransition("in");
        filterTimerRef.current = window.setTimeout(() => {
          setFilterTransition("idle");
          filterTimerRef.current = null;
        }, 120);
      }, 90);
    },
    [prefersReducedMotion],
  );

  useEffect(
    () => () => {
      if (filterTimerRef.current !== null) {
        window.clearTimeout(filterTimerRef.current);
      }
    },
    [],
  );

  const handleFloorPlanTableOpen = useCallback((tableId: number) => {
    setFocusedTableId(tableId);
    setActiveView("grid");
  }, []);

  const handleTableFocusComplete = useCallback(() => {
    setFocusedTableId(null);
  }, []);

  return (
    <PageShell>
        <PageHeading
          icon={LayoutDashboard}
          title="Tables & Rooms"
          description="Manage active sessions, availability, and table bookings."
        />
        <TestDataBanner />
        <TableStatusStats
          activeFilter={statusFilter}
          onFilterChange={handleStatusFilterChange}
          onPaymentPendingClick={() => navigate("/operator/billing")}
        />
        <section>
          <div className="mb-4 flex flex-col gap-3 border-b border-slate-200 pb-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">
                {activeView === "grid" ? "Grid View" : "Floor View"}
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">
                {activeView === "grid"
                  ? "Manage active sessions, availability, and table bookings."
                  : "View and manage tables and private rooms from the club layout."}
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
          <div
            className="table-filter-transition"
            data-filter-transition={filterTransition}
          >
            {activeView === "grid" ? (
              <div className="animate-in fade-in duration-300">
                <TableGrid
                  focusTableId={focusedTableId}
                  onFocusComplete={handleTableFocusComplete}
                  statusFilter={renderedStatusFilter}
                />
              </div>
            ) : (
              <FloorPlanView
                onTableOpen={handleFloorPlanTableOpen}
                statusFilter={renderedStatusFilter}
              />
            )}
          </div>
        </section>
    </PageShell>
  );
}

export default OperatorLandingRedirect;
