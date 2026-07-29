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
import { useClubSettingsStore } from "@/features/settings/store/clubSettingsStore";

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
  const frameWarningMinutes = useClubSettingsStore(
    (state) => state.settings.frameWarningMinutes
  );
  const frameDangerMinutes = useClubSettingsStore(
    (state) => state.settings.frameDangerMinutes
  );
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

    const lines = table.session.tableChargeLines ?? [];
    const gameAmount = lines.length > 0
      ? lines.reduce((total, line) => {
          if (line.type !== "tableBooking" || line.endedAt) {
            return total + line.amount;
          }
          const endTime = table.session?.pausedAt
            ? new Date(table.session.pausedAt)
            : now;
          const minutes = Math.max(
            1,
            Math.ceil(
              (endTime.getTime() - new Date(line.startedAt).getTime()) /
                60000
            )
          );
          const rate = line.unitRate ?? (table.type === "private-room" ? 25 : 20);
          return total + minutes * rate;
        }, 0)
      : pricing.gameAmount;

    return calculateBill({
      gameAmount,
      cafeAmount,
      discount: table.session.discount,
    }).total;
  }, [table, cafeAmount, now]);

  const status = statusStyles[table.status];
  const currentChargeLine =
    table.session?.tableChargeLines?.at(-1);
  const currentFrameType =
    currentChargeLine?.type ??
    (table.session?.sessionType === "single"
      ? "singleGame"
      : table.session?.sessionType === "double"
        ? "doubleGame"
        : "tableBooking");
  const usesFrameWarning =
    table.type === "table" &&
    table.id >= 1 &&
    table.id <= 7 &&
    (currentFrameType === "singleGame" ||
      currentFrameType === "doubleGame");
  const frameStartedAt = table.session
    ? new Date(
        table.session.frameTimerStartedAt ??
          currentChargeLine?.startedAt ??
          table.session.startTime
      ).getTime()
    : now.getTime();
  const framePausedMilliseconds = table.session
    ? table.session.totalPausedMilliseconds -
      (table.session.frameTimerPausedMilliseconds ??
        table.session.totalPausedMilliseconds)
    : 0;
  const frameCurrentTime = table.session?.pausedAt
    ? new Date(table.session.pausedAt).getTime()
    : now.getTime();
  const frameElapsedMinutes = Math.max(
    0,
    frameCurrentTime - frameStartedAt - framePausedMilliseconds
  ) / 60000;
  const timeWarningStyle =
    table.status === "running" &&
    usesFrameWarning &&
    frameElapsedMinutes >= frameDangerMinutes
      ? {
          border: "border-red-300",
          card: "bg-red-50",
        }
      : table.status === "running" &&
          usesFrameWarning &&
          frameElapsedMinutes >= frameWarningMinutes
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
      onKeyDown={(event) => {
        if (
          editMode ||
          (event.key !== "Enter" && event.key !== " ")
        ) {
          return;
        }

        event.preventDefault();
        onClick();
      }}
      onPointerDown={
        editMode ? onPointerDown : undefined
      }
      role={editMode ? undefined : "button"}
      tabIndex={editMode ? -1 : 0}
      aria-label={`${table.name}, ${status.label}`}
      className={`absolute w-[clamp(135px,14vw,185px)] select-none rounded-lg p-3 shadow-sm transition-[box-shadow,filter,background-color,border-color] duration-200 ${timeWarningStyle.border} ${timeWarningStyle.card} ${
        editMode
          ? "cursor-grab active:cursor-grabbing"
          : "cursor-pointer hover:brightness-[0.98] hover:shadow-xl active:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
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
