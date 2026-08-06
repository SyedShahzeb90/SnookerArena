import { Minus, Plus, Search, ShoppingCart, Trash2 } from "lucide-react";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/layout/page-layout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import type { PaymentMethod } from "@/types/session";
import { useBusinessDayStore } from "@/features/business-day/store/businessDayStore";
import { useClubSettingsStore } from "@/features/settings/store/clubSettingsStore";
import { useCustomerAccountStore } from "@/features/customers/store/customerAccountStore";
import {
  getBillPrimaryLabel,
  getBillSecondaryLabel,
} from "@/features/customers/utils/billDisplay";
import { useSalesStore } from "@/features/sales/store/salesStore";
import {
  getSessionPlayerEntries,
} from "@/features/sessions/utils/sessionPlayers";
import { getSessionParticipantDisplayLabel } from "@/features/customers/utils/participantDisplay";
import { getWalkInDisplayName } from "@/features/sessions/utils/walkInLabel";
import { useTableStore } from "@/store/tableStore";
import {
  type AccessoryItem,
  useAccessoriesStore,
} from "./store/accessoriesStore";

type CartItem = AccessoryItem & {
  quantity: number;
};

type StockAwareAccessory = AccessoryItem & {
  trackStock?: boolean;
  currentStock?: number;
  stockUnit?: string;
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

function getStockLabel(item: AccessoryItem) {
  const stockItem = item as StockAwareAccessory;
  if (!stockItem.trackStock || typeof stockItem.currentStock !== "number") {
    return "—";
  }

  return `${stockItem.currentStock.toLocaleString()} ${stockItem.stockUnit ?? "pcs"}`;
}

const AccessoryProductRow = memo(function AccessoryProductRow({
  item,
  highlighted,
  alternate,
  onAdd,
}: {
  item: AccessoryItem;
  highlighted: boolean;
  alternate: boolean;
  onAdd: (item: AccessoryItem) => void;
}) {
  return (
    <div
      className={`grid min-h-12 min-w-[620px] grid-cols-[minmax(180px,1fr)_minmax(100px,150px)_110px_90px_44px] items-center gap-3 border-t border-slate-100 px-3 py-2 text-sm transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/70 ${
        highlighted
          ? "bg-slate-100 dark:bg-slate-800"
          : alternate
            ? "bg-slate-50/60 dark:bg-slate-900/70"
            : "bg-white dark:bg-slate-900"
      }`}
      aria-selected={highlighted}
    >
      <p className="truncate font-semibold text-slate-950 dark:text-slate-100" title={item.name}>
        {item.name}
      </p>
      <p className="truncate text-slate-500 dark:text-slate-400" title={item.category}>
        {item.category}
      </p>
      <p className="whitespace-nowrap text-right font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
        Rs. {item.price.toLocaleString()}
      </p>
      <p className="whitespace-nowrap text-right text-xs text-slate-500 dark:text-slate-400">
        {getStockLabel(item)}
      </p>
      <Button
        type="button"
        size="icon"
        className="h-8 w-8 justify-self-end"
        title={`Add ${item.name}`}
        aria-label={`Add ${item.name}`}
        onClick={() => onAdd(item)}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
});

function AccessoriesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const items = useAccessoriesStore(
    (state) => state.items
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
    useState<PaymentMethod>(() =>
      useClubSettingsStore.getState().settings.defaultPaymentMethod
    );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [billSaved, setBillSaved] = useState(false);

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

  const selectedBillAccount =
    selectedTarget?.type === "bill"
      ? openCustomerBills.find(
          (account) =>
            account.id ===
            selectedTarget.customerId
        )
      : undefined;

  const filteredItems = useMemo(
    () => {
      const query = search.trim().toLowerCase();
      return items
        .filter((item) => {
        const matchesSearch =
          !query ||
          item.name.toLowerCase().includes(query) ||
          item.category.toLowerCase().includes(query);
        const matchesCategory =
          category === "All" ||
          item.category === category;

        return (
          item.available &&
          matchesSearch &&
          matchesCategory
        );
        })
        .sort((left, right) => {
          if (!query) return 0;
          const leftNameMatch = left.name.toLowerCase().includes(query);
          const rightNameMatch = right.name.toLowerCase().includes(query);
          if (leftNameMatch === rightNameMatch) return 0;
          return leftNameMatch ? -1 : 1;
        });
    },
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
          (target.customerId
            ? item.playerId === target.customerId
            : !item.playerId &&
              (item.customerName === target.customerName ||
                item.playerName === target.customerName))
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
    setBillSaved(false);
    setMessage("");
    setError("");
  };

  const targetOptions = useMemo(() => {
    const tableOptions = runningTables.flatMap((table) => {
      const session = table.session!;
      return getSessionPlayerEntries(session).map((player) => ({
        value: `table:${table.id}:${player.customerId ?? player.slot}`,
        label: `${table.name} - ${getWalkInDisplayName({
          name: getSessionParticipantDisplayLabel(
            session,
            player.slot
          ),
          tableId: table.id,
          tableName: table.name,
          tableType: table.type,
          time: session.startTime,
        })}`,
        target: {
          type: "table" as const,
          tableId: table.id,
          tableName: table.name,
          sessionId: session.id,
          customerName: player.name,
          customerId: player.customerId,
        },
      }));
    });
    const billOptions = openCustomerBills.map((account) => ({
      value: `bill:${account.id}`,
      label: `${getBillPrimaryLabel(account)} - Rs. ${account.grandTotal.toLocaleString()}`,
      target: {
        type: "bill" as const,
        customerId: account.id,
        customerName: account.customerName,
        customerToken: account.customerToken,
      },
    }));
    return { tableOptions, billOptions, all: [...tableOptions, ...billOptions] };
  }, [runningTables, openCustomerBills]);

  const selectedTargetValue = selectedTarget
    ? targetOptions.all.find((option) =>
        option.target.type === selectedTarget.type &&
        (selectedTarget.type === "bill"
          ? option.target.type === "bill" && option.target.customerId === selectedTarget.customerId
          : option.target.type === "table" &&
            option.target.tableId === selectedTarget.tableId &&
            (selectedTarget.customerId
              ? option.target.customerId === selectedTarget.customerId
              : option.target.customerName === selectedTarget.customerName))
      )?.value ?? "walkin"
    : "walkin";

  const chooseTarget = (value: string) => {
    if (value === "walkin") {
      selectTarget(null);
      return;
    }
    const option = targetOptions.all.find((item) => item.value === value);
    if (option) selectTarget(option.target);
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
        const players = getSessionPlayerEntries(
          table.session
        );

        if (players.length > 1) {
          setMessage(
            "Select the player for this accessories bill."
          );
          return;
        }

        const customerName =
          players[0]?.name ?? "Walk-in Customer";

        selectTarget({
          type: "table",
          tableId: table.id,
          tableName: table.name,
          sessionId: table.session.id,
          customerName,
          customerId: players[0]?.customerId,
        });
      }
    }
  }, [
    searchParams,
    tables,
    openCustomerBills,
  ]);

  const addToCart = useCallback((item: AccessoryItem) => {
    setBillSaved(false);
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
    setSearch("");
    window.requestAnimationFrame(() => searchInputRef.current?.focus());
  }, []);

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setSearch("");
      return;
    }

    if (event.key === "Enter" && filteredItems[0]) {
      event.preventDefault();
      addToCart(filteredItems[0]);
    }
  };

  const changeQuantity = (
    id: string,
    amount: number
  ) => {
    setBillSaved(false);
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

  const saveToBill = ({
    returnToDashboard = false,
  }: {
    returnToDashboard?: boolean;
  } = {}) => {
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
              (selectedTarget.customerId
                ? item.playerId === selectedTarget.customerId
                : !item.playerId &&
                  (item.customerName === customerName ||
                    item.playerName === customerName))
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
            playerId: selectedTarget.customerId,
            orderedAt: now,
          })),
        ],
      });
    }

    setMessage(
      `Accessories saved to ${customerName}'s bill.`
    );
    setBillSaved(true);
    if (returnToDashboard) {
      navigate("/operator");
    }
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
    setBillSaved(false);
    setMessage(
      `Accessories sale completed. Rs. ${total} received.`
    );
  };

  return (
    <PageShell contentClassName="space-y-0">
      <div>
        <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">Accessories POS</h1>
            <p className="text-sm text-slate-500">Sell accessories or add them to a table or customer bill.</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/operator/tables-rooms")}>Back to Tables & Rooms</Button>
        </header>

        {(message || error) && (
          <div className="mb-4">
            {message && <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{message}</p>}
            {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
          </div>
        )}

        <Card className="mb-4 p-4">
          <div className="grid gap-2 md:grid-cols-[180px_minmax(0,1fr)] md:items-center">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Current Target</p>
              <p className="font-bold text-slate-950">
                {selectedBillAccount?.customerToken ?? selectedTarget?.customerName ?? "Walk-in Sale"}
              </p>
            </div>
            <select
              aria-label="Choose sale target"
              className="h-10 w-full rounded-md border bg-white px-3 text-sm"
              value={selectedTargetValue}
              onChange={(event) => chooseTarget(event.target.value)}
            >
              <option value="walkin">Walk-in Sale</option>
              {targetOptions.tableOptions.length > 0 && (
                <optgroup label="Running Tables">
                  {targetOptions.tableOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </optgroup>
              )}
              {targetOptions.billOptions.length > 0 && (
                <optgroup label="Open Customer Bills">
                  {targetOptions.billOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </optgroup>
              )}
            </select>
          </div>
        </Card>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="min-w-0 space-y-3">
            <Card className="p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  ref={searchInputRef}
                  autoFocus
                  className="pl-9"
                  placeholder="Search by accessory or category..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={handleSearchKeyDown}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {categories.map((item) => (
                  <Button
                    key={item}
                    type="button"
                    size="sm"
                    variant={category === item ? "default" : "secondary"}
                    className="h-8 rounded-full px-3 text-xs"
                    onClick={() => {
                      setCategory(item);
                      window.requestAnimationFrame(() => searchInputRef.current?.focus());
                    }}
                  >
                    {item}
                  </Button>
                ))}
              </div>
            </Card>

            <Card className="overflow-hidden p-0">
              <div className="overflow-x-auto">
                <div className="grid min-w-[620px] grid-cols-[minmax(180px,1fr)_minmax(100px,150px)_110px_90px_44px] items-center gap-3 bg-slate-50 px-3 py-2 text-[11px] font-bold uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  <span>Product</span>
                  <span>Category</span>
                  <span className="text-right">Price</span>
                  <span className="text-right">Stock</span>
                  <span className="sr-only">Add</span>
                </div>
                {filteredItems.map((item, index) => (
                  <AccessoryProductRow
                    key={item.id}
                    item={item}
                    highlighted={index === 0 && search.trim().length > 0}
                    alternate={index % 2 === 1}
                    onAdd={addToCart}
                  />
                ))}
              </div>
              {filteredItems.length === 0 && (
                <EmptyState
                  compact
                  icon={Search}
                  title="No Accessories Found"
                  description="Try another search or category."
                />
              )}
            </Card>
          </section>

          <aside className="lg:sticky lg:top-4">
            <Card className="flex max-h-[calc(100vh-120px)] flex-col p-4">
              <div className="flex items-center gap-2 border-b pb-3">
                <ShoppingCart className="h-5 w-5" />
                <div>
                  <p className="text-xs text-slate-500">Current Order</p>
                  <h2 className="font-bold text-slate-950">
                    {selectedBillAccount?.customerToken ?? selectedTarget?.customerName ?? "Walk-in Sale"}
                  </h2>
                  {selectedTarget && <p className="text-xs text-slate-500">{selectedTarget.type === "table" ? selectedTarget.tableName : selectedBillAccount ? getBillSecondaryLabel(selectedBillAccount) : selectedTarget.customerToken}</p>}
                </div>
              </div>

              <div className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto py-1 dark:divide-slate-800">
                {cart.map((item) => (
                  <div
                    key={item.id}
                    className="motion-item-in grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-100" title={item.name}>
                        {item.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Rs. {item.price.toLocaleString()} each
                      </p>
                    </div>
                    <p className="whitespace-nowrap text-right text-sm font-bold tabular-nums text-slate-950 dark:text-slate-100">
                      Rs. {(item.price * item.quantity).toLocaleString()}
                    </p>
                    <div className="col-span-2 flex items-center gap-1.5">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-8 w-8"
                        aria-label={`Decrease ${item.name} quantity`}
                        onClick={() => changeQuantity(item.id, -1)}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <span className="w-7 text-center text-sm font-bold tabular-nums">
                        {item.quantity}
                      </span>
                      <Button
                        type="button"
                        size="icon"
                        className="h-8 w-8"
                        aria-label={`Increase ${item.name} quantity`}
                        onClick={() => changeQuantity(item.id, 1)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="ml-auto h-8 w-8 text-red-700 hover:bg-red-50 hover:text-red-800"
                        title={`Remove ${item.name}`}
                        aria-label={`Remove ${item.name}`}
                        onClick={() => {
                          setBillSaved(false);
                          setCart((current) =>
                            current.filter((cartItem) => cartItem.id !== item.id),
                          );
                          window.requestAnimationFrame(() => searchInputRef.current?.focus());
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                {cart.length === 0 && <p className="rounded-lg bg-slate-50 p-4 text-center text-sm text-slate-500">No accessories added.</p>}
              </div>

              <div className="border-t pt-4">
                <div className="mb-3 flex justify-between text-xl font-bold"><span>Total</span><span className="text-emerald-700">Rs. {total.toLocaleString()}</span></div>
                {selectedTarget && (
                  <div className="mb-3 grid grid-cols-2 gap-2">
                    <Button variant="outline" disabled={cart.length === 0} onClick={() => saveToBill()}>{billSaved ? "Saved" : "Save"}</Button>
                    <Button disabled={cart.length === 0} onClick={() => saveToBill({ returnToDashboard: true })}>Save & Return</Button>
                  </div>
                )}
                {billSaved && <p className="mb-3 rounded-md bg-emerald-50 px-3 py-2 text-center text-sm font-semibold text-emerald-700">Saved</p>}
                <label className="mb-1 block text-xs font-semibold text-slate-500" htmlFor="accessory-payment-method">Payment Method</label>
                <select id="accessory-payment-method" className="mb-3 h-10 w-full rounded-md border bg-white px-3 text-sm" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)} disabled={selectedTarget !== null}>
                  <option value="cash">Cash</option><option value="card">Card</option><option value="jazzcash">JazzCash</option><option value="easypaisa">Easypaisa</option>
                </select>
                <Button className="w-full" disabled={selectedTarget !== null || cart.length === 0} onClick={completeSale}>Complete Sale</Button>
              </div>
            </Card>
          </aside>
        </div>
      </div>
    </PageShell>
  );
}

export default AccessoriesPage;
