import { DoorOpen, CircleDot } from "lucide-react";

import type { Table } from "@/types/table";

import TableStatusBadge from "./TableStatusBadge";

interface Props {
  table: Table;
}

function TableHeader({ table }: Props) {
  const Icon =
    table.type === "table"
      ? CircleDot
      : DoorOpen;

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
          <Icon className="h-5 w-5" />
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-950">
            {table.name}
          </h2>
          <p className="text-sm font-medium capitalize text-slate-500">
            {table.type.replace("-", " ")}
          </p>
        </div>
      </div>

      <TableStatusBadge status={table.status} />
    </div>
  );
}

export default TableHeader;
