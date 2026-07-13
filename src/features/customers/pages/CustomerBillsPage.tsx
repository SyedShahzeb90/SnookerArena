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
  getBillCustomerLabel,
  getBillPrimaryLabel,
  getBillSecondaryLabel,
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

function formatDate(value?: string) {
  if (!value) return "-";

  return new Date(value).toLocaleString();
}

function formatShortDate(value?: string) {
  if (!value) return "-";

  return new Date(value).toLocaleDateString(
    undefined,
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  );
}

function formatTime(value?: string) {
  if (!value) return "-";

  return new Date(value).toLocaleTimeString(
    undefined,
    {
      hour: "numeric",
      minute: "2-digit",
    }
  );
}

function formatDuration(minutes?: number) {
  if (!minutes || minutes <= 0) return "-";

  const totalMinutes = Math.round(minutes);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  if (hours > 0 && mins > 0) {
    return `${hours}h ${mins}m`;
  }

  if (hours > 0) {
    return `${hours}h`;
  }

  return `${mins} min`;
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
    duration:
      charges.length > 1
        ? `${formatDuration(totalDuration)} total`
        : formatDuration(totalDuration),
  };
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
          ...account.gameCharges.map(
            (charge) =>
              `${charge.tableName} ${charge.payerName} ${charge.loserName ?? ""} ${charge.winnerName ?? ""}`
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
                {totals.count}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-slate-500">
                Unpaid Amount
              </p>
              <p className="mt-1 text-2xl font-bold text-amber-700">
                Rs. {totals.amount}
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
                placeholder="Search customer, token, note, table..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">
                      Customer
                    </th>
                    <th className="px-4 py-3">
                      Date
                    </th>
                    <th className="px-4 py-3">
                      Started
                    </th>
                    <th className="px-4 py-3">
                      Ended
                    </th>
                    <th className="px-4 py-3">
                      Duration
                    </th>
                    <th className="px-4 py-3">
                      Games
                    </th>
                    <th className="px-4 py-3">
                      Cafe
                    </th>
                    <th className="px-4 py-3">
                      Total
                    </th>
                    <th className="px-4 py-3">
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
                      const sessionSummary =
                        getSessionSummary(account);

                      return (
                        <tr
                          key={account.id}
                          className={
                            selectedAccount?.id ===
                            account.id
                              ? "bg-amber-50/60"
                              : "bg-white"
                          }
                        >
                          <td className="px-4 py-3">
                            <p className="font-bold text-slate-950">
                              {getBillPrimaryLabel(
                                account
                              )}
                            </p>
                            {getBillPrimaryLabel(account) !==
                              account.customerToken && (
                              <p className="text-xs text-slate-500">
                                {account.customerToken}
                              </p>
                            )}
                            <p className="text-xs text-slate-500">
                              {getBillSecondaryLabel(
                                account
                              )}
                            </p>
                            {runningTable && (
                              <p className="mt-1 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
                                Running - {runningTable.name}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {sessionSummary.date}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {sessionSummary.started}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {sessionSummary.ended}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {sessionSummary.duration}
                          </td>
                          <td className="px-4 py-3">
                            <p>
                              {account.gameCharges.length} games
                            </p>
                            <p className="font-semibold">
                              Rs. {account.totalGameAmount}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <p>
                              {getCafeCharges(account).length} cafe
                              {" / "}
                              {getAccessoryCharges(account).length} acc.
                            </p>
                            <p className="font-semibold">
                              Rs.{" "}
                              {getBillTotals(account).cafeTotal +
                                getBillTotals(account).accessoryTotal}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-base font-bold">
                            Rs. {getBillTotals(account).grandTotal}
                          </td>
                          <td className="px-4 py-3">
                            <Button
                              size="sm"
                              onClick={() => openBill(account)}
                            >
                              Open Bill
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

          <Card className="p-5">
            {selectedAccount ? (
              <div>
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
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
                          {getBillCustomerLabel(
                            selectedAccount
                          )}
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
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2"
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
                          className="ml-2 mt-2 gap-2 bg-emerald-950 hover:bg-emerald-900"
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
                          className="ml-2 mt-2 gap-2 bg-slate-950 hover:bg-slate-900"
                          onClick={() =>
                            navigate(
                              `/operator/accessories?customerBillId=${selectedAccount.id}`
                            )
                          }
                        >
                          <Package className="h-4 w-4" />
                          Add Accessories
                        </Button>
                      </>
                    )}
                  </div>
                  <div className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-200">
                    Unpaid
                  </div>
                </div>

                <section className="mb-5 rounded-xl border bg-slate-50 p-4">
                  <h3 className="mb-3 font-bold">
                    Session Time
                  </h3>
                  <div className="grid gap-3 text-sm sm:grid-cols-4">
                    <div>
                      <p className="text-slate-500">
                        Date
                      </p>
                      <p className="font-semibold">
                        {selectedSessionSummary?.date ??
                          "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">
                        Started
                      </p>
                      <p className="font-semibold">
                        {selectedSessionSummary?.started ??
                          "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">
                        Ended
                      </p>
                      <p className="font-semibold">
                        {selectedSessionSummary?.ended ??
                          "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">
                        Duration
                      </p>
                      <p className="font-semibold">
                        {selectedSessionSummary?.duration ??
                          "-"}
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
                          className="rounded-lg border bg-slate-50 p-3"
                        >
                          <div className="flex justify-between gap-3">
                            <div>
                              <p className="font-semibold">
                                {index + 1}.{" "}
                                {charge.tableName} |{" "}
                                {charge.sessionType}
                              </p>
                              <p className="text-xs text-slate-500">
                                {formatShortDate(
                                  charge.startedAt
                                )}{" "}
                                |{" "}
                                {formatTime(
                                  charge.startedAt
                                )}{" "}
                                -{" "}
                                {formatTime(
                                  charge.endedAt
                                )}{" "}
                                |{" "}
                                {formatDuration(
                                  charge.durationMinutes
                                )}
                              </p>
                              <p className="mt-1 text-sm text-slate-600">
                                {charge.loserName
                                  ? `${charge.loserName} lost`
                                  : charge.payerName}
                              </p>
                            </div>
                            <p className="font-bold">
                              Rs. {charge.amount}
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
                              {charge.name} x
                              {charge.quantity}
                            </p>
                            <p className="text-xs text-slate-500">
                              {formatDate(
                                charge.orderedAt
                              )}
                            </p>
                          </div>
                          <p className="font-bold">
                            Rs.{" "}
                            {charge.subtotal}
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
                              ).trim()}{" "}
                              x{charge.quantity}
                            </p>
                            <p className="text-xs text-slate-500">
                              {formatDate(
                                charge.orderedAt
                              )}
                            </p>
                          </div>
                          <p className="font-bold">
                            Rs. {charge.subtotal}
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

                <div className="space-y-2 border-t pt-4 text-sm">
                  <div className="flex justify-between">
                    <span>Game Total</span>
                    <strong>
                      Rs.{" "}
                      {
                        selectedAccount.totalGameAmount
                      }
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Cafe Total</span>
                    <strong>
                      Rs.{" "}
                      {
                        selectedTotals?.cafeTotal ?? 0
                      }
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Accessories Total</span>
                    <strong>
                      Rs.{" "}
                      {selectedTotals?.accessoryTotal ?? 0}
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
                    <strong>
                      Rs.{" "}
                      {selectedTotals?.grandTotal ?? 0}
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
