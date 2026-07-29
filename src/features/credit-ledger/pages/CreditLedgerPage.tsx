import {
  ArrowLeft,
  ReceiptText,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageShell } from "@/components/layout/page-layout";
import { Input } from "@/components/ui/input";
import PaymentMethodSelector from "@/features/billing/components/PaymentMethodSelector";
import { useBusinessDayStore } from "@/features/business-day/store/businessDayStore";
import { useSalesStore } from "@/features/sales/store/salesStore";
import { useAdvanceGamesStore } from "@/features/advance-games/store/advanceGamesStore";
import { buildAdvanceGameBalanceRows } from "@/features/advance-games/utils/advanceGameBalances";
import { useCustomerAccountStore } from "@/features/customers/store/customerAccountStore";
import { useTableHistoryStore } from "@/features/table-history/store/tableHistoryStore";
import { getIndividualGameCharges } from "@/features/customers/utils/individualGameCharges";
import type {
  PaymentMethod,
  SessionType,
} from "@/types/session";
import type { PaymentSplit } from "@/features/sales/types/sale";
import {
  compareChargeTimestamps,
  formatAppDateTime,
  formatChargeDuration,
  formatChargeTimeRange,
  useAppDateTimeFormats,
} from "@/lib/dateTime";
import {
  type CreditLedgerEntry,
  type CreditLedgerStatus,
  useCreditLedgerStore,
} from "../store/creditLedgerStore";

type StatusFilter =
  | "outstanding"
  | "paid"
  | "cancelled"
  | "all";

function money(value: number) {
  return `Rs. ${Math.round(value).toLocaleString()}`;
}

function formatDateTime(value?: string) {
  return formatAppDateTime(value);
}

function statusLabel(status: CreditLedgerStatus) {
  if (status === "outstanding") return "Outstanding";
  if (status === "paid") return "Paid";
  return "Cancelled";
}

function CreditLedgerPage() {
  useAppDateTimeFormats();
  const navigate = useNavigate();
  const location = useLocation();
  const entries = useCreditLedgerStore(
    (state) => state.entries
  );
  const markCreditPaid = useCreditLedgerStore(
    (state) => state.markCreditPaid
  );
  const updateCreditCustomer =
    useCreditLedgerStore(
      (state) => state.updateCreditCustomer
    );
  const cancelCredit = useCreditLedgerStore(
    (state) => state.cancelCredit
  );
  const activeBusinessDay =
    useBusinessDayStore((state) =>
      state.getActiveBusinessDay()
    );
  const salesStore = useSalesStore();
  const advanceTransactions = useAdvanceGamesStore((state) => state.transactions);
  const pendingAdvanceAwards = useAdvanceGamesStore(
    (state) => state.pendingAwards ?? []
  );
  const releasePendingAwardsForSession =
    useAdvanceGamesStore(
      (state) =>
        state.releasePendingAwardsForSession
    );
  const cancelAwardsForSession =
    useAdvanceGamesStore(
      (state) =>
        state.cancelAwardsForSession
    );
  const safeAdvanceTransactions = Array.isArray(advanceTransactions) ? advanceTransactions : [];
  const transferAdvanceGames = useAdvanceGamesStore((state) => state.transfer);
  const customersInClub = useAdvanceGamesStore((state) => state.customersInClub ?? {});
  const setCustomerInClub = useAdvanceGamesStore((state) => state.setCustomerInClub);
  const customerAccounts = useCustomerAccountStore((state) => state.accounts);
  const tableHistoryRecords = useTableHistoryStore((state) => state.records);

  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("outstanding");
  const [search, setSearch] = useState("");
  const [selectedEntryId, setSelectedEntryId] =
    useState<string | null>(null);
  const [paymentEntryId, setPaymentEntryId] =
    useState<string | null>(null);
  const [cancelEntryId, setCancelEntryId] =
    useState<string | null>(null);
  const [editEntryId, setEditEntryId] =
    useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [cancelReason, setCancelReason] =
    useState("");
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("cash");
  const [paymentSplits, setPaymentSplits] =
    useState<PaymentSplit[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [ledgerTab, setLedgerTab] = useState<"credit" | "advance">("credit");
  const [senderId, setSenderId] = useState("");
  const [receiverId, setReceiverId] = useState("");
  const [transferGames, setTransferGames] = useState("1");
  const [transferNote, setTransferNote] = useState("");

  useEffect(() => {
    setLedgerTab(
      location.hash === "#advance-games"
        ? "advance"
        : "credit"
    );
  }, [location.hash]);

  useEffect(() => {
    const pendingSessionIds = [
      ...new Set(
        pendingAdvanceAwards.map(
          (award) => award.sessionId
        )
      ),
    ];

    pendingSessionIds.forEach((sessionId) => {
      const linkedAccounts =
        customerAccounts.filter((account) =>
          account.gameCharges.some(
            (charge) =>
              charge.sessionId === sessionId
          )
        );

      if (linkedAccounts.length === 0) {
        cancelAwardsForSession(sessionId);
        return;
      }

      const hasOutstandingBill =
        linkedAccounts.some((account) => {
          if (
            account.paymentStatus !== "unpaid" ||
            account.cancelledAt ||
            account.grandTotal <= 0 ||
            !account.gameCharges.some(
              (charge) =>
                charge.sessionId === sessionId
            )
          ) {
            return false;
          }

          const creditEntry = entries.find(
            (entry) =>
              entry.sourceCustomerAccountId ===
                account.id &&
              entry.status !== "cancelled"
          );

          return creditEntry
            ? creditEntry.status === "outstanding"
            : true;
        });

      if (!hasOutstandingBill) {
        releasePendingAwardsForSession(sessionId);
      }
    });

    const orphanedReleasedSessionIds = [
      ...new Set(
        safeAdvanceTransactions
          .filter(
            (transaction) =>
              transaction.type === "earned" &&
              transaction.sessionId &&
              transaction.relatedBillId?.startsWith(
                "ADVANCE-SESSION:"
              ) &&
              !customerAccounts.some((account) =>
                account.gameCharges.some(
                  (charge) =>
                    charge.sessionId ===
                    transaction.sessionId
                )
              ) &&
              tableHistoryRecords.find(
                (record) =>
                  record.sessionId ===
                  transaction.sessionId
              )?.paymentStatus !== "paid"
          )
          .map(
            (transaction) =>
              transaction.sessionId as string
          )
      ),
    ];

    orphanedReleasedSessionIds.forEach(
      cancelAwardsForSession
    );
  }, [
    cancelAwardsForSession,
    customerAccounts,
    entries,
    pendingAdvanceAwards,
    releasePendingAwardsForSession,
    safeAdvanceTransactions,
    tableHistoryRecords,
  ]);

  const advanceBalances = useMemo(() => {
    return buildAdvanceGameBalanceRows(
      safeAdvanceTransactions,
      pendingAdvanceAwards
    );
  }, [pendingAdvanceAwards, safeAdvanceTransactions]);

  const advanceHistoryRows = useMemo(() => {
    const rows = new Map<
      string,
      (typeof safeAdvanceTransactions)[number]
    >();

    safeAdvanceTransactions.forEach((item) => {
      const sourceId =
        item.sessionId ??
        item.relatedBillId ??
        item.transferId ??
        item.id;
      const key = [
        item.customerId,
        item.type,
        sourceId,
        item.tableId ?? "",
      ].join("|");
      const current = rows.get(key);

      if (current) {
        rows.set(key, {
          ...current,
          games: current.games + item.games,
          balanceDelta:
            current.balanceDelta + item.balanceDelta,
        });
        return;
      }

      rows.set(key, { ...item });
    });

    return [...rows.values()];
  }, [safeAdvanceTransactions]);

  const submitTransfer = () => {
    setError("");
    setMessage("");
    const sender = customerAccounts.find((item) => item.id === senderId);
    const receiver = customerAccounts.find((item) => item.id === receiverId);
    const games = Number(transferGames);
    if (!sender || !receiver || sender.id === receiver.id || !Number.isInteger(games) || games < 1) {
      setError("Choose two different customers and enter a positive whole number.");
      return;
    }
    const ok = transferAdvanceGames({
      transferId: `ADV-TRANSFER-${Date.now()}`,
      senderId: sender.id,
      senderName: sender.customerName,
      receiverId: receiver.id,
      receiverName: receiver.customerName,
      games,
      note: transferNote,
    });
    if (!ok) {
      setError("Transfer failed. Check the sender's available balance.");
      return;
    }
    setMessage(`${games} advance game${games === 1 ? "" : "s"} transferred.`);
    setTransferGames("1");
    setTransferNote("");
  };

  const filteredEntries = useMemo(() => {
    const query = search.trim().toLowerCase();

    return entries
      .filter((entry) =>
        statusFilter === "all"
          ? true
          : entry.status === statusFilter
      )
      .filter((entry) => {
        if (!query) return true;

        return [
          entry.customerName,
          entry.customerNote,
          entry.phone,
          entry.originalBillNumber,
          entry.tableName,
          entry.creditNote,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort(
        (a, b) =>
          new Date(b.creditedAt).getTime() -
          new Date(a.creditedAt).getTime()
      );
  }, [entries, search, statusFilter]);

  const selectedEntry = entries.find(
    (entry) => entry.id === selectedEntryId
  );
  const paymentEntry = entries.find(
    (entry) => entry.id === paymentEntryId
  );
  const cancelEntry = entries.find(
    (entry) => entry.id === cancelEntryId
  );
  const editEntry = entries.find(
    (entry) => entry.id === editEntryId
  );

  const outstandingEntries = entries.filter(
    (entry) => entry.status === "outstanding"
  );
  const paidEntries = entries.filter(
    (entry) => entry.status === "paid"
  );
  const recoveredToday = paidEntries
    .filter(
      (entry) =>
        entry.paidAt &&
        new Date(entry.paidAt).toDateString() ===
          new Date().toDateString()
    )
    .reduce(
      (total, entry) => total + entry.finalAmount,
      0
    );
  const totalRecovered = paidEntries.reduce(
    (total, entry) => total + entry.finalAmount,
    0
  );

  const receivePayment = () => {
    setError("");
    setMessage("");

    if (!paymentEntry) return;

    if (paymentEntry.status !== "outstanding") {
      setError("This credit is not outstanding.");
      return;
    }

    if (!activeBusinessDay) {
      setError("Start the business day before receiving payment.");
      return;
    }

    const cleanedSplits = paymentSplits.filter(
      (split) => split.amount > 0
    );
    const splitTotal = cleanedSplits.reduce(
      (total, split) => total + split.amount,
      0
    );

    if (
      cleanedSplits.length > 0 &&
      splitTotal !== paymentEntry.finalAmount
    ) {
      setError(
        `Split payment total must be ${money(paymentEntry.finalAmount)}.`
      );
      return;
    }

    const invoiceNumber =
      salesStore.getNextInvoiceNumber();
    const saleId = `SALE-${invoiceNumber}-CREDIT-${paymentEntry.id}`;
    const now = new Date().toISOString();

    salesStore.addSale({
      id: saleId,
      invoiceNumber,
      tableId:
        paymentEntry.gameCharges[0]?.tableId ?? 0,
      tableName: paymentEntry.tableName ?? "-",
      saleType: "customer_bill",
      sessionId: paymentEntry.id,
      players: [{ name: paymentEntry.customerName }],
      sessionType:
        (paymentEntry.gameCharges[0]?.sessionType as SessionType | undefined) ??
        "time",
      payerName: paymentEntry.customerName,
      startedAt: paymentEntry.openedAt,
      endedAt: now,
      durationMinutes: 0,
      createdAt: now,
      paidAt: now,
      tableAmount: paymentEntry.tableTotal,
      cafeAmount:
        paymentEntry.cafeTotal +
        paymentEntry.accessoryTotal,
      subtotal:
        paymentEntry.tableTotal +
        paymentEntry.cafeTotal +
        paymentEntry.accessoryTotal,
      discount: paymentEntry.discount,
      grandTotal: paymentEntry.finalAmount,
      paymentMethod,
      paymentSplits:
        cleanedSplits.length > 0
          ? cleanedSplits
          : undefined,
      paymentStatus: "paid",
      activeBusinessDayId: activeBusinessDay.id,
      orderedItems: [
        ...paymentEntry.cafeCharges,
        ...paymentEntry.accessoryCharges,
      ].map((charge) => ({
        menuItemId: charge.itemId,
        name: charge.name,
        price: charge.price,
        quantity: charge.quantity,
        subtotal: charge.subtotal,
        timeAdded: new Date(charge.orderedAt),
        tableId: charge.tableId,
        sessionId: charge.sessionId,
        customerName: charge.customerName,
        playerName: charge.customerName,
        orderedAt: charge.orderedAt,
      })),
      customerAccountId:
        paymentEntry.sourceCustomerAccountId,
      customerToken:
        paymentEntry.sourceCustomerToken,
      customerName: paymentEntry.customerName,
      customerNote: paymentEntry.customerNote,
      gameCharges: paymentEntry.gameCharges,
      cafeCharges: [
        ...paymentEntry.cafeCharges,
        ...paymentEntry.accessoryCharges,
      ],
    });

    markCreditPaid({
      id: paymentEntry.id,
      paymentMethod,
      paymentSplits:
        cleanedSplits.length > 0
          ? cleanedSplits
          : undefined,
      paymentBusinessDayId: activeBusinessDay.id,
      saleId,
    });

    setPaymentEntryId(null);
    setPaymentSplits([]);
    setPaymentMethod("cash");
    setMessage("Credit payment received.");
  };

  const confirmCancel = () => {
    if (!cancelEntry) return;
    const reason = cancelReason.trim();
    if (!reason) {
      setError("Enter a reason before cancelling credit.");
      return;
    }

    cancelCredit(cancelEntry.id, reason);
    const advanceGamesStore =
      useAdvanceGamesStore.getState();
    advanceGamesStore.cancelPendingAwardsForBill(
      cancelEntry.sourceCustomerAccountId
    );
    [
      ...new Set(
        cancelEntry.gameCharges.map(
          (charge) => charge.sessionId
        )
      ),
    ].forEach((sessionId) =>
      advanceGamesStore.cancelPendingAwardsForSession(
        sessionId
      )
    );
    setCancelEntryId(null);
    setCancelReason("");
    setMessage("Credit cancelled.");
  };

  const openEditCustomer = (
    entry: CreditLedgerEntry
  ) => {
    setEditEntryId(entry.id);
    setEditName(entry.customerName);
    setEditNote(entry.customerNote ?? "");
    setEditPhone(entry.phone ?? "");
    setError("");
  };

  const saveCreditCustomer = () => {
    if (!editEntry) return;

    const name = editName.trim();

    if (!name) {
      setError("Customer name is required.");
      return;
    }

    updateCreditCustomer(editEntry.id, {
      customerName: name,
      customerNote: editNote,
      phone: editPhone,
    });

    setEditEntryId(null);
    setMessage("Credit customer updated.");
    setError("");
  };

  const renderItems = (
    title: string,
    items: Array<
      CreditLedgerEntry["cafeCharges"][number]
    >
  ) => (
    <section>
      <h3 className="font-bold">{title}</h3>
      <div className="mt-2 space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">None</p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex justify-between rounded-lg border bg-slate-50 px-3 py-2 text-sm"
            >
              <span>
                {item.name} x{item.quantity} @ Rs. {item.price}
              </span>
              <strong>{money(item.subtotal)}</strong>
            </div>
          ))
        )}
      </div>
    </section>
  );

  return (
    <PageShell contentClassName="space-y-0">
      <div>
        <Button
          variant="ghost"
          className="mb-4 gap-2"
          onClick={() => navigate("/operator")}
        >
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Button>

        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">
              {ledgerTab === "advance"
                ? "Advance Games"
                : "Credit Ledger"}
            </h1>
            <p className="text-sm text-slate-500">
              {ledgerTab === "advance"
                ? "Manage advance-game balances, availability, transfers, and history."
                : "Track customer bills moved to credit and recovered later."}
            </p>
          </div>
        </div>

        {message && (
          <p className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">
            {message}
          </p>
        )}
        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-red-200">
            {error}
          </p>
        )}

        <div className={`${ledgerTab === "credit" ? "grid" : "hidden"} mb-5 gap-3 md:grid-cols-4`}>
          {[
            ["Outstanding Customers", outstandingEntries.length],
            [
              "Total Credit Outstanding",
              money(
                outstandingEntries.reduce(
                  (total, entry) =>
                    total + entry.finalAmount,
                  0
                )
              ),
            ],
            ["Recovered Today", money(recoveredToday)],
            ["Total Recovered", money(totalRecovered)],
          ].map(([label, value]) => (
            <Card key={label} className="p-4">
              <p className="text-sm text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-bold text-slate-950">
                {value}
              </p>
            </Card>
          ))}
        </div>

        {ledgerTab === "advance" && (
          <div className="space-y-4">
            <Card className="p-4">
              <h2 className="font-bold">Transfer Advance Games</h2>
              <div className="mt-3 grid gap-2 md:grid-cols-4">
                <select className="rounded-md border bg-white p-2" value={senderId} onChange={(event) => setSenderId(event.target.value)}>
                  <option value="">Sender</option>
                  {customerAccounts.map((item) => <option key={item.id} value={item.id}>{item.customerName} - {advanceBalances.find((balance) => balance.customerId === item.id)?.availableGames ?? 0} games</option>)}
                </select>
                <select className="rounded-md border bg-white p-2" value={receiverId} onChange={(event) => setReceiverId(event.target.value)}>
                  <option value="">Receiver</option>
                  {customerAccounts.filter((item) => item.id !== senderId).map((item) => <option key={item.id} value={item.id}>{item.customerName}</option>)}
                </select>
                <Input type="number" min={1} step={1} value={transferGames} onChange={(event) => setTransferGames(event.target.value.replace(/\D/g, ""))} placeholder="Games" />
                <Button onClick={submitTransfer}>Transfer</Button>
              </div>
              <Input className="mt-2" value={transferNote} onChange={(event) => setTransferNote(event.target.value)} placeholder="Note optional" />
            </Card>
            <Card className="overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Customer</th><th className="px-4 py-3 text-right">Balance</th><th className="px-4 py-3 text-right">Session availability</th></tr></thead>
                <tbody>{advanceBalances.map((item) => <tr key={item.customerId} className="border-t"><td className="px-4 py-3 font-semibold">{item.customerName}</td><td className="px-4 py-3 text-right"><div className="font-bold">{item.availableGames} available</div>{item.pendingGames > 0 && <div className="text-sm font-semibold text-amber-700">Pending: {item.pendingGames}</div>}</td><td className="px-4 py-3"><label className="ml-auto flex w-fit cursor-pointer items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={customersInClub[item.customerId] === true} disabled={item.availableGames <= 0} onChange={(event) => setCustomerInClub(item.customerId, event.target.checked)} /><span className="text-sm font-medium">Show in session list</span></label></td></tr>)}</tbody>
              </table>
              <p className="border-t bg-slate-50 px-4 py-3 text-xs text-slate-500">
                Check this only while the customer is available to play. Unchecking it keeps their advance games saved.
              </p>
            </Card>
            <Card className="overflow-hidden">
              <div className="border-b p-4 font-bold">Advance Games History</div>
              <div className="divide-y">{advanceHistoryRows.map((item) => (
                <div key={item.id} className="grid gap-1 px-4 py-3 text-sm md:grid-cols-5">
                  <strong>{item.customerName}</strong><span>{item.type.replace("_", " ")}</span><span>{item.games} games</span><span>{item.tableName ?? item.relatedBillId ?? "-"}</span><span className="text-slate-500">{formatDateTime(item.createdAt)}</span>
                </div>
              ))}</div>
            </Card>
          </div>
        )}

        <Card className={ledgerTab === "credit" ? "overflow-hidden" : "hidden"}>
          <div className="border-b bg-white p-4">
            <div className="flex items-center gap-2 rounded-lg border px-3">
              <Search className="h-4 w-4 text-slate-400" />
              <Input
                className="border-0 shadow-none focus-visible:ring-0"
                placeholder="Search customer, phone, note, bill no, table..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                ["outstanding", "Outstanding"],
                ["paid", "Paid"],
                ["cancelled", "Cancelled"],
                ["all", "All"],
              ].map(([value, label]) => (
                <Button
                  key={value}
                  size="sm"
                  variant={
                    statusFilter === value
                      ? "default"
                      : "outline"
                  }
                  onClick={() =>
                    setStatusFilter(value as StatusFilter)
                  }
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Original Bill</th>
                  <th className="px-4 py-3">Table</th>
                  <th className="px-4 py-3">Credit Date</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry) => (
                  <tr key={entry.id} className="border-t">
                    <td className="px-4 py-3">
                      <p className="font-semibold">{entry.customerName}</p>
                      <p className="text-xs text-slate-500">
                        {entry.phone ?? entry.customerNote ?? "-"}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {entry.originalBillNumber}
                    </td>
                    <td className="px-4 py-3">{entry.tableName ?? "-"}</td>
                    <td className="px-4 py-3">{formatDateTime(entry.creditedAt)}</td>
                    <td className="px-4 py-3 text-right font-bold">
                      {money(entry.finalAmount)}
                    </td>
                    <td className="px-4 py-3">{statusLabel(entry.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            openEditCustomer(entry)
                          }
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setSelectedEntryId(entry.id)
                          }
                        >
                          View Details
                        </Button>
                        {entry.status === "outstanding" && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => {
                                setPaymentEntryId(entry.id);
                                setError("");
                              }}
                            >
                              Receive Payment
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setCancelEntryId(entry.id);
                                setCancelReason("");
                              }}
                            >
                              Cancel Credit
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredEntries.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-sm text-slate-500"
                    >
                      No credit ledger entries found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {selectedEntry && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
            <Card className="max-h-[90vh] w-full max-w-3xl overflow-y-auto p-5">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold">Credit Details</h2>
                  <p className="text-sm text-slate-500">
                    {selectedEntry.customerName} - {selectedEntry.originalBillNumber}
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setSelectedEntryId(null)}
                >
                  Close
                </Button>
              </div>

              <div className="grid gap-3 text-sm md:grid-cols-2">
                <p><strong>Status:</strong> {statusLabel(selectedEntry.status)}</p>
                <p><strong>Table:</strong> {selectedEntry.tableName ?? "-"}</p>
                <p><strong>Phone:</strong> {selectedEntry.phone ?? "-"}</p>
                <p><strong>Note:</strong> {selectedEntry.customerNote ?? "-"}</p>
                <p><strong>Credit Given:</strong> {formatDateTime(selectedEntry.creditedAt)}</p>
                <p><strong>Credit Note:</strong> {selectedEntry.creditNote ?? "-"}</p>
                <p><strong>Paid At:</strong> {formatDateTime(selectedEntry.paidAt)}</p>
                <p><strong>Sale Ref:</strong> {selectedEntry.saleId ?? "-"}</p>
              </div>

              <section className="mt-5">
                <h3 className="font-bold">Operator activity</h3>
                {selectedEntry.operatorAudit?.length ? (
                  <div className="mt-2 divide-y overflow-hidden rounded-lg border text-sm">
                    {[...selectedEntry.operatorAudit]
                      .sort(
                        (a, b) =>
                          new Date(a.occurredAt).getTime() -
                          new Date(b.occurredAt).getTime(),
                      )
                      .map((event) => (
                        <div
                          key={event.id}
                          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2"
                        >
                          <div>
                            <strong>
                              {event.action === "credit_issued"
                                ? "Credit issued"
                                : event.action === "credit_recovered"
                                  ? "Credit recovered"
                                  : event.action === "cancelled"
                                    ? "Credit cancelled"
                                    : event.action.replace(/_/g, " ")}
                            </strong>{" "}
                            by {event.operator.operatorName}
                            {event.note ? (
                              <p className="mt-0.5 text-xs text-slate-500">
                                {event.note}
                              </p>
                            ) : null}
                          </div>
                          <span className="text-xs text-slate-500">
                            {formatDateTime(event.occurredAt)}
                          </span>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="mt-2 rounded-lg border border-dashed px-3 py-2 text-sm text-slate-500">
                    Operator activity was not recorded for this legacy credit entry.
                  </p>
                )}
              </section>

              <div className="mt-5 space-y-5">
                <section>
                  <h3 className="font-bold">Table / Game Charges</h3>
                  <div className="mt-2 space-y-2">
                    {selectedEntry.gameCharges.length === 0 ? (
                      <p className="text-sm text-slate-500">None</p>
                    ) : (
                      getIndividualGameCharges(selectedEntry.gameCharges, tableHistoryRecords)
                        .slice()
                        .sort(compareChargeTimestamps)
                        .map((charge, index) => (
                        <div
                          key={charge.id}
                          className="rounded-lg border bg-slate-50 px-3 py-2 text-sm"
                        >
                          <div className="flex justify-between gap-3">
                            <strong>
                              {charge.sessionType === "time" ? "Time Charge" : `Game ${index + 1} · ${charge.sessionType === "single" ? "Single Game" : "Double Game"}`}
                            </strong>
                            <strong>{money(charge.amount)}</strong>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            {formatChargeTimeRange(charge.startedAt, charge.endedAt, selectedEntry.gameCharges[0]?.startedAt)} · {formatChargeDuration(charge.startedAt, charge.endedAt)}
                          </p>
                          <p className="mt-1 text-xs text-slate-600">
                            Winner: {charge.winnerName ?? "—"} · Loser: {charge.loserName ?? "—"} · Payer: {charge.payerName ?? "—"}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                {renderItems("Cafe Items", selectedEntry.cafeCharges)}
                {renderItems("Accessories", selectedEntry.accessoryCharges)}

                <div className="space-y-2 border-t pt-4 text-sm">
                  <div className="flex justify-between">
                    <span>Table Total</span>
                    <strong>{money(selectedEntry.tableTotal)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Cafe Total</span>
                    <strong>{money(selectedEntry.cafeTotal)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Accessories Total</span>
                    <strong>{money(selectedEntry.accessoryTotal)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Discount</span>
                    <strong>- {money(selectedEntry.discount)}</strong>
                  </div>
                  <div className="flex justify-between text-lg">
                    <span className="font-bold">Final Credit Amount</span>
                    <strong>{money(selectedEntry.finalAmount)}</strong>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {paymentEntry && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
            <Card className="w-full max-w-md p-5">
              <h2 className="text-xl font-bold">Receive Credit Payment</h2>
              <p className="mt-1 text-sm text-slate-500">
                {paymentEntry.customerName} - {money(paymentEntry.finalAmount)}
              </p>
              <div className="mt-4">
                <PaymentMethodSelector
                  value={paymentMethod}
                  onChange={setPaymentMethod}
                  totalAmount={paymentEntry.finalAmount}
                  splits={paymentSplits}
                  onSplitsChange={setPaymentSplits}
                />
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPaymentEntryId(null)}
                >
                  Cancel
                </Button>
                <Button
                  className="gap-2"
                  onClick={receivePayment}
                >
                  <ReceiptText className="h-4 w-4" />
                  Receive Payment
                </Button>
              </div>
            </Card>
          </div>
        )}

        {editEntry && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
            <Card className="w-full max-w-md p-5">
              <h2 className="text-xl font-bold">
                Edit Credit Customer
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {editEntry.originalBillNumber}
              </p>
              <div className="mt-4 space-y-2">
                <Input
                  value={editName}
                  onChange={(event) =>
                    setEditName(event.target.value)
                  }
                  placeholder="Customer name"
                />
                <Input
                  value={editNote}
                  onChange={(event) =>
                    setEditNote(event.target.value)
                  }
                  placeholder="Note optional"
                />
                <Input
                  value={editPhone}
                  onChange={(event) =>
                    setEditPhone(event.target.value)
                  }
                  placeholder="Phone optional"
                />
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setEditEntryId(null)}
                >
                  Cancel
                </Button>
                <Button onClick={saveCreditCustomer}>
                  Save
                </Button>
              </div>
            </Card>
          </div>
        )}

        {cancelEntry && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
            <Card className="w-full max-w-md p-5">
              <h2 className="text-xl font-bold">Cancel Credit</h2>
              <p className="mt-1 text-sm text-slate-500">
                Reason is required for audit history.
              </p>
              <Input
                className="mt-4"
                value={cancelReason}
                onChange={(event) =>
                  setCancelReason(event.target.value)
                }
                placeholder="Reason"
              />
              <div className="mt-5 flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setCancelEntryId(null)}
                >
                  Keep Credit
                </Button>
                <Button
                  variant="outline"
                  className="border-red-200 text-red-700 hover:bg-red-50"
                  onClick={confirmCancel}
                >
                  Cancel Credit
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </PageShell>
  );
}

export default CreditLedgerPage;
