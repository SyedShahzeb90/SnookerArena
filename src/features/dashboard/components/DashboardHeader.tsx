import {
  Clock,
  Grid3X3,
  Map,
  Trophy,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import useCurrentTime from "../hooks/useCurrentTime";

export type DashboardView =
  | "grid"
  | "floor-plan";

interface Props {
  activeView: DashboardView;
  onViewChange: (
    view: DashboardView
  ) => void;
}

function DashboardHeader({
  activeView,
  onViewChange,
}: Props) {
  const now = useCurrentTime();

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-950 text-white">
            <Trophy className="h-6 w-6" />
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-normal text-slate-950">
              Snooker Arena
            </h1>

            <p className="text-sm font-medium text-slate-500">
              Club Management System
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border bg-slate-50 p-1">
            <Button
              variant={
                activeView === "grid"
                  ? "default"
                  : "ghost"
              }
              className={
                activeView === "grid"
                  ? "gap-2 bg-slate-950 hover:bg-slate-800"
                  : "gap-2"
              }
              onClick={() =>
                onViewChange("grid")
              }
            >
              <Grid3X3 className="h-4 w-4" />
              Grid View
            </Button>

            <Button
              variant={
                activeView ===
                "floor-plan"
                  ? "default"
                  : "ghost"
              }
              className={
                activeView ===
                "floor-plan"
                  ? "gap-2 bg-slate-950 hover:bg-slate-800"
                  : "gap-2"
              }
              onClick={() =>
                onViewChange("floor-plan")
              }
            >
              <Map className="h-4 w-4" />
              Floor Plan
            </Button>
          </div>

          <div className="flex items-center gap-3 rounded-lg border bg-slate-50 px-4 py-2 text-sm text-slate-600">
            <Clock className="h-4 w-4" />
            <span className="font-medium">
              {now.toLocaleDateString()}
            </span>
            <span className="text-slate-300">|</span>
            <span className="font-semibold text-slate-950">
              {now.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

export default DashboardHeader;
