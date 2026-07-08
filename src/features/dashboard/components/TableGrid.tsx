import { useState } from "react";

import TableCard from "./TableCard";
import StartSessionDialog from "./StartSessionDialog";

import BillingDialog from "@/features/billing/components/BillingDialog";

import { useTableStore } from "@/store/tableStore";

import type { PaymentMethod } from "@/types/session";
import type { Table } from "@/types/table";

function TableGrid() {
  const tables = useTableStore((state) => state.tables);

  const receivePayment = useTableStore(
    (state) => state.receivePayment
  );

  const [selectedTable, setSelectedTable] =
    useState<Table | null>(null);

  const [activeDialog, setActiveDialog] = useState<
    "start-session" | "billing" | null
  >(null);

  const handleTableClick = (table: Table) => {
    setSelectedTable(table);

    switch (table.status) {
      case "available":
        setActiveDialog("start-session");
        break;

      case "payment-pending":
        setActiveDialog("billing");
        break;

      default:
        break;
    }
  };

  const closeDialog = () => {
    setActiveDialog(null);
  };

  const handleReceivePayment = (
    paymentMethod: PaymentMethod
  ) => {
    if (!selectedTable) return;

    receivePayment({
      tableId: selectedTable.id,
      paymentMethod,
    });

    closeDialog();
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
        open={activeDialog === "start-session"}
        table={selectedTable}
        onOpenChange={(open) =>
          setActiveDialog(
            open ? "start-session" : null
          )
        }
      />

      {selectedTable?.session && (
        <BillingDialog
          open={activeDialog === "billing"}
          session={selectedTable.session}
          onClose={closeDialog}
          onReceivePayment={handleReceivePayment}
        />
      )}
    </>
  );
}

export default TableGrid;