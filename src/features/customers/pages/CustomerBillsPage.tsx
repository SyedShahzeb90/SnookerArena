import {
  ArrowLeft,
  Coffee,
  Package,
  ReceiptText,
  Search,
} from "lucide-react";
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
import { useBusinessDayStore } from "@/features/business-day/store/businessDayStore";
import { useSalesStore } from "@/features/sales/store/salesStore";
import { getSessionPlayers } from "@/features/sessions/utils/sessionPlayers";
import { useTableStore } from "@/store/tableStore";
import { useCustomerAccountStore } from "../store/customerAccountStore";
import type { CustomerAccount } from "../types/customerAccount";
import type { PaymentMethod } from "@/types/session";
import type { PaymentSplit } from "@/features/sales/types/sale";
import PaymentMethodSelector from "@/features/billing/components/PaymentMethodSelector";
import {
  getBillPrimaryLabel,
  getBillTableLabel,
} from "../utils/billDisplay";

const paymentMethods: {
  value: PaymentMethod;
  label: string;
}[] = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "jazzcash", label: "JazzCash" },
  { value: "easypaisa", label: "Easypaisa" },
];

function formatShortDate(value?: string) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString(
    undefined,
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  );
}

function formatTime(value?: string) {
  if (!value) return "Unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unavailable";
  }

  return date.toLocaleTimeString(
    undefined,
    {
      hour: "numeric",
      minute: "2-digit",
    }
  );
}

function formatDurationMinutes(minutes?: number) {
  if (
    minutes === undefined ||
    !Number.isFinite(minutes) ||
    minutes < 0
  ) {
    return "Unavailable";
  }

  const totalMinutes = Math.round(minutes);

  if (totalMinutes < 1) {
    return "Less than 1 min";
  }

  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  if (hours > 0 && mins > 0) {
    return `${hours} hr ${mins} min`;
  }

  if (hours > 0) {
    return `${hours} hr`;
  }

  return `${totalMinutes} min`;
}

function formatDuration(
  startedAt?: string | number,
  endedAt?: string,
  fallbackMinutes?: number
) {
  if (typeof startedAt === "number") {
    return formatDurationMinutes(startedAt);
  }

  if (startedAt && endedAt) {
    const start = new Date(startedAt).getTime();
    const end = new Date(endedAt).getTime();

    if (
      Number.isFinite(start) &&
      Number.isFinite(end) &&
      end >= start
    ) {
      return formatDurationMinutes((end - start) / 60000);
    }
  }

  return formatDurationMinutes(fallbackMinutes);
}

function formatCurrency(amount: number) {
  return `Rs. ${Math.round(amount).toLocaleString()}`;
}

function formatAmountOrDash(amount: number) {
  return amount > 0 ? formatCurrency(amount) : "—";
}

function formatCustomerDisplayName(value?: string) {
  const name = value?.trim();

  if (!name || name.toLowerCase() === "walk-in customer") {
    return "Walk-in Customer";
  }

  if (/^(ID|VIP|CEO|CFO|CTO)$/i.test(name)) {
    return name.toUpperCase();
  }

  return name.replace(/\b[\w']+\b/g, (word) =>
    word.length <= 1
      ? word.toUpperCase()
      : word[0].toUpperCase() + word.slice(1).toLowerCase()
  );
}

function getBillTimestamp(account: CustomerAccount) {
  return (
    account.gameCharges
      .map((charge) => charge.endedAt)
      .filter(Boolean)
      .sort()
      .at(-1) ??
    account.lastActivityAt ??
    account.updatedAt ??
    account.openedAt
  );
}

function getBillTypeLabel(account: CustomerAccount) {
  if (account.gameCharges.length > 0) {
    const types = account.gameCharges.map(
      (charge) => charge.sessionType
    );
    const uniqueTypes = Array.from(new Set(types));

    if (uniqueTypes.length > 1) return "Mixed Session";

    const label =
      uniqueTypes[0] === "single"
        ? "Single Game"
        : uniqueTypes[0] === "double"
          ? "Double Game"
          : "Table Booking";

    return types.length > 1
      ? `${label} ×${types.length}`
      : label;
  }

  const cafeTotal = getCafeCharges(account).reduce(
    (total, charge) => total + charge.subtotal,
    0
  );
  const accessoryTotal = getAccessoryCharges(account).reduce(
    (total, charge) => total + charge.subtotal,
    0
  );

  if (cafeTotal > 0 && accessoryTotal > 0) {
    return "Cafe & Accessories";
  }

  if (accessoryTotal > 0) return "Accessories Only";

  return "Cafe Only";
}

function getChargeTypeLabel(
  sessionType: CustomerAccount["gameCharges"][number]["sessionType"]
) {
  if (sessionType === "single") return "Single Game";
  if (sessionType === "double") return "Double Game";
  return "Time Charge";
}

function getDisplayCustomerLabel(account: CustomerAccount) {
  if (account.customerNote?.trim()) {
    return formatCustomerDisplayName(account.customerNote);
  }

  return formatCustomerDisplayName(account.customerName);
}

function getSessionSummary(
  account: CustomerAccount
) {
  const charges = account.gameCharges;

  if (charges.length === 0) {
    return {
      date: "-",
      started: "-",
      ended: "-",
      duration: "-",
    };
  }

  const startTimes = charges.map((charge) =>
    new Date(charge.startedAt).getTime()
  );
  const endTimes = charges.map((charge) =>
    new Date(charge.endedAt).getTime()
  );
  const earliestStartedAt =
    charges[
      startTimes.indexOf(Math.min(...startTimes))
    ]?.startedAt;
  const latestEndedAt =
    charges[
      endTimes.indexOf(Math.max(...endTimes))
    ]?.endedAt;
  const totalDuration =
    charges.reduce(
      (total, charge) =>
        total + (charge.durationMinutes ?? 0),
      0
    );

  return {
    date: formatShortDate(earliestStartedAt),
    started: formatTime(earliestStartedAt),
    ended: formatTime(latestEndedAt),
    duration: formatDuration(
      earliestStartedAt,
      latestEndedAt,
      totalDuration
    ),
  };
}

function getBillAge(value?: string) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const diffMinutes = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 60000)
  );

  if (diffMinutes < 60) {
    return `${Math.max(1, diffMinutes)} min`;
  }

  const hours = Math.floor(diffMinutes / 60);
  if (hours < 24) return `${hours} hr`;

  return `${Math.floor(hours / 24)} days`;
}

function paymentLabel(
  method: PaymentMethod
) {
  return (
    paymentMethods.find(
      (item) => item.value === method
    )?.label ?? method
  );
}

function isAccessoryCharge(charge: {
  name: string;
}) {
  return charge.name.startsWith("[Accessory]");
}

function getCafeCharges(account: CustomerAccount) {
  return account.cafeCharges.filter(
    (charge) => !isAccessoryCharge(charge)
  );
}

function getAccessoryCharges(
  account: CustomerAccount
) {
  return [
    ...(account.accessoryCharges ?? []),
    ...account.cafeCharges.filter(isAccessoryCharge),
  ];
}

function getBillTotals(account: CustomerAccount) {
  const cafeTotal = getCafeCharges(account).reduce(
    (total, charge) => total + charge.subtotal,
    0
  );
  const accessoryTotal =
    getAccessoryCharges(account).reduce(
      (total, charge) => total + charge.subtotal,
      0
    );
  const grandTotal = Math.max(
    0,
    account.totalGameAmount +
      cafeTotal +
      accessoryTotal -
      account.discount
  );

  return {
    cafeTotal,
    accessoryTotal,
    grandTotal,
  };
}

function getAccountSessionIds(
  account: CustomerAccount
) {
  return new Set(
    [
      ...account.gameCharges,
      ...account.cafeCharges,
      ...(account.accessoryCharges ?? []),
    ]
      .map((charge) => charge.sessionId)
      .filter(Boolean)
  );
}

function accountMatchesSession(
  account: CustomerAccount,
  session: NonNullable<
    ReturnType<
      typeof useTableStore.getState
    >["tables"][number]["session"]
  >
) {
  const customerIds = [
    session.player1CustomerId,
    session.player2CustomerId,
    session.player3CustomerId,
    session.player4CustomerId,
  ].filter(Boolean);
  const accountName =
    account.customerName.trim().toLowerCase();

  return (
    customerIds.includes(account.id) ||
    getSessionPlayers(session).some(
      (player) =>
        player.trim().toLowerCase() ===
        accountName
    )
  );
}

function CustomerBillsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const accounts = useCustomerAccountStore(
    (state) => state.accounts
  );
  const tables = useTableStore(
    (state) => state.tables
  );
  const applyCustomerDiscount =
    useCustomerAccountStore(
      (state) => state.applyCustomerDiscount
    );
  const updateCustomerAccount =
    useCustomerAccountStore(
      (state) => state.updateCustomerAccount
    );
  const markCustomerBillPaid =
    useCustomerAccountStore(
      (state) => state.markCustomerBillPaid
    );
  const splitGenericWalkInBills =
    useCustomerAccountStore(
      (state) => state.splitGenericWalkInBills
    );
  const mergeDuplicateWalkInSessionBills =
    useCustomerAccountStore(
      (state) =>
        state.mergeDuplicateWalkInSessionBills
    );
  const salesStore = useSalesStore();
  const activeBusinessDay =
    useBusinessDayStore((state) =>
      state.getActiveBusinessDay()
    );

  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] =
    useState<string | null>(null);
  const [discountText, setDiscountText] =
    useState("0");
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("cash");
  const [paymentSplits, setPaymentSplits] =
    useState<PaymentSplit[]>([]);
  const [editName, setEditName] =
    useState("");
  const [editNote, setEditNote] =
    useState("");
  const [editPhone, setEditPhone] =
    useState("");
  const [isEditingCustomer, setIsEditingCustomer] =
    useState(false);
  const [message, setMessage] =
    useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    splitGenericWalkInBills();
    mergeDuplicateWalkInSessionBills();
  }, [
    splitGenericWalkInBills,
    mergeDuplicateWalkInSessionBills,
  ]);

  const openAccounts = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return accounts
      .filter(
        (account) =>
          account.status === "active" &&
          account.paymentStatus === "unpaid" &&
          getBillTotals(account).grandTotal > 0
      )
      .filter((account) => {
        if (!query) return true;

        const haystack = [
          account.customerToken,
          account.customerName,
          account.customerNote,
          account.phone,
          account.lastTableName,
          getBillPrimaryLabel(account),
          getBillTableLabel(account),
          getBillTypeLabel(account),
          ...account.gameCharges.map(
            (charge) =>
              `${charge.tableName} ${charge.sessionType} ${charge.payerName} ${charge.loserName ?? ""} ${charge.winnerName ?? ""}`
          ),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(query);
      })
      .sort(
        (a, b) =>
          new Date(
            b.lastActivityAt ?? b.updatedAt
          ).getTime() -
          new Date(
            a.lastActivityAt ?? a.updatedAt
          ).getTime()
      );
  }, [accounts, search]);

  useEffect(() => {
    const customerBillId = searchParams.get(
      "customerBillId"
    );

    if (
      customerBillId &&
      openAccounts.some(
        (account) =>
          account.id === customerBillId
      )
    ) {
      setSelectedId(customerBillId);
    }
  }, [searchParams, openAccounts]);

  const selectedAccount =
    openAccounts.find(
      (account) => account.id === selectedId
    ) ?? openAccounts[0];
  const selectedTotals = selectedAccount
    ? getBillTotals(selectedAccount)
    : undefined;
  const selectedSessionSummary =
    selectedAccount
      ? getSessionSummary(selectedAccount)
      : undefined;
  const selectedBillAge = selectedAccount
    ? getBillAge(getBillTimestamp(selectedAccount))
    : "";

  const totals = openAccounts.reduce(
    (summary, account) => ({
      count: summary.count + 1,
      amount:
        summary.amount +
        getBillTotals(account).grandTotal,
    }),
    { count: 0, amount: 0 }
  );

  const getRunningTableForAccount = (
    account: CustomerAccount
  ) => {
    const sessionIds =
      getAccountSessionIds(account);

    return tables.find(
      (table) => {
        if (
          !table.session ||
          !(
            table.status === "running" ||
            table.status === "paused" ||
            table.status ===
              "payment-pending"
          )
        ) {
          return false;
        }

        return (
          sessionIds.has(table.session.id) ||
          accountMatchesSession(
            account,
            table.session
          )
        );
      }
    );
  };
  const selectedRunningTable = selectedAccount
    ? getRunningTableForAccount(selectedAccount)
    : undefined;

  const openBill = (
    account: CustomerAccount
  ) => {
    setSelectedId(account.id);
    setDiscountText(
      String(account.discount ?? 0)
    );
    setPaymentMethod("cash");
    setPaymentSplits([]);
    setMessage("");
    setError("");
    setEditName(account.customerName);
    setEditNote(account.customerNote ?? "");
    setEditPhone(account.phone ?? "");
    setIsEditingCustomer(false);
  };

  const handleSaveCustomer = () => {
    if (!selectedAccount) return;

    if (!editName.trim()) {
      setError("Customer name is required.");
      setMessage("");
      return;
    }

    updateCustomerAccount(
      selectedAccount.id,
      {
        customerName: editName.trim(),
        customerNote:
          editNote.trim() || undefined,
        phone: editPhone.trim() || undefined,
      }
    );
    setIsEditingCustomer(false);
    setMessage("Customer updated.");
    setError("");
  };

  const handleApplyDiscount = () => {
    if (!selectedAccount) return;

    const discount =
      Number(discountText) || 0;
    applyCustomerDiscount(
      selectedAccount.id,
      discount
    );
    setMessage("Discount updated.");
    setError("");
  };

  const handleReceivePayment = () => {
    setMessage("");
    setError("");

    if (!selectedAccount) return;

    if (
      selectedRunningTable &&
      (selectedRunningTable.status === "running" ||
        selectedRunningTable.status === "paused")
    ) {
      setError(
        `${selectedAccount.customerName} is still playing on ${selectedRunningTable.name}. End the table before receiving this bill.`
      );
      return;
    }

    if (!activeBusinessDay) {
      setError(
        "Please start the day before receiving payment."
      );
      return;
    }

    const cleanedSplits =
      paymentSplits.filter(
        (split) => split.amount > 0
      );
    const splitTotal =
      cleanedSplits.reduce(
        (total, split) =>
          total + split.amount,
        0
      );

    if (
      cleanedSplits.length > 0 &&
      splitTotal !==
        selectedTotals?.grandTotal
    ) {
      setError(
        `Split payment total must be Rs. ${selectedTotals?.grandTotal}.`
      );
      return;
    }

    const now = new Date().toISOString();
    const invoiceNumber =
      salesStore.getNextInvoiceNumber();
    const saleId = `SALE-${invoiceNumber}-CUSTOMER`;

    salesStore.addSale({
      id: saleId,
      invoiceNumber,
      tableId: 0,
      tableName:
        selectedAccount.lastTableName ?? "-",
      saleType: "customer_bill",
      sessionId: selectedAccount.id,
      players: [
        {
          name: selectedAccount.customerName,
        },
      ],
      sessionType: "time",
      payerName:
        selectedAccount.customerName,
      startedAt:
        selectedAccount.openedAt,
      endedAt: now,
      durationMinutes: 0,
      createdAt: now,
      paidAt: now,
      tableAmount:
        selectedAccount.totalGameAmount,
      cafeAmount:
        selectedTotals?.cafeTotal ?? 0,
      subtotal:
        selectedAccount.totalGameAmount +
        (selectedTotals?.cafeTotal ?? 0) +
        (selectedTotals?.accessoryTotal ?? 0),
      discount: selectedAccount.discount,
      grandTotal:
        selectedTotals?.grandTotal ?? 0,
      paymentMethod,
      paymentSplits:
        cleanedSplits.length > 0
          ? cleanedSplits
          : undefined,
      paymentStatus: "paid",
      activeBusinessDayId:
        activeBusinessDay.id,
      orderedItems:
        [
          ...selectedAccount.cafeCharges,
          ...(selectedAccount.accessoryCharges ?? []),
        ].map(
          (charge) => ({
            menuItemId: charge.itemId,
            name: charge.name,
            price: charge.price,
            quantity: charge.quantity,
            subtotal: charge.subtotal,
            timeAdded: new Date(
              charge.orderedAt
            ),
            tableId: charge.tableId,
            sessionId: charge.sessionId,
            customerName:
              charge.customerName,
            playerName: charge.customerName,
            orderedAt: charge.orderedAt,
          })
        ),
      playerBreakdown: [
        {
          playerName:
            selectedAccount.customerName,
          tableAmountShare:
            selectedAccount.totalGameAmount,
          cafeAmount:
            selectedAccount.totalCafeAmount +
            (selectedTotals?.accessoryTotal ?? 0),
          totalAmount:
            selectedTotals?.grandTotal ?? 0,
          cafeItems:
            [
              ...selectedAccount.cafeCharges,
              ...(selectedAccount.accessoryCharges ?? []),
            ].map(
              (charge) => ({
                menuItemId: charge.itemId,
                name: charge.name,
                price: charge.price,
                quantity: charge.quantity,
                subtotal: charge.subtotal,
                timeAdded: new Date(
                  charge.orderedAt
                ),
                customerName:
                  charge.customerName,
                playerName:
                  charge.customerName,
                orderedAt:
                  charge.orderedAt,
              })
            ),
        },
      ],
      customerAccountId:
        selectedAccount.id,
      customerToken:
        selectedAccount.customerToken,
      customerName:
        selectedAccount.customerName,
      customerNote:
        selectedAccount.customerNote,
      gameCharges:
        selectedAccount.gameCharges,
      cafeCharges:
        selectedAccount.cafeCharges,
    });

    markCustomerBillPaid({
      customerId: selectedAccount.id,
      paymentMethod,
      activeBusinessDayId:
        activeBusinessDay.id,
      saleId,
    });

    setMessage(
      `Payment received for ${selectedAccount.customerName}.`
    );
    setSelectedId(null);
    setPaymentMethod("cash");
    setPaymentSplits([]);
  };

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8">
      <div className="mx-auto max-w-7xl">
        <Button
          variant="ghost"
          className="mb-4 gap-2"
          onClick={() => navigate("/operator")}
        >
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Button>

        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">
              Customer Bills
            </h1>
            <p className="text-sm text-slate-500">
              Open unpaid customer bills for games and cafe orders.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="p-4">
              <p className="text-sm text-slate-500">
                Open Bills
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-950">
                {totals.count.toLocaleString()} bills
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-slate-500">
                Outstanding Amount
              </p>
              <p className="mt-1 text-2xl font-bold text-amber-700">
                {formatCurrency(totals.amount)}
              </p>
            </Card>
          </div>
        </div>

        {message && (
          <p className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200">
            {message}
          </p>
        )}

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-red-200">
            {error}
          </p>
        )}

        <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <Card className="overflow-hidden">
            <div className="flex items-center gap-3 border-b p-4">
              <Search className="h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search bill no, customer, player, table..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />
            </div>

            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[1040px] table-fixed text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs uppercase text-slate-500 shadow-sm">
                  <tr>
                    <th className="w-32 min-w-32 whitespace-nowrap px-4 py-3">
                      Bill No
                    </th>
                    <th className="min-w-48 px-4 py-3">
                      Customer / Table
                    </th>
                    <th className="w-36 min-w-36 whitespace-nowrap px-4 py-3">
                      Ended At
                    </th>
                    <th className="w-36 min-w-36 whitespace-nowrap px-4 py-3">
                      Type
                    </th>
                    <th className="w-28 min-w-28 whitespace-nowrap px-4 py-3 text-right">
                      Table Bill
                    </th>
                    <th className="w-28 min-w-28 whitespace-nowrap px-4 py-3 text-right">
                      Cafe Bill
                    </th>
                    <th className="w-28 min-w-28 whitespace-nowrap px-4 py-3 text-right">
                      Accessories
                    </th>
                    <th className="w-28 min-w-28 whitespace-nowrap px-4 py-3 text-right">
                      Total
                    </th>
                    <th className="w-24 min-w-24 whitespace-nowrap px-4 py-3 text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {openAccounts.map(
                    (account) => {
                      const runningTable =
                        getRunningTableForAccount(
                          account
                        );
                      const timestamp = getBillTimestamp(account);
                      const totals = getBillTotals(account);
                      const selected =
                        selectedAccount?.id === account.id;
                      const tableLabel =
                        getBillTableLabel(account) ||
                        runningTable?.name ||
                        "—";

                      return (
                        <tr
                          key={account.id}
                          tabIndex={0}
                          onClick={() => openBill(account)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              openBill(account);
                            }
                          }}
                          className={`cursor-pointer border-l-4 transition focus:outline-none focus:ring-2 focus:ring-inset focus:ring-amber-300 ${
                            selected
                              ? "border-l-amber-500 bg-amber-50/80 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.22)]"
                              : "border-l-transparent bg-white hover:bg-amber-50/40"
                          }`}
                        >
                          <td className="whitespace-nowrap px-4 py-3 align-middle font-mono text-sm font-semibold text-slate-950">
                              {getBillPrimaryLabel(
                                account
                              )}
                          </td>
                          <td className="px-4 py-3 align-middle">
                            <p className="font-semibold text-slate-950">
                              {getDisplayCustomerLabel(account)}
                            </p>
                            <p className="text-xs text-slate-500">
                              {tableLabel}
                            </p>
                            {runningTable && (
                              <p className="mt-1 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
                                Running - {runningTable.name}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 align-middle">
                            <span className="block whitespace-nowrap font-medium text-slate-700">
                              {formatShortDate(timestamp)}
                            </span>
                            <span className="block whitespace-nowrap text-xs text-slate-500">
                              {formatTime(timestamp)}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 align-middle">
                            {getBillTypeLabel(account)}
                          </td>
                          <td className="px-4 py-3 text-right align-middle tabular-nums">
                            {formatAmountOrDash(account.totalGameAmount)}
                          </td>
                          <td className="px-4 py-3 text-right align-middle tabular-nums">
                            {formatAmountOrDash(totals.cafeTotal)}
                          </td>
                          <td className="px-4 py-3 text-right align-middle tabular-nums">
                            {formatAmountOrDash(totals.accessoryTotal)}
                          </td>
                          <td className="px-4 py-3 text-right align-middle font-bold tabular-nums text-slate-950">
                            {formatCurrency(totals.grandTotal)}
                          </td>
                          <td className="px-4 py-3 text-right align-middle">
                            <Button
                              size="sm"
                              variant={selected ? "outline" : "default"}
                              className="min-w-20"
                              onClick={(event) => {
                                event.stopPropagation();
                                openBill(account);
                              }}
                            >
                              {selected ? "Selected" : "View"}
                            </Button>
                          </td>
                        </tr>
                      );
                    }
                  )}

                  {openAccounts.length === 0 && (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-4 py-10 text-center text-slate-500"
                      >
                        No open customer bills.
                      </td>
                      </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-5 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
            {selectedAccount ? (
              <div>
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-500">
                      Open Bill
                    </p>
                    {isEditingCustomer ? (
                      <div className="mt-2 grid gap-2">
                        <Input
                          value={editName}
                          onChange={(event) =>
                            setEditName(
                              event.target.value
                            )
                          }
                          placeholder="Customer name"
                        />
                        <Input
                          value={editNote}
                          onChange={(event) =>
                            setEditNote(
                              event.target.value
                            )
                          }
                          placeholder="Note e.g. black shirt"
                        />
                        <Input
                          value={editPhone}
                          onChange={(event) =>
                            setEditPhone(
                              event.target.value
                            )
                          }
                          placeholder="Phone optional"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={
                              handleSaveCustomer
                            }
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditName(
                                selectedAccount.customerName
                              );
                              setEditNote(
                                selectedAccount.customerNote ??
                                  ""
                              );
                              setEditPhone(
                                selectedAccount.phone ??
                                  ""
                              );
                              setIsEditingCustomer(false);
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <h2 className="text-xl font-bold text-slate-950">
                          {getBillPrimaryLabel(
                            selectedAccount
                          )}
                        </h2>
                        <p className="text-sm text-slate-500">
                          {getDisplayCustomerLabel(selectedAccount)}
                          {getBillTableLabel(selectedAccount)
                            ? ` · ${getBillTableLabel(selectedAccount)}`
                            : ""}
                        </p>
                        {selectedRunningTable && (
                          <p className="mt-1 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
                            Running - {selectedRunningTable.name}
                          </p>
                        )}
                        {selectedAccount.customerNote && (
                          <p className="text-sm text-slate-500">
                            {
                              selectedAccount.customerNote
                            }
                          </p>
                        )}
                        {selectedAccount.phone && (
                          <p className="text-sm text-slate-500">
                            {
                              selectedAccount.phone
                            }
                          </p>
                        )}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9 gap-2 px-3"
                            onClick={() => {
                              setEditName(
                                selectedAccount.customerName
                              );
                              setEditNote(
                                selectedAccount.customerNote ??
                                  ""
                              );
                              setEditPhone(
                                selectedAccount.phone ??
                                  ""
                              );
                              setIsEditingCustomer(true);
                            }}
                          >
                            Edit Customer
                          </Button>
                          <Button
                            size="sm"
                            className="h-9 gap-2 bg-emerald-950 px-3 hover:bg-emerald-900"
                            onClick={() =>
                              navigate(
                                `/operator/cafe?customerBillId=${selectedAccount.id}`
                              )
                            }
                          >
                            <Coffee className="h-4 w-4" />
                            Add Cafe Order
                          </Button>
                          <Button
                            size="sm"
                            className="h-9 gap-2 bg-slate-950 px-3 hover:bg-slate-900"
                            onClick={() =>
                              navigate(
                                `/operator/accessories?customerBillId=${selectedAccount.id}`
                              )
                            }
                          >
                            <Package className="h-4 w-4" />
                            Add Accessories
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="whitespace-nowrap rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-200">
                      Awaiting Payment
                    </div>
                    {selectedBillAge && (
                      <p className="mt-1 text-xs text-slate-500">
                        {selectedBillAge}
                      </p>
                    )}
                  </div>
                </div>

                <section className="mb-5 rounded-xl border bg-slate-50 p-4">
                  <h3 className="mb-3 text-sm font-bold text-slate-900">
                    Session Time
                  </h3>
                  <div className="grid gap-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto_auto_minmax(7rem,auto)]">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase text-slate-500">
                        Date
                      </p>
                      <p className="mt-1 font-semibold text-slate-900">
                        {selectedSessionSummary?.date ??
                          "Unavailable"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-500">
                        Started
                      </p>
                      <p className="mt-1 whitespace-nowrap font-semibold text-slate-900">
                        {selectedSessionSummary?.started ??
                          "Unavailable"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-500">
                        Ended
                      </p>
                      <p className="mt-1 whitespace-nowrap font-semibold text-slate-900">
                        {selectedSessionSummary?.ended ??
                          "Unavailable"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-500">
                        Duration
                      </p>
                      <p className="mt-1 whitespace-nowrap font-semibold text-slate-900">
                        {selectedSessionSummary?.duration ??
                          "Unavailable"}
                      </p>
                    </div>
                  </div>
                </section>

                <section className="mb-5">
                  <h3 className="mb-2 font-bold">
                    Sessions
                  </h3>
                  <div className="space-y-2">
                    {selectedAccount.gameCharges.map(
                      (charge, index) => (
                        <div
                          key={charge.id}
                          className="rounded-lg border bg-white p-3 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-950">
                                {charge.sessionType === "time"
                                  ? "Time Charge"
                                  : `Game ${index + 1} · ${getChargeTypeLabel(charge.sessionType)}`}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {formatTime(
                                  charge.startedAt
                                )}{" "}
                                –
                                {formatTime(
                                  charge.endedAt
                                )}{" "}
                                |{" "}
                                {formatDuration(
                                  charge.startedAt,
                                  charge.endedAt,
                                  charge.durationMinutes
                                )}
                              </p>
                              <p className="mt-1 text-sm text-slate-600">
                                {charge.loserName
                                  ? `${formatCustomerDisplayName(charge.loserName)} lost`
                                  : formatCustomerDisplayName(charge.payerName)}
                              </p>
                            </div>
                            <p className="shrink-0 font-bold text-slate-950">
                              {formatCurrency(charge.amount)}
                            </p>
                          </div>
                        </div>
                      )
                    )}

                    {selectedAccount.gameCharges
                      .length === 0 && (
                      <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
                        No game charges.
                      </p>
                    )}
                  </div>
                </section>

                <section className="mb-5">
                  <h3 className="mb-2 font-bold">
                    Cafe Charges
                  </h3>
                  <div className="space-y-2">
                    {getCafeCharges(selectedAccount).map(
                      (charge) => (
                        <div
                          key={charge.id}
                          className="flex justify-between rounded-lg border bg-slate-50 p-3"
                        >
                          <div>
                            <p className="font-semibold">
                              {charge.name}
                            </p>
                            <p className="text-xs text-slate-500">
                              {charge.quantity} × {formatCurrency(charge.price)}
                            </p>
                          </div>
                          <p className="font-bold">
                            {formatCurrency(charge.subtotal)}
                          </p>
                        </div>
                      )
                    )}

                    {getCafeCharges(selectedAccount)
                      .length === 0 && (
                      <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
                        No cafe charges.
                      </p>
                    )}
                  </div>
                </section>

                <section className="mb-5">
                  <h3 className="mb-2 font-bold">
                    Accessories Charges
                  </h3>
                  <div className="space-y-2">
                    {getAccessoryCharges(selectedAccount).map(
                      (charge) => (
                        <div
                          key={charge.id}
                          className="flex justify-between rounded-lg border bg-indigo-50 p-3"
                        >
                          <div>
                            <p className="font-semibold">
                              {charge.name.replace(
                                "[Accessory]",
                                ""
                              ).trim()}
                            </p>
                            <p className="text-xs text-slate-500">
                              {charge.quantity} × {formatCurrency(charge.price)}
                            </p>
                          </div>
                          <p className="font-bold">
                            {formatCurrency(charge.subtotal)}
                          </p>
                        </div>
                      )
                    )}

                    {getAccessoryCharges(selectedAccount)
                      .length === 0 && (
                      <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
                        No accessories charges.
                      </p>
                    )}
                  </div>
                </section>

                <div className="sticky bottom-0 -mx-5 space-y-2 border-t bg-white px-5 py-4 text-sm shadow-[0_-10px_24px_rgba(15,23,42,0.08)]">
                  <div className="flex justify-between">
                    <span>Table Charges</span>
                    <strong>
                      {formatCurrency(selectedAccount.totalGameAmount)}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Cafe Charges</span>
                    <strong>
                      {formatCurrency(selectedTotals?.cafeTotal ?? 0)}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Accessories</span>
                    <strong>
                      {formatCurrency(selectedTotals?.accessoryTotal ?? 0)}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Discount</span>
                    <div className="flex items-center gap-2">
                      <Input
                        className="h-9 w-24"
                        type="number"
                        min={0}
                        value={discountText}
                        onChange={(event) =>
                          setDiscountText(
                            event.target.value
                          )
                        }
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={
                          handleApplyDiscount
                        }
                      >
                        Apply
                      </Button>
                    </div>
                  </div>
                  <div className="flex justify-between border-t pt-3 text-lg">
                    <span className="font-bold">
                      Grand Total
                    </span>
                    <strong className="text-xl text-slate-950">
                      {formatCurrency(selectedTotals?.grandTotal ?? 0)}
                    </strong>
                  </div>
                </div>

                <div className="mt-5 rounded-xl border bg-slate-50 p-4">
                  <label className="text-sm font-semibold text-slate-700">
                    Payment Method
                  </label>
                  <PaymentMethodSelector
                    value={paymentMethod}
                    onChange={(value) =>
                      setPaymentMethod(value)
                    }
                    totalAmount={
                      selectedTotals?.grandTotal ?? 0
                    }
                    splits={paymentSplits}
                    onSplitsChange={
                      setPaymentSplits
                    }
                  />

                  <Button
                    className="mt-3 w-full gap-2"
                    onClick={
                      handleReceivePayment
                    }
                    disabled={
                      !!selectedRunningTable &&
                      (selectedRunningTable.status ===
                        "running" ||
                        selectedRunningTable.status ===
                          "paused")
                    }
                  >
                    <ReceiptText className="h-4 w-4" />
                    {selectedRunningTable &&
                    (selectedRunningTable.status ===
                      "running" ||
                      selectedRunningTable.status ===
                        "paused")
                      ? `Still Playing on ${selectedRunningTable.name}`
                      : `Receive Payment${
                          paymentSplits.length >
                          0
                            ? " - Split Payment"
                            : ` - ${paymentLabel(
                                paymentMethod
                              )}`
                        }`}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[360px] items-center justify-center text-center">
                <div>
                  <ReceiptText className="mx-auto h-10 w-10 text-slate-300" />
                  <h2 className="mt-3 font-bold">
                    No open bill selected
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Open customer bills will appear here.
                  </p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </main>
  );
}

export default CustomerBillsPage;
