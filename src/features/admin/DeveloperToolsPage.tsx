import {
  AlertTriangle,
  ArrowLeft,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useCheckoutStore } from "@/features/billing/store/checkoutStore";
import { useBusinessDayStore } from "@/features/business-day/store/businessDayStore";
import { useCafeStore } from "@/features/cafe/store/cafeStore";
import { useExpensesStore } from "@/features/expenses/store/expensesStore";
import { useFloorPlanStore } from "@/features/floor-plan/useFloorPlanStore";
import { useSalesStore } from "@/features/sales/store/salesStore";
import { useTableHistoryStore } from "@/features/table-history/store/tableHistoryStore";
import { useCustomerAccountStore } from "@/features/customers/store/customerAccountStore";
import { useCreditLedgerStore } from "@/features/credit-ledger/store/creditLedgerStore";
import { useAdvanceGamesStore } from "@/features/advance-games/store/advanceGamesStore";
import { useTableStore } from "@/store/tableStore";
import { useOutsidePurchaseStore } from "@/features/outside-purchases/store/outsidePurchaseStore";
import { SNOOKER_ARENA_LOCAL_STORAGE_KEYS } from "@/features/backup/storageOwnership";

type ResetMode = "test-data" | "full";

function clearKnownStorage() {
  SNOOKER_ARENA_LOCAL_STORAGE_KEYS.forEach((key) => {
    window.localStorage.removeItem(key);
  });
}

export function clearTestDataForTesting({
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
}: {
  resetSalesStore: () => void;
  resetBillingStore: () => void;
  resetCafeTestData: () => void;
  resetExpensesStore: () => void;
  resetTableHistoryStore: () => void;
  resetBusinessDayStore: () => void;
  resetCustomerAccountsForTesting: () => void;
  resetCreditLedgerStore: () => void;
  resetAdvanceGamesStore: () => void;
  resetOutsidePurchaseStore: () => void;
  resetTableStoreToDefault: () => void;
}) {
  resetSalesStore();
  resetBillingStore();
  resetCafeTestData();
  resetExpensesStore();
  resetTableHistoryStore();
  resetBusinessDayStore();
  resetCustomerAccountsForTesting();
  resetCreditLedgerStore();
  resetAdvanceGamesStore();
  resetOutsidePurchaseStore();
  resetTableStoreToDefault();
}

function DeveloperToolsPage() {
  const navigate = useNavigate();

  const resetSalesStore = useSalesStore(
    (state) => state.resetSalesStore
  );
  const resetBillingStore =
    useCheckoutStore(
      (state) => state.resetBillingStore
    );
  const resetCafeTestData =
    useCafeStore(
      (state) => state.resetCafeTestData
    );
  const resetCafeStoreToDefault =
    useCafeStore(
      (state) =>
        state.resetCafeStoreToDefault
    );
  const resetExpensesStore =
    useExpensesStore(
      (state) => state.resetExpensesStore
    );
  const resetTableHistoryStore =
    useTableHistoryStore(
      (state) =>
        state.resetTableHistoryStore
    );
  const resetBusinessDayStore =
    useBusinessDayStore(
      (state) =>
        state.resetBusinessDayStore
    );
  const resetTableStoreToDefault =
    useTableStore(
      (state) =>
        state.resetTableStoreToDefault
    );
  const resetFloorPlanStoreToDefault =
    useFloorPlanStore(
      (state) =>
        state.resetFloorPlanStoreToDefault
    );
  const resetCustomerAccountsForTesting =
    useCustomerAccountStore(
      (state) =>
        state.resetCustomerAccountsForTesting
    );
  const resetCreditLedgerStore =
    useCreditLedgerStore(
      (state) => state.resetCreditLedgerStore
    );
  const resetAdvanceGamesStore = useAdvanceGamesStore(
    (state) => state.resetAdvanceGamesStore
  );
  const resetOutsidePurchaseStore = useOutsidePurchaseStore(
    (state) => state.resetOutsidePurchaseStore
  );

  const [mode, setMode] =
    useState<ResetMode | null>(null);
  const [confirmation, setConfirmation] =
    useState("");
  const [message, setMessage] =
    useState("");

  const expectedText =
    mode === "test-data"
      ? "CLEAR"
      : "RESET";
  const confirmationMatches =
    confirmation.trim().toUpperCase() ===
    expectedText;

  const closeDialog = () => {
    setMode(null);
    setConfirmation("");
  };

  const resetBusinessRecords = () => {
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
  };

  const handleConfirm = () => {
    if (!mode) return;

    if (!confirmationMatches) {
      setMessage(
        "Confirmation text does not match. Nothing was reset."
      );
      return;
    }

    if (mode === "test-data") {
      resetBusinessRecords();
      setMessage(
        "Test data cleared successfully."
      );
    }

    if (mode === "full") {
      clearKnownStorage();
      resetSalesStore();
      resetBillingStore();
      resetCafeStoreToDefault();
      resetExpensesStore();
      resetTableHistoryStore();
      resetBusinessDayStore();
      resetCustomerAccountsForTesting();
      resetCreditLedgerStore();
      resetOutsidePurchaseStore();
      resetTableStoreToDefault();
      resetFloorPlanStoreToDefault();
      setMessage(
        "App reset successfully."
      );
    }

    closeDialog();
    navigate("/operator");
  };

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <Button
          variant="ghost"
          className="mb-4 gap-2"
          onClick={() => navigate("/admin")}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Admin Dashboard
        </Button>

        <div className="mb-6">
          <p className="text-sm font-semibold uppercase text-red-700">
            Danger Zone
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">
            Developer Tools
          </h1>
          <p className="text-sm text-slate-500">
            Testing tools for clearing local app data. This page is Admin-only.
          </p>
        </div>

        {message && (
          <p className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 ring-1 ring-amber-200">
            {message}
          </p>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-amber-200 p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-amber-50 p-3 text-amber-700">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  Clear Test Data
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Deletes sales, pending bills, cafe orders, waiting customers, expenses, table history, and business day records. Settings remain.
                </p>
                <Button
                  className="mt-4 bg-amber-700 hover:bg-amber-800"
                  onClick={() => {
                    setMessage("");
                    setMode("test-data");
                  }}
                >
                  Clear Test Data
                </Button>
              </div>
            </div>
          </Card>

          <Card className="border-red-200 p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-red-50 p-3 text-red-700">
                <RotateCcw className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  Full Reset App
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Deletes all app data and settings, then restores default tables, menu, and floor plan.
                </p>
                <Button
                  className="mt-4 bg-red-700 hover:bg-red-800"
                  onClick={() => {
                    setMessage("");
                    setMode("full");
                  }}
                >
                  Full Reset App
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {mode && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4">
            <Card className="w-full max-w-lg border-red-200 p-6 shadow-xl">
              <div className="mb-4 flex items-start gap-3">
                <div className="rounded-lg bg-red-50 p-3 text-red-700">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-950">
                    {mode === "test-data"
                      ? "Clear Test Data"
                      : "Full Reset App"}
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">
                    {mode === "test-data"
                      ? "This will delete all test sales, bills, expenses, cafe orders, and history. Settings will remain."
                      : "This will delete all app data and settings. This cannot be undone."}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">
                  Type {expectedText} to confirm
                </label>
                <Input
                  value={confirmation}
                  onChange={(event) =>
                    setConfirmation(
                      event.target.value
                    )
                  }
                  placeholder={expectedText}
                  className="h-12 border border-slate-300 bg-white text-base text-slate-900 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-red-500"
                />
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={closeDialog}
                >
                  Cancel
                </Button>
                <Button
                  className={
                    mode === "full"
                      ? "bg-red-700 hover:bg-red-800"
                      : "bg-amber-700 hover:bg-amber-800"
                  }
                  disabled={!confirmationMatches}
                  onClick={handleConfirm}
                >
                  {mode === "test-data"
                    ? "Clear Test Data"
                    : "Reset App"}
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </main>
  );
}

export default DeveloperToolsPage;
