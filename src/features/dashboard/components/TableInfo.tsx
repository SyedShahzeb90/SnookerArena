import {
  Clock,
  Coffee,
  Users,
} from "lucide-react";

import type { Session } from "@/types/session";

interface Props {
  session: Session;
}

function TableInfo({ session }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-lg bg-slate-50 p-3">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-500">
          <Users className="h-4 w-4" />
          Players
        </div>

        <p className="font-semibold text-slate-950">
          {session.player1 || "-"}
        </p>

        {session.player2 && (
          <p className="font-semibold text-slate-950">
            {session.player2}
          </p>
        )}
      </div>

      <div className="rounded-lg bg-slate-50 p-3">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-500">
          <Clock className="h-4 w-4" />
          Started
        </div>

        <p className="font-semibold text-slate-950">
          {new Date(
            session.startTime
          ).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>

        <p className="text-sm capitalize text-slate-500">
          {session.sessionType}
        </p>
      </div>

      <div className="rounded-lg bg-emerald-50 p-3">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-emerald-700">
          <Coffee className="h-4 w-4" />
          Cafe Bill
        </div>

        <p className="font-semibold text-emerald-800">
          Rs. {session.cafeAmount}
        </p>
      </div>
    </div>
  );
}

export default TableInfo;
