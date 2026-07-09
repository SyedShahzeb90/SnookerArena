import { Coffee, LayoutDashboard } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";

import DashboardHeader from "./components/DashboardHeader";
import type { DashboardView } from "./components/DashboardHeader";
import DashboardStats from "./components/DashboardStats";
import TableGrid from "./components/TableGrid";
import FloorPlanView from "@/features/floor-plan/FloorPlanView";

function Dashboard() {
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

          <Button
            className="gap-2 bg-emerald-950 hover:bg-emerald-900"
            size="lg"
            onClick={() => navigate("/cafe")}
          >
            <Coffee className="h-4 w-4" />
            Cafe POS
          </Button>
        </div>

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

export default Dashboard;
