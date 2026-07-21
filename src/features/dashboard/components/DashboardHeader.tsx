import {
  Clock,
  Trophy,
} from "lucide-react";

import useCurrentTime from "../hooks/useCurrentTime";
import { useClubSettingsStore } from "@/features/settings/store/clubSettingsStore";
import { formatAppDate, formatAppTime } from "@/lib/dateTime";

export type DashboardView = "grid" | "floor-plan";

function DashboardHeader() {
  const now = useCurrentTime();
  const clubName = useClubSettingsStore((state) => state.settings.clubName);
  const tagline = useClubSettingsStore((state) => state.settings.tagline);
  const dateFormat = useClubSettingsStore((state) => state.settings.dateFormat);
  const timeFormat = useClubSettingsStore((state) => state.settings.timeFormat);

  return (
    <header className="border-b bg-white">
      <div className="mx-auto grid w-full grid-cols-1 items-center gap-3 px-4 py-4 sm:grid-cols-[1fr_auto_1fr] sm:px-5 lg:px-6 lg:py-5">
        <div className="flex min-w-0 items-center justify-self-start gap-3 sm:col-start-1">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-emerald-950 text-white">
            <Trophy className="h-6 w-6" />
          </div>

          <div className="flex min-w-0 flex-col justify-center gap-0.5">
            <h1 className="text-xl font-extrabold leading-tight tracking-normal text-slate-900 dark:text-slate-100">
              {clubName}
            </h1>

            <p className="text-xs font-medium leading-4 text-slate-500 dark:text-slate-400">
              {tagline}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-self-end sm:col-start-3 sm:row-start-1">
          <div className="flex items-center gap-3 rounded-lg border bg-slate-50 px-4 py-2 text-sm text-slate-600">
            <Clock className="h-4 w-4" />
            <span className="font-medium">
              {formatAppDate(now, dateFormat)}
            </span>
            <span className="text-slate-300">|</span>
            <span className="font-semibold text-slate-950">
              {formatAppTime(now, timeFormat)}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

export default DashboardHeader;
