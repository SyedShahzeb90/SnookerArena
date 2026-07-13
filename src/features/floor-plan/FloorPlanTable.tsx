import {
  memo,
  useMemo,
  type PointerEvent,
} from "react";
import {
  CircleDollarSign,
  Clock3,
  Coffee,
  Grip,
  User,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { calculateBill } from "@/features/pricing/utils/calculateBill";
import { calculateGamePrice } from "@/features/pricing/utils/calculateGamePrice";
import type { Table } from "@/types/table";
import { getSessionPlayers } from "@/features/sessions/utils/sessionPlayers";

import type { FloorPlanPosition } from "./useFloorPlanStore";

interface Props {
  table: Table;
  position: FloorPlanPosition;
  cafeAmount: number;
  now: Date;
  editMode: boolean;
  onClick: () => void;
  onPointerDown: (
    event: PointerEvent<HTMLDivElement>
  ) => void;
}

function formatDuration(ms: number) {
  const totalSeconds = Math.max(
    Math.floor(ms / 1000),
    0
  );

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(
    (totalSeconds % 3600) / 60
  );
  const seconds = totalSeconds % 60;

  return `${String(hours).padStart(
    2,
    "0"
  )}:${String(minutes).padStart(
    2,
    "0"
  )}:${String(seconds).padStart(
    2,
    "0"
  )}`;
}

const statusStyles = {
  available: {
    dot: "bg-slate-400",
    label: "Available",
    border: "border-slate-200",
    card: "bg-white",
  },
  running: {
    dot: "bg-emerald-500",
    label: "Running",
    border: "border-emerald-300",
    card: "bg-emerald-50/70",
  },
  paused: {
    dot: "bg-yellow-500",
    label: "Paused",
    border: "border-yellow-300",
    card: "bg-yellow-50/70",
  },
  "payment-pending": {
    dot: "bg-red-500",
    label: "Payment Pending",
    border: "border-red-300",
    card: "bg-red-50/70",
  },
  reserved: {
    dot: "bg-blue-500",
    label: "Reserved",
    border: "border-blue-300",
    card: "bg-blue-50/70",
  },
  maintenance: {
    dot: "bg-zinc-500",
    label: "Maintenance",
    border: "border-zinc-300",
    card: "bg-zinc-50/70",
  },
};

function FloorPlanTable({
  table,
  position,
  cafeAmount,
  now,
  editMode,
  onClick,
  onPointerDown,
}: Props) {
  const elapsed = useMemo(() => {
    if (!table.session) return "00:00:00";

    const currentTime =
      table.session.pausedAt
        ? new Date(
            table.session.pausedAt
          ).getTime()
        : table.session.endTime
          ? new Date(
              table.session.endTime
            ).getTime()
          : now.getTime();

    return formatDuration(
      currentTime -
        new Date(
          table.session.startTime
        ).getTime() -
        table.session.totalPausedMilliseconds
    );
  }, [table.session, now]);
  const elapsedMilliseconds = useMemo(() => {
    if (!table.session) return 0;

    const currentTime =
      table.session.pausedAt
        ? new Date(
            table.session.pausedAt
          ).getTime()
        : table.session.endTime
          ? new Date(
              table.session.endTime
            ).getTime()
          : now.getTime();

    return (
      currentTime -
      new Date(
        table.session.startTime
      ).getTime() -
      table.session.totalPausedMilliseconds
    );
  }, [table.session, now]);

  const currentBill = useMemo(() => {
    if (!table.session) return 0;

    const pricing = calculateGamePrice({
      sessionType:
        table.session.sessionType,
      tableType: table.type,
      startTime: new Date(
        table.session.startTime
      ),
      endTime:
        table.session.endTime ??
        now,
    });

    return calculateBill({
      gameAmount: pricing.gameAmount,
      cafeAmount,
      discount: table.session.discount,
    }).total;
  }, [table, cafeAmount, now]);

  const status = statusStyles[table.status];
  const elapsedMinutes =
    elapsedMilliseconds / 60000;
  const timeWarningStyle =
    table.status === "running" &&
    elapsedMinutes >= 30
      ? {
          border: "border-red-300",
          card: "bg-red-50",
        }
      : table.status === "running" &&
          elapsedMinutes >= 25
        ? {
            border: "border-amber-300",
            card: "bg-amber-50",
          }
        : status;
  const players = table.session
    ? getSessionPlayers(table.session)
    : [];

  return (
    <Card
      onClick={editMode ? undefined : onClick}
      onPointerDown={
        editMode ? onPointerDown : undefined
      }
      className={`absolute w-[clamp(135px,14vw,185px)] cursor-pointer select-none rounded-lg p-3 shadow-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-xl ${timeWarningStyle.border} ${timeWarningStyle.card} ${
        editMode ? "cursor-grab active:cursor-grabbing" : ""
      }`}
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: "translate(-50%, -50%)",
      }}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-950">
            {table.name}
          </h3>

          <div className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
            <span
              className={`h-2.5 w-2.5 rounded-full ${status.dot} ${
                table.status === "running"
                  ? "animate-pulse"
                  : ""
              }`}
            />
            {status.label}
          </div>
        </div>

        {editMode && (
          <Grip className="h-4 w-4 text-slate-400" />
        )}
      </div>

      <div className="space-y-1.5 text-xs">
        <div className="flex items-center gap-2 text-slate-700">
          <User className="h-3.5 w-3.5 text-slate-400" />
          <span className="truncate font-medium">
            {players[0] ??
              "No active player"}
          </span>
        </div>

        {players.slice(1).map((player) => (
          <div
            key={player}
            className="flex items-center gap-2 text-slate-700"
          >
            <User className="h-3.5 w-3.5 text-slate-400" />
            <span className="truncate font-medium">
              {player}
            </span>
          </div>
        ))}

        <div className="grid grid-cols-3 gap-1.5 pt-1.5">
          <div className="rounded-md bg-white/80 p-1.5">
            <Clock3 className="mb-1 h-3.5 w-3.5 text-slate-500" />
            <p className="font-mono text-[10px] font-bold text-slate-950">
              {elapsed}
            </p>
          </div>

          <div className="rounded-md bg-white/80 p-1.5">
            <Coffee className="mb-1 h-3.5 w-3.5 text-slate-500" />
            <p className="text-[10px] font-bold text-slate-950">
              Rs. {cafeAmount}
            </p>
          </div>

          <div className="rounded-md bg-white/80 p-1.5">
            <CircleDollarSign className="mb-1 h-3.5 w-3.5 text-slate-500" />
            <p className="text-[10px] font-bold text-slate-950">
              Rs. {currentBill}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default memo(FloorPlanTable);
