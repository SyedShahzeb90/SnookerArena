import { useState } from "react";
import TableCard from "./TableCard";
import { useTableStore } from "@/store/tableStore";
import type { Table } from "@/types/table";

function TableGrid() {
  const tables = useTableStore((state) => state.tables);

  const [selectedTable, setSelectedTable] =
    useState<Table | null>(null);

  return (
    <>
      <div className="grid grid-cols-3 gap-6">
        {tables.map((table) => (
          <TableCard
            key={table.id}
            table={table}
            onClick={() => setSelectedTable(table)}
          />
        ))}
      </div>

      {selectedTable && (
        <div className="fixed bottom-5 right-5 rounded-lg bg-slate-900 p-4 text-white shadow-lg">
          Selected: <strong>{selectedTable.name}</strong>
        </div>
      )}
    </>
  );
}

export default TableGrid;