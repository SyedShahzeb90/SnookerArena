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
import { getSessionPlayers } from "@/features/sessions/utils/sessionPlayers";

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

  const runCafeAction = (action: () => void) => {
    try {
      action();
      return true;
    } catch (caught) {
      window.alert(caught instanceof Error ? caught.message : "The Cafe action could not be completed.");
      return false;
    }
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
                    {getSessionPlayers(
                      table.session
                    ).map((player) => (
                      <Button
                        key={player}
                        onClick={() => {
                          addPlayerOrder(
                            table.id,
                            table
                              .session!
                              .id,
                            player
                          );

                          setSelectedPlayer(
                            player
                          );

                          setSelectedWaitingCustomer("");

                          setStep(
                            "menu"
                          );
                        }}
                      >
                        {player}
                      </Button>
                    ))}
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
        runCafeAction(() => {
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
        });
      }}
      onIncrease={(menuItemId) => {
        runCafeAction(() => {
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
        });
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

        const saved = runCafeAction(() => saveOrder(
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
        ));

        if (!saved) return;

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
