import { useState } from "react";

import type { Table } from "@/types/table";

import { Card } from "@/components/ui/card";

import useCurrentTime from "@/features/dashboard/hooks/useCurrentTime";
import { useTableStore } from "@/store/tableStore";

import TableHeader from "./TableHeader";
import TableInfo from "./TableInfo";
import RunningPanel from "./RunningPanel";
import PendingPaymentPanel from "./PendingPaymentPanel";
import EditSessionDialog from "./EditSessionDialog";
import EndSessionDialog from "./EndSessionDialog";

type Props = {
  table: Table;
  onClick: () => void;
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

function TableCard({
  table,
  onClick,
}: Props) {
  const now = useCurrentTime();

  const [editOpen, setEditOpen] =
    useState(false);
  const [endOpen, setEndOpen] =
    useState(false);

  const endSession = useTableStore(
    (state) => state.endSession
  );

  const pauseSession = useTableStore(
    (state) => state.pauseSession
  );

  const resumeSession = useTableStore(
    (state) => state.resumeSession
  );

  const elapsed = table.session
    ? formatDuration(
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
          table.session
            .totalPausedMilliseconds
      )
    : "00:00:00";

  return (
    <>
      <Card
        onClick={onClick}
        className="min-h-[230px] cursor-pointer rounded-lg border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
      >
        <TableHeader table={table} />

        <div className="mt-5 space-y-4">
          {table.session && (
            <>
              <TableInfo
                session={table.session}
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
                  onEdit={() =>
                    setEditOpen(true)
                  }
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
    </>
  );
}

export default TableCard;
