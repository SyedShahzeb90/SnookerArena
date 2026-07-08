import type { Table } from "@/types/table";

import { Card } from "@/components/ui/card";

import useCurrentTime from "@/features/dashboard/hooks/useCurrentTime";
import { useTableStore } from "@/store/tableStore";

import useBilling from "@/features/billing/hooks/useBilling";

import TableHeader from "./TableHeader";
import TableInfo from "./TableInfo";
import RunningPanel from "./RunningPanel";
import PendingPaymentPanel from "./PendingPaymentPanel";

type Props = {
  table: Table;
  onClick: () => void;
};

function formatDuration(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(hours).padStart(2, "0")}:${String(
    minutes
  ).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function TableCard({ table, onClick }: Props) {
  const now = useCurrentTime();

  const endSession = useTableStore(
    (state) => state.endSession
  );

  const { openBilling } = useBilling();

  return (
    <Card
      onClick={onClick}
      className="cursor-pointer p-6 transition-all hover:-translate-y-1 hover:shadow-lg"
    >
      <TableHeader table={table} />

      <div className="mt-6 space-y-4">
        <div>
          <p className="text-sm text-gray-500">
            Type
          </p>

          <p className="font-semibold capitalize">
            {table.type.replace("-", " ")}
          </p>
        </div>

        {table.session && (
          <>
            <TableInfo session={table.session} />

            {table.status === "running" && (
              <RunningPanel
                elapsed={formatDuration(
                  now.getTime() -
                    new Date(
                      table.session.startTime
                    ).getTime()
                )}
                onEndSession={() =>
                  endSession(table.id)
                }
              />
            )}

            {table.status ===
              "payment-pending" && (
              <PendingPaymentPanel
                onOpenBill={() =>
                  openBilling(
                    table.id,
                    table.session!
                  )
                }
              />
            )}
          </>
        )}
      </div>
    </Card>
  );
}

export default TableCard;