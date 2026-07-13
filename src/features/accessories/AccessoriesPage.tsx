import { PackagePlus } from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { PaymentMethod } from "@/types/session";
import { useBusinessDayStore } from "@/features/business-day/store/businessDayStore";
import { useCustomerAccountStore } from "@/features/customers/store/customerAccountStore";
import {
  getBillPrimaryLabel,
  getBillCustomerLabel,
  getBillSearchText,
  getBillSecondaryLabel,
  getBillTableLabel,
} from "@/features/customers/utils/billDisplay";
import { useSalesStore } from "@/features/sales/store/salesStore";
import { getSessionPlayers } from "@/features/sessions/utils/sessionPlayers";
import { getWalkInDisplayName } from "@/features/sessions/utils/walkInLabel";
import { useTableStore } from "@/store/tableStore";
import type { Session } from "@/types/session";
import {
  type AccessoryItem,
  useAccessoriesStore,
} from "./store/accessoriesStore";

type CartItem = AccessoryItem & {
  quantity: number;
};

type SelectedTarget =
  | {
      type: "table";
      tableId: number;
      tableName: string;
      sessionId: string;
      customerName: string;
      customerId?: string;
    }
  | {
      type: "bill";
      customerId: string;
      customerName: string;
      customerToken: string;
    }
  | null;

const categories = [
  "All",
  "Tips",
  "Sticks",
  "Gloves",
  "Chalk",
  "Other",
] as const;

const accessoryPrefix = "[Accessory]";

function getSourceOrderId(
  target: SelectedTarget
) {
  if (!target) return "";

  return target.type === "table"
    ? `ACCESSORIES-TABLE-${target.tableId}-${target.sessionId}-${target.customerId ?? target.customerName}`
    : `ACCESSORIES-BILL-${target.customerId}`;
}

function cleanAccessoryName(name: string) {
  return name.startsWith(accessoryPrefix)
    ? name.replace(accessoryPrefix, "").trim()
    : name;
}

function getPlayerCustomerId(
  session: Session,
  playerName: string
) {
  const players = [
    {
      name: session.player1,
      customerId: session.player1CustomerId,
    },
    {
      name: session.player2,
      customerId: session.player2CustomerId,
    },
    {
      name: session.player3,
      customerId: session.player3CustomerId,
    },
    {
      name: session.player4,
      customerId: session.player4CustomerId,
    },
  ];

  return players.find(
    (player) =>
      player.name?.trim() === playerName
  )?.customerId;
}

function AccessoriesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const items = useAccessoriesStore(
    (state) => state.items
  );
  const addItem = useAccessoriesStore(
    (state) => state.addItem
  );
  const tables = useTableStore(
    (state) => state.tables
  );
  const updateSessionCafe =
    useTableStore(
      (state) => state.updateSessionCafe
    );
  const customerAccounts =
    useCustomerAccountStore(
      (state) => state.accounts
    );
  const replaceAccessoryChargesForOrder =
    useCustomerAccountStore(
      (state) =>
        state.replaceAccessoryChargesForOrder
    );
  const updateItem = useAccessoriesStore(
    (state) => state.updateItem
  );
  const activeBusinessDay =
    useBusinessDayStore((state) =>
      state.getActiveBusinessDay()
    );
  const salesStore = useSalesStore();

  const [search, setSearch] = useState("");
  const [category, setCategory] =
    useState<(typeof categories)[number]>("All");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedTarget, setSelectedTarget] =
    useState<SelectedTarget>(null);
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("cash");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [newCategory, setNewCategory] =
    useState<AccessoryItem["category"]>("Other");
  const [editingItemId, setEditingItemId] =
    useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [
    openBillsExpanded,
    setOpenBillsExpanded,
  ] = useState(true);

  const runningTables = useMemo(
    () =>
      tables.filter(
        (table) => table.session
      ),
    [tables]
  );

  const openCustomerBills = useMemo(
    () =>
      customerAccounts.filter(
        (account) =>
          account.status === "active" &&
          account.paymentStatus === "unpaid"
      ),
    [customerAccounts]
  );

  const filteredOpenCustomerBills =
    useMemo(() => {
      const query = search.toLowerCase();

      return openCustomerBills.filter(
        (account) =>
          getBillSearchText(account).includes(
            query
          )
      );
    }, [openCustomerBills, search]);

  const selectedBillAccount =
    selectedTarget?.type === "bill"
      ? openCustomerBills.find(
          (account) =>
            account.id ===
            selectedTarget.customerId
        )
      : undefined;

  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        const matchesSearch = item.name
          .toLowerCase()
          .includes(search.toLowerCase());
        const matchesCategory =
          category === "All" ||
          item.category === category;

        return (
          item.available &&
          matchesSearch &&
          matchesCategory
        );
      }),
    [items, search, category]
  );

  const total = cart.reduce(
    (sum, item) =>
      sum + item.price * item.quantity,
    0
  );

  const loadCartForTarget = (
    target: SelectedTarget
  ) => {
    if (!target) {
      setCart([]);
      return;
    }

    const sourceOrderId =
      getSourceOrderId(target);

    if (target.type === "bill") {
      const account =
        customerAccounts.find(
          (item) => item.id === target.customerId
        );
      const charges =
        [
          ...(account?.accessoryCharges ?? []),
          ...(account?.cafeCharges.filter(
            (charge) =>
              charge.name.startsWith(
                accessoryPrefix
              )
          ) ?? []),
        ].filter(
          (charge) =>
            charge.sourceOrderId === sourceOrderId
        );

      setCart(
        charges.map((charge) => ({
          id: charge.itemId,
          name: cleanAccessoryName(
            charge.name
          ),
          price: charge.price,
          category: "Other",
          available: true,
          quantity: charge.quantity,
        }))
      );
      return;
    }

    const table = tables.find(
      (item) => item.id === target.tableId
    );
    const accessoryItems =
      table?.session?.cafeOrders.filter(
        (item) =>
          (item.menuItemId.startsWith("ACC-") ||
            item.name.startsWith(
              accessoryPrefix
            )) &&
          (item.customerName ===
            target.customerName ||
            item.playerName ===
              target.customerName)
      ) ?? [];

    setCart(
      accessoryItems.map((item) => ({
        id: item.menuItemId,
        name: cleanAccessoryName(item.name),
        price: item.price,
        category: "Other",
        available: true,
        quantity: item.quantity,
      }))
    );
  };

  const selectTarget = (
    target: SelectedTarget
  ) => {
    setSelectedTarget(target);
    loadCartForTarget(target);
    setMessage("");
    setError("");
  };

  useEffect(() => {
    const customerBillId =
      searchParams.get("customerBillId");
    const tableId = Number(
      searchParams.get("tableId")
    );
    const sessionId =
      searchParams.get("sessionId");

    if (customerBillId) {
      const account =
        openCustomerBills.find(
          (item) =>
            item.id === customerBillId
        );

      if (account) {
        selectTarget({
          type: "bill",
          customerId: account.id,
          customerName:
            account.customerName,
          customerToken:
            account.customerToken,
        });
      }
      return;
    }

    if (tableId && sessionId) {
      const table = tables.find(
        (item) =>
          item.id === tableId &&
          item.session?.id === sessionId
      );

      if (table?.session) {
        const players = getSessionPlayers(
          table.session
        );

        if (players.length > 1) {
          setMessage(
            "Select the player for this accessories bill."
          );
          return;
        }

        const customerName =
          players[0] ?? "Walk-in Customer";

        selectTarget({
          type: "table",
          tableId: table.id,
          tableName: table.name,
          sessionId: table.session.id,
          customerName,
          customerId:
            getPlayerCustomerId(
              table.session,
              customerName
            ),
        });
      }
    }
  }, [
    searchParams,
    tables,
    openCustomerBills,
  ]);

  const addToCart = (item: AccessoryItem) => {
    setCart((current) => {
      const existing = current.find(
        (cartItem) => cartItem.id === item.id
      );

      if (existing) {
        return current.map((cartItem) =>
          cartItem.id === item.id
            ? {
                ...cartItem,
                quantity: cartItem.quantity + 1,
              }
            : cartItem
        );
      }

      return [
        ...current,
        {
          ...item,
          quantity: 1,
        },
      ];
    });
  };

  const changeQuantity = (
    id: string,
    amount: number
  ) => {
    setCart((current) =>
      current
        .map((item) =>
          item.id === id
            ? {
                ...item,
                quantity:
                  item.quantity + amount,
              }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const handleAddItem = () => {
    setMessage("");
    setError("");

    const amount = Number(price);

    if (!name.trim() || amount <= 0) {
      setError(
        "Enter accessory name and valid price."
      );
      return;
    }

    const payload = {
      name: name.trim(),
      price: amount,
      category: newCategory,
      available: true,
    };

    if (editingItemId) {
      updateItem(editingItemId, payload);
      setMessage("Accessory updated.");
    } else {
      addItem(payload);
      setMessage("Accessory added.");
    }

    setName("");
    setPrice("");
    setNewCategory("Other");
    setEditingItemId(null);
  };

  const saveToBill = () => {
    setMessage("");
    setError("");

    if (!selectedTarget) {
      setError(
        "Select a table or open bill first."
      );
      return;
    }

    if (cart.length === 0) {
      setError("Add at least one item.");
      return;
    }

    const now = new Date().toISOString();
    const sourceOrderId =
      getSourceOrderId(selectedTarget);
    const customerName =
      selectedTarget.customerName;
    const charges = cart.map((item) => ({
      itemId: item.id,
      name: `${accessoryPrefix} ${item.name}`,
      quantity: item.quantity,
      price: item.price,
      subtotal:
        item.price * item.quantity,
      tableId:
        selectedTarget.type === "table"
          ? selectedTarget.tableId
          : undefined,
      tableName:
        selectedTarget.type === "table"
          ? selectedTarget.tableName
          : undefined,
      sessionId:
        selectedTarget.type === "table"
          ? selectedTarget.sessionId
          : undefined,
      orderedAt: now,
    }));

    replaceAccessoryChargesForOrder({
      customerId:
        selectedTarget.type === "bill"
          ? selectedTarget.customerId
          : selectedTarget.customerId,
      customerName,
      sourceOrderId,
      charges,
    });

    if (selectedTarget.type === "table") {
      const table = tables.find(
        (item) =>
          item.id === selectedTarget.tableId
      );
      const currentCafeOrders =
        table?.session?.cafeOrders.filter(
          (item) =>
            !(
              (item.menuItemId.startsWith(
                "ACC-"
              ) ||
                item.name.startsWith(
                  accessoryPrefix
                )) &&
              (item.customerName ===
                customerName ||
                item.playerName ===
                  customerName)
            )
        ) ?? [];

      updateSessionCafe({
        tableId: selectedTarget.tableId,
        cafeOrders: [
          ...currentCafeOrders,
          ...cart.map((item) => ({
            menuItemId: item.id,
            name: `${accessoryPrefix} ${item.name}`,
            price: item.price,
            quantity: item.quantity,
            subtotal:
              item.price *
              item.quantity,
            timeAdded: new Date(),
            tableId:
              selectedTarget.tableId,
            sessionId:
              selectedTarget.sessionId,
            customerName,
            playerName: customerName,
            orderedAt: now,
          })),
        ],
      });
    }

    setMessage(
      `Accessories saved to ${customerName}'s bill.`
    );
  };

  const completeSale = () => {
    setMessage("");
    setError("");

    if (cart.length === 0) {
      setError("Add at least one item.");
      return;
    }

    const invoiceNumber =
      salesStore.getNextInvoiceNumber();
    const staffBillNumber =
      salesStore.getNextWalkInBillNumber("ACC");
    const now = new Date().toISOString();

    salesStore.addSale({
      id: `SALE-${invoiceNumber}-ACCESSORIES`,
      invoiceNumber,
      staffBillNumber,
      tableId: 0,
      tableName: "Accessories POS",
      saleType: "accessories",
      sessionId: `ACCESSORIES-${Date.now()}`,
      players: [
        { name: "Accessories Customer" },
      ],
      sessionType: "time",
      payerName: "Accessories Customer",
      startedAt: now,
      endedAt: now,
      durationMinutes: 0,
      createdAt: now,
      paidAt: now,
      tableAmount: 0,
      cafeAmount: total,
      subtotal: total,
      discount: 0,
      grandTotal: total,
      paymentMethod,
      paymentStatus: "paid",
      activeBusinessDayId:
        activeBusinessDay?.id,
      orderedItems: cart.map((item) => ({
        menuItemId: item.id,
        name: `${accessoryPrefix} ${item.name}`,
        price: item.price,
        quantity: item.quantity,
        subtotal:
          item.price * item.quantity,
        timeAdded: new Date(),
        customerName:
          "Accessories Customer",
        playerName:
          "Accessories Customer",
        orderedAt: now,
      })),
      playerBreakdown: [
        {
          playerName:
            "Accessories Customer",
          tableAmountShare: 0,
          cafeAmount: total,
          totalAmount: total,
          cafeItems: cart.map((item) => ({
            menuItemId: item.id,
            name: `${accessoryPrefix} ${item.name}`,
            price: item.price,
            quantity: item.quantity,
            subtotal:
              item.price * item.quantity,
            timeAdded: new Date(),
            customerName:
              "Accessories Customer",
            playerName:
              "Accessories Customer",
            orderedAt: now,
          })),
        },
      ],
    });

    setCart([]);
    setSelectedTarget(null);
    setMessage(
      `Accessories sale completed. Rs. ${total} received.`
    );
  };

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-950">
              Accessories POS
            </h1>
            <p className="text-slate-500">
              Sell now, add to a running table, or add to an existing customer bill.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate("/operator")}
          >
            Back to Dashboard
          </Button>
        </header>

        <div className="mb-4 min-h-[44px]">
          {message && (
            <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              {message}
            </p>
          )}
          {error && (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </p>
          )}
        </div>

        <div className="grid gap-5 lg:grid-cols-[260px_1fr_380px]">
          <aside className="space-y-4">
            <Card className="p-4">
              <h2 className="font-bold">
                Running Tables
              </h2>
              <div className="mt-3 space-y-2">
                {runningTables.map((table) => {
                  const session = table.session!;
                  const players =
                    getSessionPlayers(session);

                  return (
                    <div
                      key={table.id}
                      className="rounded-lg border bg-white p-2"
                    >
                      <p className="px-2 pb-2 text-sm font-bold">
                        {table.name}
                      </p>
                      <div className="space-y-2">
                        {players.map((player) => (
                          <Button
                            key={player}
                            variant={
                              selectedTarget?.type ===
                                "table" &&
                              selectedTarget.tableId ===
                                table.id &&
                              selectedTarget.customerName ===
                                player
                                ? "default"
                                : "secondary"
                            }
                            className="h-auto w-full justify-start py-2 text-left"
                            onClick={() =>
                              selectTarget({
                                type: "table",
                                tableId: table.id,
                                tableName: table.name,
                                sessionId: session.id,
                                customerName: player,
                                customerId:
                                  getPlayerCustomerId(
                                    session,
                                    player
                                  ),
                              })
                            }
                          >
                            {getWalkInDisplayName({
                              name: player,
                              tableId: table.id,
                              tableName: table.name,
                              tableType: table.type,
                              time: session.startTime,
                            })}
                          </Button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-bold">
                  Open Bills
                </h2>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setOpenBillsExpanded(
                      (expanded) => !expanded
                    )
                  }
                >
                  {openBillsExpanded
                    ? "Hide"
                    : "Show"}{" "}
                  ({filteredOpenCustomerBills.length})
                </Button>
              </div>
              {openBillsExpanded && (
                <div className="mt-3 space-y-2">
                  {filteredOpenCustomerBills.map(
                    (account) => (
                      <Button
                        key={account.id}
                        variant={
                          selectedTarget?.type ===
                            "bill" &&
                          selectedTarget.customerId ===
                            account.id
                            ? "default"
                            : "secondary"
                        }
                        className="h-auto w-full justify-between gap-2 py-3 text-left"
                        onClick={() =>
                          selectTarget({
                            type: "bill",
                            customerId: account.id,
                            customerName:
                              account.customerName,
                            customerToken:
                              account.customerToken,
                          })
                        }
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">
                            {getBillPrimaryLabel(
                              account
                            )}
                          </span>
                          <span className="block truncate text-xs opacity-75">
                            {getBillSecondaryLabel(
                              account
                            )}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs font-bold">
                          Rs. {account.grandTotal}
                        </span>
                      </Button>
                    )
                  )}

                  {filteredOpenCustomerBills.length ===
                    0 && (
                    <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">
                      No open bills.
                    </p>
                  )}
                </div>
              )}
            </Card>
          </aside>

          <section className="space-y-4">
            <Card className="p-4">
              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <Input
                  placeholder="Search accessories..."
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                />
                <div className="flex flex-wrap gap-2">
                  {categories.map((item) => (
                    <Button
                      key={item}
                      size="sm"
                      variant={
                        category === item
                          ? "default"
                          : "secondary"
                      }
                      onClick={() =>
                        setCategory(item)
                      }
                    >
                      {item}
                    </Button>
                  ))}
                </div>
              </div>
            </Card>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredItems.map((item) => (
                <Card
                  key={item.id}
                  className="p-4"
                >
                  <p className="text-sm font-medium text-slate-500">
                    {item.category}
                  </p>
                  <h2 className="mt-2 text-xl font-bold text-slate-950">
                    {item.name}
                  </h2>
                  <p className="mt-4 text-2xl font-bold text-emerald-700">
                    Rs. {item.price}
                  </p>
                  <div className="mt-5 grid grid-cols-2 gap-2">
                  <Button
                    className="mt-5 w-full"
                    onClick={() => addToCart(item)}
                  >
                    Add
                  </Button>
                  <Button
                    variant="outline"
                    className="mt-5 w-full"
                    onClick={() => {
                      setEditingItemId(item.id);
                      setName(item.name);
                      setPrice(String(item.price));
                      setNewCategory(item.category);
                    }}
                  >
                    Edit
                  </Button>
                  </div>
                </Card>
              ))}
            </div>
          </section>

          <aside className="space-y-4">
            <Card className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <PackagePlus className="h-5 w-5" />
                <h2 className="font-bold">
                  Add Accessory
                </h2>
              </div>
              <div className="grid gap-2">
                <Input
                  placeholder="Name e.g. Tip"
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                />
                <Input
                  type="number"
                  min={0}
                  placeholder="Price"
                  value={price}
                  onChange={(event) =>
                    setPrice(event.target.value)
                  }
                />
                <select
                  className="rounded-md border bg-white p-2"
                  value={newCategory}
                  onChange={(event) =>
                    setNewCategory(
                      event.target
                        .value as AccessoryItem["category"]
                    )
                  }
                >
                  {categories
                    .filter((item) => item !== "All")
                    .map((item) => (
                      <option
                        key={item}
                        value={item}
                      >
                        {item}
                      </option>
                    ))}
                </select>
                <Button onClick={handleAddItem}>
                  {editingItemId
                    ? "Update Accessory"
                    : "Save Accessory"}
                </Button>
                {editingItemId && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingItemId(null);
                      setName("");
                      setPrice("");
                      setNewCategory("Other");
                    }}
                  >
                    Cancel Edit
                  </Button>
                )}
              </div>
            </Card>

            <Card className="p-4">
              <p className="text-sm font-medium text-slate-500">
                Current Target
              </p>
              <h2 className="mt-1 text-xl font-bold">
                {selectedBillAccount
                  ? selectedBillAccount.customerToken
                  : selectedTarget
                  ? selectedTarget.customerName
                  : "Walk-in Sale"}
              </h2>
              {selectedTarget && (
                <p className="text-sm text-slate-500">
                  {selectedBillAccount
                    ? getBillSecondaryLabel(
                        selectedBillAccount
                      )
                    : selectedTarget.type === "table"
                    ? selectedTarget.tableName
                    : selectedTarget.customerToken}
                </p>
              )}
              {selectedBillAccount && (
                <div className="mt-3 grid gap-1 rounded-lg bg-slate-50 p-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">
                      Customer
                    </span>
                    <strong className="text-right">
                      {getBillCustomerLabel(
                        selectedBillAccount
                      )}
                    </strong>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">
                      Table
                    </span>
                    <strong className="text-right">
                      {getBillTableLabel(
                        selectedBillAccount
                      ) || "-"}
                    </strong>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">
                      Previous Bill
                    </span>
                    <strong>
                      Rs.{" "}
                      {
                        selectedBillAccount.grandTotal
                      }
                    </strong>
                  </div>
                </div>
              )}

              <div className="mt-4 space-y-3">
                {cart.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border p-3"
                  >
                    <div className="flex justify-between gap-3">
                      <div>
                        <p className="font-semibold">
                          {item.name}
                        </p>
                        <p className="text-sm text-slate-500">
                          Rs. {item.price} each
                        </p>
                      </div>
                      <strong>
                        Rs.{" "}
                        {item.price *
                          item.quantity}
                      </strong>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          changeQuantity(
                            item.id,
                            -1
                          )
                        }
                      >
                        -
                      </Button>
                      <span className="w-8 text-center font-bold">
                        {item.quantity}
                      </span>
                      <Button
                        size="sm"
                        onClick={() =>
                          changeQuantity(
                            item.id,
                            1
                          )
                        }
                      >
                        +
                      </Button>
                    </div>
                  </div>
                ))}

                {cart.length === 0 && (
                  <p className="rounded-lg bg-slate-50 p-4 text-center text-sm text-slate-500">
                    No accessories added.
                  </p>
                )}
              </div>

              <div className="mt-5 border-t pt-4">
                <div className="mb-3 flex justify-between text-xl font-bold">
                  <span>Total</span>
                  <span className="text-emerald-700">
                    Rs. {total}
                  </span>
                </div>
                <Button
                  className="mb-3 w-full"
                  disabled={
                    !selectedTarget ||
                    cart.length === 0
                  }
                  onClick={saveToBill}
                >
                  Save to Bill
                </Button>
                <select
                  className="mb-3 w-full rounded-md border bg-white p-2"
                  value={paymentMethod}
                  onChange={(event) =>
                    setPaymentMethod(
                      event.target
                        .value as PaymentMethod
                    )
                  }
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="jazzcash">
                    JazzCash
                  </option>
                  <option value="easypaisa">
                    Easypaisa
                  </option>
                </select>
                <Button
                  className="w-full"
                  disabled={
                    selectedTarget !== null ||
                    cart.length === 0
                  }
                  onClick={completeSale}
                >
                  Complete Sale
                </Button>
              </div>
            </Card>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default AccessoriesPage;
