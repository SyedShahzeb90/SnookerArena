import { useState } from "react";
import { History } from "lucide-react";

import type { Table } from "@/types/table";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import useCurrentTime from "@/features/dashboard/hooks/useCurrentTime";
import { useTableStore } from "@/store/tableStore";
import { getSessionPlayers } from "@/features/sessions/utils/sessionPlayers";
import type {
  TableChargeLineType,
} from "@/types/session";

import TableHeader from "./TableHeader";
import TableInfo from "./TableInfo";
import RunningPanel from "./RunningPanel";
import PendingPaymentPanel from "./PendingPaymentPanel";
import EditSessionDialog from "./EditSessionDialog";
import EndSessionDialog from "./EndSessionDialog";

type Props = {
  table: Table;
  onClick: () => void;
  onHistoryClick?: () => void;
  onCafeBillClick?: () => void;
  onAccessoriesClick?: () => void;
};

function formatDuration(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);

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

function getElapsedMilliseconds(
  table: Table,
  now: Date
) {
  if (!table.session) return 0;

  return (
    (
      table.session.pausedAt
        ? new Date(
            table.session.pausedAt
          ).getTime()
        : now.getTime()
    ) -
    new Date(
      table.session.startTime
    ).getTime() -
    table.session.totalPausedMilliseconds
  );
}

function TableCard({
  table,
  onClick,
  onHistoryClick,
  onCafeBillClick,
  onAccessoriesClick,
}: Props) {
  const now = useCurrentTime();

  const [editOpen, setEditOpen] =
    useState(false);
  const [endOpen, setEndOpen] =
    useState(false);
  const [addChargeOpen, setAddChargeOpen] =
    useState(false);
  const [
    chargeType,
    setChargeType,
  ] = useState<TableChargeLineType>("singleGame");
  const [payerName, setPayerName] =
    useState("");

  const endSession = useTableStore(
    (state) => state.endSession
  );

  const pauseSession = useTableStore(
    (state) => state.pauseSession
  );

  const resumeSession = useTableStore(
    (state) => state.resumeSession
  );
  const cancelSession = useTableStore(
    (state) => state.cancelSession
  );
  const addTableChargeLine =
    useTableStore(
      (state) => state.addTableChargeLine
    );

  const elapsedMilliseconds =
    getElapsedMilliseconds(table, now);
  const elapsed = table.session
    ? formatDuration(elapsedMilliseconds)
    : "00:00:00";
  const elapsedMinutes =
    elapsedMilliseconds / 60000;
  const runningTimeWarningClass =
    table.status === "running" &&
    elapsedMinutes >= 30
      ? "border-red-300 bg-red-50 shadow-red-100 hover:shadow-red-200"
      : table.status === "running" &&
          elapsedMinutes >= 25
        ? "border-amber-300 bg-amber-50 shadow-amber-100 hover:shadow-amber-200"
        : "border-slate-200 bg-white";
  const sessionPlayers = table.session
    ? getSessionPlayers(table.session)
    : [];
  const shouldChooseLoser =
    chargeType === "singleGame" &&
    sessionPlayers.length >= 2;
  const submitChargeLine = () => {
    if (!table.session) return;

    const selectedPayer =
      shouldChooseLoser
        ? payerName || sessionPlayers[0]
        : table.session.player1;

    addTableChargeLine({
      tableId: table.id,
      type:
        table.type === "private-room"
          ? "tableBooking"
          : chargeType,
      payerName: selectedPayer,
      loserName:
        chargeType === "singleGame"
          ? selectedPayer
          : undefined,
      winnerName:
        chargeType === "singleGame"
          ? sessionPlayers.find(
              (player) =>
                player !== selectedPayer
            )
          : undefined,
    });
    setAddChargeOpen(false);
    setChargeType("singleGame");
    setPayerName("");
  };

  return (
    <>
      <Card
        onClick={onClick}
        className={`min-h-[230px] cursor-pointer rounded-lg p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${runningTimeWarningClass}`}
      >
        <div className="flex items-start justify-between gap-3">
          <TableHeader table={table} />

          {onHistoryClick && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1 px-2 text-xs"
              onClick={(event) => {
                event.stopPropagation();
                onHistoryClick();
              }}
            >
              <History className="h-3.5 w-3.5" />
              History
            </Button>
          )}
        </div>

        <div className="mt-5 space-y-4">
          {table.session && (
            <>
              <TableInfo
                session={table.session}
                tableId={table.id}
                tableType={table.type}
                now={now}
                onCafeBillClick={
                  onCafeBillClick
                }
                onAccessoriesClick={
                  onAccessoriesClick
                }
              />

              {(table.status ===
                "running" ||
                table.status ===
                  "paused") && (
                <RunningPanel
                  elapsed={elapsed}
                  isPaused={
                    table.status ===
                    "paused"
                  }
                  onPause={() => {
                    if (
                      table.status ===
                      "running"
                    ) {
                      pauseSession(
                        table.id
                      );
                    } else {
                      resumeSession(
                        table.id
                      );
                    }
                  }}
                  onAddCharge={() => {
                    setChargeType(
                      table.type === "private-room"
                        ? "tableBooking"
                        : "singleGame"
                    );
                    setPayerName(
                      sessionPlayers[0] ?? ""
                    );
                    setAddChargeOpen(true);
                  }}
                  onEdit={() =>
                    setEditOpen(true)
                  }
                  onCancelSession={() => {
                    const confirmed =
                      window.confirm(
                        `Cancel the running session on ${table.name}? This will remove the mistaken start and no bill will be created.`
                      );

                    if (confirmed) {
                      cancelSession(table.id);
                    }
                  }}
                  onEndSession={() =>
                    setEndOpen(true)
                  }
                />
              )}

              {table.status ===
                "payment-pending" && (
                <PendingPaymentPanel
                  onOpenBill={onClick}
                />
              )}
            </>
          )}

          {!table.session && (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
              <p className="text-sm font-medium text-slate-500">
                Ready for a new session
              </p>

              <p className="mt-1 text-sm text-slate-400">
                Click to start play
              </p>
            </div>
          )}
        </div>
      </Card>

      <EditSessionDialog
        open={editOpen}
        table={table}
        onOpenChange={setEditOpen}
      />

      {table.session && (
        <EndSessionDialog
          open={endOpen}
          table={table}
          onOpenChange={setEndOpen}
          onConfirm={(result) => {
            endSession({
              tableId: table.id,
              ...result,
            });
            setEndOpen(false);
          }}
        />
      )}

      {table.session && (
        <Dialog
          open={addChargeOpen}
          onOpenChange={setAddChargeOpen}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                Add Game / Time
              </DialogTitle>
            </DialogHeader>

            <div className="grid gap-4">
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                What do you want to add?
                <select
                  className="rounded-md border bg-white p-2"
                  value={
                    table.type === "private-room"
                      ? "tableBooking"
                      : chargeType
                  }
                  onChange={(event) =>
                    setChargeType(
                      event.target
                        .value as TableChargeLineType
                    )
                  }
                  disabled={
                    table.type === "private-room"
                  }
                >
                  <option value="singleGame">
                    Single Game - Rs. 300
                  </option>
                  <option value="doubleGame">
                    Double Game - Rs. 600
                  </option>
                  <option value="tableBooking">
                    Table Booking / Time
                  </option>
                </select>
              </label>

              {shouldChooseLoser && (
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  Who lost?
                  <select
                    className="rounded-md border bg-white p-2"
                    value={
                      payerName ||
                      sessionPlayers[0] ||
                      ""
                    }
                    onChange={(event) =>
                      setPayerName(
                        event.target.value
                      )
                    }
                  >
                    {sessionPlayers.map((player) => (
                      <option
                        key={player}
                        value={player}
                      >
                        {player} lost
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {chargeType === "tableBooking" && (
                <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                  Time charge starts now and finalizes
                  when the session ends or another
                  charge is added.
                </p>
              )}

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    setAddChargeOpen(false)
                  }
                >
                  Cancel
                </Button>
                <Button onClick={submitChargeLine}>
                  Add Charge
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

export default TableCard;
