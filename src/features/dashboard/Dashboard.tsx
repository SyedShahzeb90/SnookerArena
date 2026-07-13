import {
  Coffee,
  History,
  LayoutDashboard,
  Package,
  ReceiptText,
  WalletCards,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";

import DashboardHeader from "./components/DashboardHeader";
import type { DashboardView } from "./components/DashboardHeader";
import DashboardStats from "./components/DashboardStats";
import TableGrid from "./components/TableGrid";
import FloorPlanView from "@/features/floor-plan/FloorPlanView";
import BusinessDayCard from "@/features/business-day/components/BusinessDayCard";

function OperatorDashboard() {
  const navigate = useNavigate();
  const [activeView, setActiveView] =
    useState<DashboardView>("grid");

  return (
    <main className="min-h-screen bg-slate-100">
      <DashboardHeader
        activeView={activeView}
        onViewChange={setActiveView}
      />

      <div className="mx-auto max-w-7xl px-6 py-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-slate-700 shadow-sm ring-1 ring-slate-200">
              <LayoutDashboard className="h-5 w-5" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-950">
                Floor Overview
              </h2>
              <p className="text-sm text-slate-500">
                Monitor active sessions, table availability, and pending payments.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="gap-2"
              size="lg"
              onClick={() =>
                navigate("/operator/table-history")
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
                navigate("/operator/billing")
              }
            >
              <ReceiptText className="h-4 w-4" />
              Customer Bills / Checkout
            </Button>

            <Button
              variant="outline"
              className="gap-2"
              size="lg"
              onClick={() =>
                navigate("/operator/expenses")
              }
            >
              <WalletCards className="h-4 w-4" />
              Expenses
            </Button>

            <Button
              className="gap-2 bg-emerald-950 hover:bg-emerald-900"
              size="lg"
              onClick={() => navigate("/operator/cafe")}
            >
              <Coffee className="h-4 w-4" />
              Cafe POS
            </Button>

            <Button
              className="gap-2 bg-slate-950 hover:bg-slate-900"
              size="lg"
              onClick={() =>
                navigate("/operator/accessories")
              }
            >
              <Package className="h-4 w-4" />
              Accessories POS
            </Button>

            <Button
              variant="outline"
              className="gap-2"
              size="lg"
              onClick={() => navigate("/admin")}
            >
              Admin
            </Button>
          </div>
        </div>

        <BusinessDayCard />

        <DashboardStats />

        <div className="mt-6">
          {activeView === "grid" ? (
            <div className="animate-in fade-in duration-300">
              <TableGrid />
            </div>
          ) : (
            <FloorPlanView />
          )}
        </div>
      </div>
    </main>
  );
}

export default OperatorDashboard;
