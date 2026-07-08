import type { Table } from "@/types/table";
import TableStatusBadge from "./TableStatusBadge";

interface Props {
  table: Table;
}

function TableHeader({ table }: Props) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-xl font-bold">
        {table.type === "table" ? "🎱" : "🚪"} {table.name}
      </h2>

      <TableStatusBadge status={table.status} />
    </div>
  );
}

export default TableHeader;