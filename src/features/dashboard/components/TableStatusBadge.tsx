import { Badge } from "@/components/ui/badge";
import type { TableStatus } from "@/types/table";

interface Props {
  status: TableStatus;
}

function TableStatusBadge({ status }: Props) {
  const styles: Record<TableStatus, string> = {
    available:
      "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50",
    running:
      "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50",
    paused:
      "bg-amber-50 text-amber-700 ring-1 ring-amber-200 hover:bg-amber-50",
    "payment-pending":
      "bg-amber-50 text-amber-700 ring-1 ring-amber-200 hover:bg-amber-50",
    reserved:
      "bg-blue-50 text-blue-700 ring-1 ring-blue-200 hover:bg-blue-50",
    maintenance:
      "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-100",
  };

  const labels: Record<TableStatus, string> = {
    available: "Available",
    running: "Running",
    paused: "Paused",
    "payment-pending": "Payment Due",
    reserved: "Reserved",
    maintenance: "Maintenance",
  };

  return (
    <Badge className={styles[status]}>
      {labels[status]}
    </Badge>
  );
}

export default TableStatusBadge;
