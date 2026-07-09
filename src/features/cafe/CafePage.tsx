import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { useTableStore } from "@/store/tableStore";
import { useCafeStore } from "./store/cafeStore";

import MenuPanel from "./components/MenuPanel";
import OrderCart from "./components/OrderCart";

type SelectedTarget =
  | {
      type: "player";
      tableId: number;
      sessionId: string;
      playerName: string;
    }
  | {
      type: "waiting";
      customerId: string;
    }
  | null;

function CafePage() {
  const navigate = useNavigate();
  const tables = useTableStore(
    (state) => state.tables
  );
  const updateSessionCafe =
    useTableStore(
      (state) => state.updateSessionCafe
    );

  const {
    waitingCustomers,
    addWaitingCustomer,
    getPlayerOrder,
    getWaitingCustomerOrder,
    increasePlayerItem,
    decreasePlayerItem,
    increaseWaitingItem,
    decreaseWaitingItem,
    saveOrder,
    playerOrders,
    getTableOrderItems,
  } = useCafeStore();

  const [search, setSearch] = useState("");
  const [selectedTarget, setSelectedTarget] =
    useState<SelectedTarget>(null);
  const [expandedTable, setExpandedTable] =
    useState<number | null>(null);

  const runningTables = useMemo(() => {
    const query = search.toLowerCase();

    return tables.filter((table) => {
      if (!table.session) return false;

      return (
        table.name
          .toLowerCase()
          .includes(query) ||
        table.session.player1
          .toLowerCase()
          .includes(query) ||
        table.session.player2
          ?.toLowerCase()
          .includes(query)
      );
    });
  }, [tables, search]);

  const filteredWaiting =
    waitingCustomers.filter((customer) =>
      customer.name
        .toLowerCase()
        .includes(search.toLowerCase())
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

  const selectedOrder =
    selectedTarget?.type === "player"
      ? getPlayerOrder(
          selectedTarget.tableId,
          selectedTarget.playerName
        )
      : selectedTarget?.type === "waiting"
        ? getWaitingCustomerOrder(
            selectedTarget.customerId
          )
        : undefined;

  const selectedCustomerName =
    selectedTarget?.type === "player"
      ? selectedTarget.playerName
      : selectedTarget?.type === "waiting"
        ? getWaitingCustomerOrder(
            selectedTarget.customerId
          )?.name ?? ""
        : "";

  const selectedCustomerMeta =
    selectedTarget?.type === "player"
      ? `Table ${selectedTarget.tableId}`
      : "Waiting Customer";

  const handleIncrease = (
    menuItemId: string
  ) => {
    if (!selectedTarget) return;

    if (selectedTarget.type === "player") {
      increasePlayerItem(
        selectedTarget.tableId,
        selectedTarget.playerName,
        menuItemId
      );
      return;
    }

    increaseWaitingItem(
      selectedTarget.customerId,
      menuItemId
    );
  };

  const handleDecrease = (
    menuItemId: string
  ) => {
    if (!selectedTarget) return;

    if (selectedTarget.type === "player") {
      decreasePlayerItem(
        selectedTarget.tableId,
        selectedTarget.playerName,
        menuItemId
      );
      return;
    }

    decreaseWaitingItem(
      selectedTarget.customerId,
      menuItemId
    );
  };

  const handleAddWaitingCustomer = () => {
    const name = prompt("Customer name");

    if (!name?.trim()) return;

    const customerId = addWaitingCustomer(
      name.trim()
    );

    setSelectedTarget({
      type: "waiting",
      customerId,
    });
  };

  return (
    <main className="h-screen bg-slate-100 p-4">
      <div className="mx-auto flex h-full max-w-[1800px] flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <header className="flex items-center justify-between border-b px-8 py-5">
          <div>
            <h1 className="text-3xl font-bold">
              Cafe POS
            </h1>
            <p className="text-gray-500">
              Snooker Arena Management System
            </p>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="font-semibold">
                {new Date().toLocaleDateString()}
              </p>
              <p className="text-sm text-gray-500">
                {new Date().toLocaleTimeString()}
              </p>
            </div>

            <Button
              variant="outline"
              onClick={() => navigate("/")}
            >
              Back to Dashboard
            </Button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-12 overflow-hidden">
          <aside className="col-span-3 flex min-h-0 flex-col border-r bg-slate-50">
            <div className="border-b p-5">
              <h2 className="text-2xl font-bold">
                Customers
              </h2>

              <Input
                className="mt-4"
                placeholder="Search..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <p className="mb-3 text-sm font-bold uppercase text-gray-500">
                Running Tables
              </p>

              <div className="space-y-3">
                {runningTables.map((table) => (
                  <div
                    key={table.id}
                    className="rounded-xl border bg-white"
                  >
                    <button
                      className="flex w-full items-center justify-between p-4 text-left"
                      onClick={() =>
                        setExpandedTable(
                          expandedTable === table.id
                            ? null
                            : table.id
                        )
                      }
                    >
                      <div>
                        <p className="font-bold">
                          {table.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          Running
                        </p>
                      </div>

                      <span className="text-sm text-gray-500">
                        {expandedTable === table.id
                          ? "Open"
                          : "Select"}
                      </span>
                    </button>

                    {expandedTable === table.id && (
                      <div className="space-y-2 border-t p-3">
                        <Button
                          variant={
                            selectedTarget?.type ===
                              "player" &&
                            selectedTarget.tableId ===
                              table.id &&
                            selectedTarget.playerName ===
                              table.session?.player1
                              ? "default"
                              : "secondary"
                          }
                          className="w-full justify-start"
                          onClick={() =>
                            setSelectedTarget({
                              type: "player",
                              tableId: table.id,
                              sessionId:
                                table.session!.id,
                              playerName:
                                table.session!.player1,
                            })
                          }
                        >
                          {table.session?.player1}
                        </Button>

                        {table.session?.player2 && (
                          <Button
                            variant={
                              selectedTarget?.type ===
                                "player" &&
                              selectedTarget.tableId ===
                                table.id &&
                              selectedTarget.playerName ===
                                table.session?.player2
                                ? "default"
                                : "secondary"
                            }
                            className="w-full justify-start"
                            onClick={() =>
                              setSelectedTarget({
                                type: "player",
                                tableId: table.id,
                                sessionId:
                                  table.session!.id,
                                playerName:
                                  table.session!.player2!,
                              })
                            }
                          >
                            {table.session?.player2}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <p className="mb-3 mt-8 text-sm font-bold uppercase text-gray-500">
                Waiting Customers
              </p>

              <div className="space-y-2">
                {filteredWaiting.map((customer) => (
                  <Button
                    key={customer.id}
                    variant={
                      selectedTarget?.type ===
                        "waiting" &&
                      selectedTarget.customerId ===
                        customer.id
                        ? "default"
                        : "secondary"
                    }
                    className="w-full justify-start"
                    onClick={() =>
                      setSelectedTarget({
                        type: "waiting",
                        customerId: customer.id,
                      })
                    }
                  >
                    {customer.name}
                  </Button>
                ))}

                <Button
                  className="w-full bg-green-600 hover:bg-green-700"
                  onClick={
                    handleAddWaitingCustomer
                  }
                >
                  New Waiting Customer
                </Button>
              </div>
            </div>
          </aside>

          <section className="col-span-6 min-h-0 border-r p-6">
            <MenuPanel
              disabled={!selectedTarget}
              selectedTarget={selectedTarget}
            />
          </section>

          <aside className="col-span-3 min-h-0 bg-slate-50 p-6">
            {!selectedTarget ? (
              <div className="flex h-full flex-col">
                <h2 className="text-2xl font-bold">
                  Current Order
                </h2>

                <div className="flex flex-1 items-center justify-center">
                  <div className="text-center">
                    <div className="text-5xl">
                      Cart
                    </div>
                    <h3 className="mt-5 text-xl font-bold">
                      No Customer Selected
                    </h3>
                    <p className="mt-2 text-gray-500">
                      Select a player or waiting
                      customer to begin taking an
                      order.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <OrderCart
                customerName={
                  selectedCustomerName
                }
                customerMeta={
                  selectedCustomerMeta
                }
                items={
                  selectedOrder?.orderItems ?? []
                }
                onIncrease={handleIncrease}
                onDecrease={handleDecrease}
                onSave={() =>
                  saveOrder(selectedCustomerName)
                }
              />
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}

export default CafePage;
