import { useState } from "react";

import TableCard from "./TableCard";
import StartSessionDialog from "./StartSessionDialog";

import { useTableStore } from "@/store/tableStore";
import type { Table } from "@/types/table";

function TableGrid() {
  const tables = useTableStore((state) => state.tables);

  const [selectedTable, setSelectedTable] =
    useState<Table | null>(null);

  const [dialogOpen, setDialogOpen] =
    useState(false);

  const handleTableClick = (table: Table) => {
    setSelectedTable(table);

    if (table.status === "available") {
      setDialogOpen(true);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {tables.map((table) => (
          <TableCard
            key={table.id}
            table={table}
            onClick={() => handleTableClick(table)}
          />
        ))}
      </div>

      <StartSessionDialog
        open={dialogOpen}
        table={selectedTable}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}

export default TableGrid;