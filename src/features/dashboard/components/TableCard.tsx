import type { Table } from "@/types/table";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import useCurrentTime from "@/hooks/useCurrentTime";
import { useTableStore } from "@/store/tableStore";

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

  const getBadge = () => {
    switch (table.status) {
      case "available":
        return <Badge className="bg-green-600">Available</Badge>;

      case "running":
        return <Badge variant="destructive">Running</Badge>;

      case "payment-pending":
        return (
          <Badge className="bg-yellow-500">
            Payment Pending
          </Badge>
        );

      default:
        return <Badge>{table.status}</Badge>;
    }
  };

  return (
    <Card
      onClick={onClick}
      className="cursor-pointer p-6 transition-all hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">
          {table.type === "table" ? "🎱" : "🚪"} {table.name}
        </h2>

        {getBadge()}
      </div>

      <div className="mt-6 space-y-4">
        <div>
          <p className="text-sm text-gray-500">Type</p>

          <p className="font-semibold capitalize">
            {table.type.replace("-", " ")}
          </p>
        </div>

        {table.session && (
          <>
            <div>
              <p className="text-sm text-gray-500">Players</p>

              <p className="font-semibold">
                {table.session.player1 || "-"}
              </p>

              {table.session.player2 && (
                <p className="font-semibold">
                  {table.session.player2}
                </p>
              )}
            </div>

            <div>
              <p className="text-sm text-gray-500">
                Session Type
              </p>

              <p className="font-semibold capitalize">
                {table.session.sessionType}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">
                Started
              </p>

              <p className="font-semibold">
                {new Date(
                  table.session.startTime
                ).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>

            {table.status === "running" && (
              <>
                <div>
                  <p className="text-sm text-gray-500">
                    Elapsed
                  </p>

                  <p className="text-xl font-bold text-red-600">
                    {formatDuration(
                      now.getTime() -
                        new Date(
                          table.session.startTime
                        ).getTime()
                    )}
                  </p>
                </div>

                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    endSession(table.id);
                  }}
                >
                  End Session
                </Button>
              </>
            )}

            {table.status === "payment-pending" && (
              <div className="rounded-md bg-yellow-100 p-3 text-center text-sm font-semibold text-yellow-800">
                Waiting for Payment
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

export default TableCard;