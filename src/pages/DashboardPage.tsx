import { useState } from "react";
import TableCard from "../components/TableCard";
import StartSessionDialog from "../components/StartSessionDialog";
import { initialTables } from "../data/initialTables";
import type { Table } from "../types/table";

function DashboardPage() {
  const [tables, setTables] = useState(initialTables);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);

  const updateTableStatus = (
    status: "single-game" | "double-game" | "time-booking"
  ) => {
    if (!selectedTable) return;

    const updatedTables = tables.map((table) =>
      table.id === selectedTable.id
        ? {
            ...table,
            status,
          }
        : table
    );

    setTables(updatedTables);
    setSelectedTable(null);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-4xl font-bold text-center">
        CueDesk
      </h1>

      <h3 className="mt-2 text-center text-gray-600">
        Snooker Club Management System
      </h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "20px",
          marginTop: "30px",
        }}
      >
        {tables.map((table) => (
          <TableCard
            key={table.id}
            table={table}
            onClick={() => setSelectedTable(table)}
          />
        ))}
      </div>

      {selectedTable && (
        <StartSessionDialog
          table={selectedTable}
          onClose={() => setSelectedTable(null)}
          onStartSingle={() => updateTableStatus("single-game")}
          onStartDouble={() => updateTableStatus("double-game")}
          onStartTime={() => updateTableStatus("time-booking")}
        />
      )}
    </div>
  );
}

export default DashboardPage;