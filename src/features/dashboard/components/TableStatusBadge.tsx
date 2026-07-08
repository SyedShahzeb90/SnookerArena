import { Badge } from "@/components/ui/badge";
import type { TableStatus } from "@/types/table";

interface Props {
  status: TableStatus;
}

function TableStatusBadge({ status }: Props) {
  switch (status) {
    case "available":
      return (
        <Badge className="bg-green-600">
          Available
        </Badge>
      );

    case "running":
      return (
        <Badge variant="destructive">
          Running
        </Badge>
      );

    case "payment-pending":
      return (
        <Badge className="bg-yellow-500 text-black">
          Payment Pending
        </Badge>
      );

    case "reserved":
      return (
        <Badge className="bg-blue-600">
          Reserved
        </Badge>
      );

    case "maintenance":
      return (
        <Badge variant="secondary">
          Maintenance
        </Badge>
      );

    default:
      return <Badge>{status}</Badge>;
  }
}

export default TableStatusBadge;