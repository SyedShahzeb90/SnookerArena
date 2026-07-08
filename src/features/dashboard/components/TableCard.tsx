import type { Table } from "@/types/table";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Props = {
  table: Table;
  onClick: () => void;
};

function TableCard({ table, onClick }: Props) {
  const getBadge = () => {
    switch (table.status) {
      case "available":
        return <Badge className="bg-green-600">Available</Badge>;

      case "running":
        return <Badge variant="destructive">Running</Badge>;

      case "payment-pending":
        return <Badge className="bg-yellow-500">Payment Pending</Badge>;

      default:
        return <Badge>{table.status}</Badge>;
    }
  };

  return (
    <Card
      onClick={onClick}
      className="cursor-pointer transition hover:shadow-xl p-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">
          {table.type === "table" ? "🎱" : "🚪"} {table.name}
        </h2>

        {getBadge()}
      </div>

      <div className="mt-6 space-y-2">

        <div>
          <span className="text-sm text-gray-500">
            Type
          </span>

          <p className="font-semibold capitalize">
            {table.type.replace("-", " ")}
          </p>
        </div>

        {table.players && table.players.length > 0 && (
          <div>
            <span className="text-sm text-gray-500">
              Players
            </span>

            <p>{table.players.join(", ")}</p>
          </div>
        )}

        {table.sessionId && (
          <div>
            <span className="text-sm text-gray-500">
              Session
            </span>

            <p>{table.sessionId}</p>
          </div>
        )}

      </div>
    </Card>
  );
}

export default TableCard;