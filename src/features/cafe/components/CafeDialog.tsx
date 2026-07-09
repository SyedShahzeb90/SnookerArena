import {
  useEffect,
  useState,
} from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";

import { useCafeStore } from "../store/cafeStore";
import { useTableStore } from "@/store/tableStore";

import WaitingCustomerDialog from "./WaitingCustomerDialog";
import MenuGrid from "./MenuGrid";

function CafeDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const tables = useTableStore(
    (state) => state.tables
  );
  const updateSessionCafe =
    useTableStore(
      (state) => state.updateSessionCafe
    );

  const {
    menu,
    waitingCustomers,
    playerOrders,
    addWaitingCustomer,
    addPlayerOrder,
    addItemToPlayer,
    addItemToWaitingCustomer,
    increasePlayerItem,
    decreasePlayerItem,
    increaseWaitingItem,
    decreaseWaitingItem,
    saveOrder,
    getTableOrderItems,
  } = useCafeStore();

  const [
    waitingDialogOpen,
    setWaitingDialogOpen,
  ] = useState(false);

  const [
    selectedTable,
    setSelectedTable,
  ] = useState<number>();

  const [
    selectedPlayer,
    setSelectedPlayer,
  ] = useState("");

  const [
    selectedWaitingCustomer,
    setSelectedWaitingCustomer,
  ] = useState("");

  const [step, setStep] =
    useState<
      "home" | "players" | "menu"
    >("home");

  const reset = () => {
    setStep("home");
    setSelectedTable(undefined);
    setSelectedPlayer("");
    setSelectedWaitingCustomer("");
  };

  const currentPlayerOrder =
    playerOrders.find(
      (p) =>
        p.tableId === selectedTable &&
        p.playerName ===
          selectedPlayer
    );

  const currentWaitingCustomer =
    waitingCustomers.find(
      (c) =>
        c.id ===
        selectedWaitingCustomer
    );

  useEffect(() => {
    useTableStore
      .getState()
      .tables.forEach((table) => {
      if (!table.session) return;

      updateSessionCafe({
        tableId: table.id,
        cafeOrders:
          getTableOrderItems(table.id),
      });
    });
  }, [
    playerOrders,
    getTableOrderItems,
    updateSessionCafe,
  ]);

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          onOpenChange(value);

          if (!value) {
            reset();
          }
        }}
      >
        <DialogContent
  className="
    h-[95vh]
    w-[95vw]
    max-w-[95vw]
    overflow-hidden
    p-0
  "
>
          <DialogHeader>
            <DialogTitle>
              Cafe POS
            </DialogTitle>
          </DialogHeader>

          {step === "home" && (
            <div className="space-y-8">
              <div>
                <h2 className="mb-4 text-xl font-bold">
                  Tables
                </h2>

                <div className="grid grid-cols-3 gap-3">
                  {tables.map((table) => (
                    <Button
                      key={table.id}
                      variant="outline"
                      disabled={
                        !table.session
                      }
                      onClick={() => {
                        setSelectedTable(
                          table.id
                        );

                        setStep(
                          "players"
                        );
                      }}
                    >
                      {table.name}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="mb-4 text-xl font-bold">
                  Waiting Customers
                </h2>

                <div className="grid grid-cols-3 gap-3">
                  {waitingCustomers.map(
                    (customer) => (
                      <Button
                        key={
                          customer.id
                        }
                        variant="outline"
                        onClick={() => {
                          setSelectedWaitingCustomer(
                            customer.id
                          );

                          setSelectedPlayer("");

                          setStep(
                            "menu"
                          );
                        }}
                      >
                        {
                          customer.name
                        }
                      </Button>
                    )
                  )}

                  <Button
                    onClick={() =>
                      setWaitingDialogOpen(
                        true
                      )
                    }
                  >
                    + New Waiting Customer
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step === "players" &&
            (() => {
              const table =
                tables.find(
                  (t) =>
                    t.id ===
                    selectedTable
                );

              if (
                !table?.session
              )
                return null;

              return (
                <div className="space-y-6">
                  <Button
                    variant="outline"
                    onClick={() =>
                      setStep(
                        "home"
                      )
                    }
                  >
                    ← Back
                  </Button>

                  <h2 className="text-xl font-bold">
                    Select Player
                  </h2>

                  <div className="grid grid-cols-2 gap-4">
                    <Button
                      onClick={() => {
                        addPlayerOrder(
                          table.id,
                          table
                            .session!
                            .id,
                          table
                            .session!
                            .player1
                        );

                        setSelectedPlayer(
                          table
                            .session!
                            .player1
                        );

                        setSelectedWaitingCustomer("");

                        setStep(
                          "menu"
                        );
                      }}
                    >
                      {
                        table
                          .session
                          .player1
                      }
                    </Button>

                    {table.session
                      .player2 && (
                      <Button
                        onClick={() => {
                          addPlayerOrder(
                            table.id,
                            table
                              .session!
                              .id,
                            table
                              .session!
                              .player2!
                          );

                          setSelectedPlayer(
                            table
                              .session!
                              .player2!
                          );

                          setSelectedWaitingCustomer("");

                          setStep(
                            "menu"
                          );
                        }}
                      >
                        {
                          table
                            .session
                            .player2
                        }
                      </Button>
                    )}
                  </div>
                </div>
              );
            })()}{step === "menu" && (
  <div className="space-y-6">
    <Button
      variant="outline"
      onClick={() => {
        if (selectedPlayer) {
          setStep("players");
        } else {
          setStep("home");
        }
      }}
    >
      ← Back
    </Button>

    <MenuGrid
      menu={menu}
      customerName={
        selectedPlayer ||
        currentWaitingCustomer?.name ||
        "Customer"
      }
      cart={
        selectedPlayer
          ? currentPlayerOrder
              ?.orderItems ?? []
          : currentWaitingCustomer
              ?.orderItems ?? []
      }
      onAdd={(item) => {
        if (
          selectedPlayer &&
          selectedTable
        ) {
          addItemToPlayer(
            selectedTable,
            tables.find(
              (table) =>
                table.id ===
                selectedTable
            )?.session?.id ?? "",
            selectedPlayer,
            item
          );
        } else if (
          selectedWaitingCustomer
        ) {
          addItemToWaitingCustomer(
            selectedWaitingCustomer,
            item
          );
        }
      }}
      onIncrease={(menuItemId) => {
        if (
          selectedPlayer &&
          selectedTable
        ) {
          increasePlayerItem(
            selectedTable,
            selectedPlayer,
            menuItemId
          );
        } else if (
          selectedWaitingCustomer
        ) {
          increaseWaitingItem(
            selectedWaitingCustomer,
            menuItemId
          );
        }
      }}
      onDecrease={(menuItemId) => {
        if (
          selectedPlayer &&
          selectedTable
        ) {
          decreasePlayerItem(
            selectedTable,
            selectedPlayer,
            menuItemId
          );
        } else if (
          selectedWaitingCustomer
        ) {
          decreaseWaitingItem(
            selectedWaitingCustomer,
            menuItemId
          );
        }
      }}
      onSave={() => {
        const selectedTableRecord =
          tables.find(
            (table) =>
              table.id === selectedTable
          );
        const orderItems =
          selectedPlayer &&
          selectedTable
            ? getTableOrderItems(
                selectedTable
              )
            : currentWaitingCustomer
                ?.orderItems ?? [];

        saveOrder(
          {
            tableId:
              selectedTableRecord?.id,
            tableName:
              selectedTableRecord?.name,
            sessionId:
              selectedTableRecord
                ?.session?.id,
            customerName:
              selectedPlayer ||
              currentWaitingCustomer?.name ||
              "Customer",
            orderItems,
          }
        );

        onOpenChange(false);

        reset();
      }}
    />
  </div>
)}
        </DialogContent>
      </Dialog>

      <WaitingCustomerDialog
        open={waitingDialogOpen}
        onOpenChange={
          setWaitingDialogOpen
        }
        onContinue={(name) => {
          const id =
            addWaitingCustomer(
              name
            );

          setSelectedWaitingCustomer(
            id
          );

          setSelectedPlayer("");

          setStep("menu");
        }}
      />
    </>
  );
}

export default CafeDialog;
