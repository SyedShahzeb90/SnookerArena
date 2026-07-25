import {
  ArrowLeft,
  Coffee,
  Package,
  ReceiptText,
  Search,
  ShoppingBag,
  Trash2,
  X,
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
import { EmptyState } from "@/components/ui/empty-state";
import { BillContextMenu, type BillContextMenuAction } from "@/components/ui/bill-context-menu";
import { useToast } from "@/components/ui/toast";
import { useBusinessDayStore } from "@/features/business-day/store/businessDayStore";
import { paymentMethodLabels } from "@/features/business-day/types/businessDay";
import { useSalesStore } from "@/features/sales/store/salesStore";
import { useTableStore } from "@/store/tableStore";
import { useCustomerAccountStore } from "../store/customerAccountStore";
import type { CustomerAccount } from "../types/customerAccount";
import type { PaymentMethod } from "@/types/session";
import type { PaymentSplit } from "@/features/sales/types/sale";
import PaymentMethodSelector from "@/features/billing/components/PaymentMethodSelector";
import { useCheckoutStore } from "@/features/billing/store/checkoutStore";
import { useCreditLedgerStore } from "@/features/credit-ledger/store/creditLedgerStore";
import { useAdvanceGamesStore } from "@/features/advance-games/store/advanceGamesStore";
import { useCafeStore } from "@/features/cafe/store/cafeStore";
import { useTableHistoryStore } from "@/features/table-history/store/tableHistoryStore";
import { useClubSettingsStore } from "@/features/settings/store/clubSettingsStore";
import { useAdminModeStore } from "@/features/admin-mode/adminModeStore";
import OutsidePurchaseDialog from "@/features/outside-purchases/components/OutsidePurchaseDialog";
import { useOutsidePurchaseStore } from "@/features/outside-purchases/store/outsidePurchaseStore";
import {
  compareChargeTimestamps,
  formatAppDate,
  formatAppTime,
  formatChargeDuration,
  formatChargeTimeRange,
  useAppDateTimeFormats,
} from "@/lib/dateTime";
import { isWalkInName } from "@/features/sessions/utils/walkInLabel";
import {
  getBillPrimaryLabel,
  getBillTableLabel,
} from "../utils/billDisplay";
import { getIndividualGameCharges } from "../utils/individualGameCharges";

const paymentMethods: {
  value: PaymentMethod;
  label: string;
}[] = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "jazzcash", label: "JazzCash" },
  { value: "easypaisa", label: "Easypaisa" },
];

type DateFilter =
  | "all"
  | "today"
  | "yesterday"
  | "this-month";
type BillTypeFilter =
  | "all"
  | "table"
  | "cafe"
  | "accessories";
type BillStatusFilter =
  | "unpaid"
  | "paid"
  | "cancelled"
  | "all";
type TableFilter = "all" | string;

function getDateRange(filter: DateFilter) {
  if (filter === "all") return undefined;

  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  if (filter === "yesterday") {
    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() - 1);
  }

  if (filter === "this-month") {
    start.setDate(1);
  }

  return { start, end };
}

function formatShortDate(value?: string) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return formatAppDate(date);
}

function formatTime(value?: string) {
  if (!value) return "Unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unavailable";
  }

  return formatAppTime(date);
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
  return getBillPrimaryLabel(account);
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
      Math.min(
        account.discount,
        account.totalGameAmount + cafeTotal
      )
  );

  return {
    cafeTotal,
    accessoryTotal,
    grandTotal,
  };
}

function hasMeaningfulCreditCustomerName(
  account: CustomerAccount
) {
  const name = account.customerName.trim();

  return (
    name.length > 1 &&
    !isWalkInName(name) &&
    !/^c(?:ust(?:omer)?)?[-\s]*\d+$/i.test(name)
  );
}

function getOpenAccountDisplayKey(
  account: CustomerAccount
) {
  const totals = getBillTotals(account);

  return [
    getBillPrimaryLabel(account),
    getBillTableLabel(account),
    account.customerName.trim().toLowerCase(),
    totals.grandTotal,
  ].join("|");
}

function dedupeOpenAccounts(
  accounts: CustomerAccount[]
) {
  const seen = new Set<string>();

  return accounts.filter((account) => {
    const key = getOpenAccountDisplayKey(account);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
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
  return customerIds.includes(account.id);
}

function CustomerBillsPage({ paymentMode = false }: { paymentMode?: boolean }) {
  useAppDateTimeFormats();
  const navigate = useNavigate();
  const toast = useToast();
  const defaultPaymentMethod = useClubSettingsStore(
    (state) => state.settings.defaultPaymentMethod
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const accounts = useCustomerAccountStore(
    (state) => state.accounts
  );
  const tableHistoryRecords = useTableHistoryStore((state) => state.records);
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
  const updatePaidBillPaymentMethod =
    useCustomerAccountStore(
      (state) => state.updatePaidBillPaymentMethod
    );
  const markCustomerBillCredited =
    useCustomerAccountStore(
      (state) => state.markCustomerBillCredited
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
  const addCreditFromCustomerBill =
    useCreditLedgerStore(
      (state) => state.addCreditFromCustomerBill
    );
  const advanceTransactions = useAdvanceGamesStore(
    (state) => state.transactions
  );
  const safeAdvanceTransactions = Array.isArray(advanceTransactions)
    ? advanceTransactions
    : [];
  const applyAdvanceTransaction = useAdvanceGamesStore(
    (state) => state.applyToBill
  );
  const undoAdvanceTransaction = useAdvanceGamesStore(
    (state) => state.undoApplication
  );
  const applyAdvanceGamesToBill = useCustomerAccountStore(
    (state) => state.applyAdvanceGamesToBill
  );
  const undoAdvanceGamesFromBill = useCustomerAccountStore(
    (state) => state.undoAdvanceGamesFromBill
  );
  const markCustomerBillSettledByAdvance = useCustomerAccountStore(
    (state) => state.markCustomerBillSettledByAdvance
  );
  const removePendingBill = useCheckoutStore(
    (state) => state.removePendingBill
  );
  const deleteCustomerAccount = useCustomerAccountStore(
    (state) => state.deleteCustomerAccount
  );
  const deleteSavedOrdersForCustomerAccount = useCafeStore(
    (state) => state.deleteSavedOrdersForCustomerAccount
  );
  const activeBusinessDay =
    useBusinessDayStore((state) =>
      state.getActiveBusinessDay()
    );
  const outsidePurchases = useOutsidePurchaseStore(
    (state) => state.purchases
  );

  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] =
    useState<DateFilter>("all");
  const [billTypeFilter, setBillTypeFilter] =
    useState<BillTypeFilter>("all");
  const [billStatusFilter, setBillStatusFilter] =
    useState<BillStatusFilter>("unpaid");
  const [tableFilter, setTableFilter] =
    useState<TableFilter>("all");
  const [selectedId, setSelectedId] =
    useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    account: CustomerAccount;
    x: number;
    y: number;
  } | null>(null);
  const [contextAccountId, setContextAccountId] = useState<string | null>(null);
  const [discountText, setDiscountText] =
    useState("0");
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>(() =>
      useClubSettingsStore.getState().settings.defaultPaymentMethod
    );
  const canCorrectPayments = useAdminModeStore(
    (state) => state.can("correct_payments")
  );
  const canCancelBills = useAdminModeStore(
    (state) => state.can("cancel_bills")
  );
  const [paymentSplits, setPaymentSplits] =
    useState<PaymentSplit[]>([]);
  const [isEditingPaidPayment, setIsEditingPaidPayment] =
    useState(false);
  const [correctedPaymentMethod, setCorrectedPaymentMethod] =
    useState<PaymentMethod>("cash");
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
  const [payingCustomerId, setPayingCustomerId] =
    useState<string | null>(null);
  const [isCreditDialogOpen, setIsCreditDialogOpen] =
    useState(false);
  const [creditNote, setCreditNote] =
    useState("");
  const [isPartialCreditDialogOpen, setIsPartialCreditDialogOpen] =
    useState(false);
  const [partialPaymentText, setPartialPaymentText] =
    useState("");
  const [advanceGamesText, setAdvanceGamesText] =
    useState("1");
  const [isOutsidePurchaseOpen, setIsOutsidePurchaseOpen] =
    useState(false);

  useEffect(() => {
    splitGenericWalkInBills();
    mergeDuplicateWalkInSessionBills();
  }, [
    splitGenericWalkInBills,
    mergeDuplicateWalkInSessionBills,
  ]);

  useEffect(() => {
    accounts.forEach((account) => {
      if (
        account.paymentStatus !== "unpaid" ||
        !account.advanceGamesApplied ||
        getBillTotals(account).grandTotal > 0
      ) {
        return;
      }

      markCustomerBillSettledByAdvance(
        account.id,
        activeBusinessDay?.id
      );

      getAccountSessionIds(account).forEach((sessionId) => {
        removePendingBill(`BILL-${sessionId}`);
      });
    });
  }, [
    accounts,
    activeBusinessDay?.id,
    markCustomerBillSettledByAdvance,
    removePendingBill,
  ]);

  const baseOpenAccounts = useMemo(
    () =>
      dedupeOpenAccounts(
        accounts.filter((account) => {
          const isUnpaidBill =
            account.status === "active" &&
            account.paymentStatus === "unpaid";
          const isPaidBill =
            account.paymentStatus === "paid";
          const isCancelledBill = Boolean(account.cancelledAt);
          const hasBillCharges =
            account.gameCharges.length > 0 ||
            account.cafeCharges.length > 0 ||
            (account.accessoryCharges ?? []).length > 0;
          const matchesStatus =
            billStatusFilter === "all"
              ? isUnpaidBill || isPaidBill || isCancelledBill
              : billStatusFilter === "paid"
                ? isPaidBill
                : billStatusFilter === "cancelled"
                  ? isCancelledBill
                  : isUnpaidBill;

          if (
            !matchesStatus ||
            !hasBillCharges ||
            (isUnpaidBill &&
              getBillTotals(account).grandTotal <= 0)
          ) {
            return false;
          }

          if (isPaidBill) return true;

          const sessionIds =
            getAccountSessionIds(account);
          const hasRunningSession =
            tables.some(
              (table) =>
                table.session &&
                (table.status === "running" ||
                  table.status === "paused") &&
                (sessionIds.has(
                  table.session.id
                ) ||
                  accountMatchesSession(
                    account,
                    table.session
                  ))
            );

          return !hasRunningSession;
        })
      ),
    [accounts, billStatusFilter, tables]
  );

  const tableOptions = useMemo(() => {
    const options = new Set<string>();

    baseOpenAccounts.forEach((account) => {
      const label = getBillTableLabel(account);

      if (label) {
        options.add(label);
      }
    });

    return Array.from(options).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [baseOpenAccounts]);

  const openAccounts = useMemo(() => {
    const query =
      search.trim().toLowerCase();
    const range = getDateRange(dateFilter);

    return baseOpenAccounts
      .filter((account) => {
        if (!range) return true;

        const timestamp = new Date(
          getBillTimestamp(account) ?? ""
        ).getTime();

        return (
          Number.isFinite(timestamp) &&
          timestamp >= range.start.getTime() &&
          timestamp <= range.end.getTime()
        );
      })
      .filter((account) => {
        if (billTypeFilter === "all") return true;

        const totals = getBillTotals(account);

        if (billTypeFilter === "table") {
          return account.totalGameAmount > 0;
        }

        if (billTypeFilter === "cafe") {
          return totals.cafeTotal > 0;
        }

        return totals.accessoryTotal > 0;
      })
      .filter((account) => {
        if (tableFilter === "all") return true;

        return getBillTableLabel(account) === tableFilter;
      })
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
      )
  }, [
    baseOpenAccounts,
    billTypeFilter,
    dateFilter,
    search,
    tableFilter,
  ]);

  useEffect(() => {
    const customerBillId = searchParams.get(
      "customerBillId"
    );

    if (
      customerBillId &&
      accounts.some(
        (account) =>
          account.id === customerBillId
      )
    ) {
      setSelectedId(customerBillId);
      if (!paymentMode) {
        const nextSearchParams = new URLSearchParams(
          searchParams
        );
        nextSearchParams.delete("customerBillId");
        setSearchParams(nextSearchParams, {
          replace: true,
        });
      }
    }
  }, [accounts, paymentMode, searchParams, setSearchParams]);

  const selectedAccount =
    selectedId
      ? openAccounts.find(
          (account) => account.id === selectedId
        )
      : undefined;
  const selectedAccountIsCancelled = Boolean(selectedAccount?.cancelledAt);
  const selectedTotals = selectedAccount
    ? getBillTotals(selectedAccount)
    : undefined;
  const selectedOutsidePurchases = selectedAccount
    ? outsidePurchases.filter(
        (purchase) =>
          purchase.customerAccountId === selectedAccount.id ||
          purchase.customerId === selectedAccount.id
      )
    : [];
  const selectedOutsidePurchaseContext = selectedAccount
    ? {
        tableId:
          selectedAccount.gameCharges.find((charge) => charge.tableId)
            ?.tableId ??
          selectedAccount.cafeCharges.find((charge) => charge.tableId)
            ?.tableId ??
          selectedAccount.accessoryCharges?.find((charge) => charge.tableId)
            ?.tableId ??
          0,
        tableName:
          selectedAccount.lastTableName ||
          selectedAccount.gameCharges.find((charge) => charge.tableName)
            ?.tableName ||
          selectedAccount.cafeCharges.find((charge) => charge.tableName)
            ?.tableName ||
          selectedAccount.accessoryCharges?.find(
            (charge) => charge.tableName
          )?.tableName ||
          "No table",
        sessionId:
          selectedAccount.gameCharges.find((charge) => charge.sessionId)
            ?.sessionId ||
          selectedAccount.cafeCharges.find((charge) => charge.sessionId)
            ?.sessionId ||
          selectedAccount.accessoryCharges?.find(
            (charge) => charge.sessionId
          )?.sessionId ||
          `CUSTOMER-BILL-${selectedAccount.id}`,
      }
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
  const selectedGameLines = selectedAccount
    ? getIndividualGameCharges(selectedAccount.gameCharges, tableHistoryRecords)
    : [];
  const selectedAdvanceBalance = selectedAccount
    ? safeAdvanceTransactions
        .filter((item) => item.customerId === selectedAccount.id)
        .reduce((total, item) => total + item.balanceDelta, 0)
    : 0;
  const selectedEligibleGames = selectedAccount
    ? selectedAccount.gameCharges.reduce(
        (total, charge) =>
          total +
          (charge.gameCount ??
            Math.max(
              1,
              Math.round((charge.originalAmount ?? charge.amount) / 300)
            )),
        0
      )
    : 0;
  const selectedMaximumAdvanceGames = Math.min(
    selectedAdvanceBalance,
    selectedEligibleGames
  );
  const isSelectedBillStillRunning =
    !!selectedRunningTable &&
    (selectedRunningTable.status === "running" ||
      selectedRunningTable.status === "paused");
  const isReceivingSelectedPayment =
    !!selectedAccount &&
    payingCustomerId === selectedAccount.id;

  const openBill = (
    account: CustomerAccount
  ) => {
    setSelectedId(account.id);
    setDiscountText(
      String(account.discount ?? 0)
    );
    setPaymentMethod(defaultPaymentMethod);
    setPaymentSplits([]);
    setIsEditingPaidPayment(false);
    setCorrectedPaymentMethod(account.paymentMethod ?? "cash");
    setMessage("");
    setError("");
    setEditName(account.customerName);
    setEditNote(account.customerNote ?? "");
    setEditPhone(account.phone ?? "");
    setIsEditingCustomer(false);
    setIsCreditDialogOpen(false);
    setCreditNote("");
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

  const handleCorrectPaymentMethod = () => {
    if (!useAdminModeStore.getState().can("correct_payments")) {
      setError("Admin Mode is required to correct a payment method.");
      setMessage("");
      setIsEditingPaidPayment(false);
      return;
    }
    if (!selectedAccount || selectedAccount.paymentStatus !== "paid") {
      return;
    }

    const linkedSale = selectedAccount.saleId
      ? salesStore.sales.find(
          (sale) => sale.id === selectedAccount.saleId
        )
      : salesStore.sales.find(
          (sale) =>
            sale.customerAccountId === selectedAccount.id ||
            sale.sessionId === selectedAccount.id
        );

    if (!linkedSale) {
      setError("The linked sale could not be found, so the payment method was not changed.");
      setMessage("");
      return;
    }

    updatePaidBillPaymentMethod(
      selectedAccount.id,
      correctedPaymentMethod
    );

    salesStore.updateSalePaymentMethod(
      linkedSale.id,
      correctedPaymentMethod
    );

    setIsEditingPaidPayment(false);
    setMessage(
      `Payment method changed to ${paymentLabel(correctedPaymentMethod)}.`
    );
    setError("");
  };

  const handleDeleteSelectedBill = () => {
    if (!useAdminModeStore.getState().can("cancel_bills")) {
      setError("Admin Mode is required to delete or cancel a bill.");
      setMessage("");
      return;
    }
    if (!selectedAccount) return;

    if (
      selectedAccount.paymentStatus !== "unpaid" ||
      isSelectedBillStillRunning
    ) {
      setError(
        isSelectedBillStillRunning
          ? "End the active table session before deleting this bill."
          : "Only unpaid bills can be deleted."
      );
      setMessage("");
      return;
    }

    const confirmed = window.confirm(
      `Delete the bill for ${getBillPrimaryLabel(selectedAccount)}? This cannot be undone.`
    );
    if (!confirmed) return;

    const sessionIds = new Set(
      [
        ...selectedAccount.gameCharges,
        ...selectedAccount.cafeCharges,
        ...(selectedAccount.accessoryCharges ?? []),
      ]
        .map((charge) => charge.sessionId)
        .filter((sessionId): sessionId is string => Boolean(sessionId))
    );

    sessionIds.forEach((sessionId) => {
      removePendingBill(`BILL-${sessionId}`);
    });
    new Set(
      selectedAccount.cafeCharges
        .map((charge) => charge.sourceOrderId)
        .filter((sourceOrderId): sourceOrderId is string => Boolean(sourceOrderId))
    ).forEach((sourceOrderId) => {
      useCafeStore.getState().reverseStockForCharge(
        sourceOrderId,
        `Deleted customer bill ${selectedAccount.customerToken}`
      );
    });
    deleteSavedOrdersForCustomerAccount(selectedAccount.id);
    deleteCustomerAccount(selectedAccount.id);
    setSelectedId(null);
    setIsEditingCustomer(false);
    setError("");
    toast.success({
      title: "Bill Deleted",
      description: `${getBillPrimaryLabel(selectedAccount)} was deleted successfully.`,
    });
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

  const handleApplyAdvanceGames = () => {
    if (!selectedAccount || selectedAccount.advanceApplicationId) return;
    const games = Number(advanceGamesText);
    if (!Number.isInteger(games) || games < 1 || games > selectedMaximumAdvanceGames) {
      setError(`Enter a whole number from 1 to ${selectedMaximumAdvanceGames}.`);
      setMessage("");
      return;
    }
    const applicationId = `ADV-APPLY-${selectedAccount.id}-${Date.now()}`;
    if (!applyAdvanceTransaction({
      transactionId: applicationId,
      customerId: selectedAccount.id,
      customerName: selectedAccount.customerName,
      games,
      billId: selectedAccount.id,
    })) {
      setError("Advance games could not be applied.");
      return;
    }
    if (!applyAdvanceGamesToBill(selectedAccount.id, games, applicationId)) {
      undoAdvanceTransaction({
        transactionId: `${applicationId}-ROLLBACK`,
        applicationId,
        customerId: selectedAccount.id,
        customerName: selectedAccount.customerName,
        games,
        billId: selectedAccount.id,
      });
      setError("Advance games could not be applied to this bill.");
      return;
    }

    const updatedAccount = useCustomerAccountStore
      .getState()
      .getCustomerById(selectedAccount.id);

    if (updatedAccount && updatedAccount.grandTotal <= 0) {
      markCustomerBillSettledByAdvance(
        updatedAccount.id,
        activeBusinessDay?.id
      );

      new Set(
        [
          ...updatedAccount.gameCharges,
          ...updatedAccount.cafeCharges,
          ...(updatedAccount.accessoryCharges ?? []),
        ]
          .map((charge) => charge.sessionId)
          .filter((sessionId): sessionId is string => Boolean(sessionId))
      ).forEach((sessionId) => {
        removePendingBill(`BILL-${sessionId}`);
      });

      setSelectedId(null);
      setError("");
      setMessage(
        `${games} advance game${games === 1 ? "" : "s"} applied. Bill settled with no cash payment.`
      );
      if (paymentMode) {
        navigate("/operator/billing", { replace: true });
      }
      return;
    }

    setError("");
    setMessage(`${games} advance game${games === 1 ? "" : "s"} applied.`);
  };

  const handleUndoAdvanceGames = () => {
    if (!selectedAccount?.advanceApplicationId || !selectedAccount.advanceGamesApplied) return;
    const applicationId = selectedAccount.advanceApplicationId;
    const games = selectedAccount.advanceGamesApplied;
    const undoId = `ADV-UNDO-${applicationId}`;
    if (!undoAdvanceTransaction({
      transactionId: undoId,
      applicationId,
      customerId: selectedAccount.id,
      customerName: selectedAccount.customerName,
      games,
      billId: selectedAccount.id,
    })) {
      setError("Advance games have already been undone.");
      return;
    }
    if (!undoAdvanceGamesFromBill(selectedAccount.id, applicationId)) {
      setError("This bill can no longer be changed.");
      return;
    }
    setError("");
    setMessage("Advance games restored to the customer balance.");
  };

  const handleReceivePayment = (partialCredit?: {
    paidAmount: number;
    creditNote: string;
  }) => {
    setMessage("");
    setError("");

    if (!selectedAccount) return;
    if (payingCustomerId) return;

    setPayingCustomerId(selectedAccount.id);

    const currentAccount =
      useCustomerAccountStore
        .getState()
        .getCustomerById(selectedAccount.id);
    const alreadyPaid =
      currentAccount?.paymentStatus === "paid" ||
      useSalesStore
        .getState()
        .sales.some(
          (sale) =>
            sale.paymentStatus === "paid" &&
            (sale.customerAccountId ===
              selectedAccount.id ||
              sale.sessionId === selectedAccount.id)
        );

    if (alreadyPaid) {
      setError("This bill has already been paid.");
      setPayingCustomerId(null);
      return;
    }

    if (
      selectedRunningTable &&
      (selectedRunningTable.status === "running" ||
        selectedRunningTable.status === "paused")
    ) {
      setError(
        `${selectedAccount.customerName} is still playing on ${selectedRunningTable.name}. End the table before receiving this bill.`
      );
      setPayingCustomerId(null);
      return;
    }

    if (!activeBusinessDay) {
      setError(
        "Please start the day before receiving payment."
      );
      setPayingCustomerId(null);
      return;
    }

    const billTotal = selectedTotals?.grandTotal ?? 0;
    const receivedAmount = partialCredit?.paidAmount ?? billTotal;
    const creditAmount = Math.max(0, billTotal - receivedAmount);

    if (
      !Number.isFinite(receivedAmount) ||
      receivedAmount <= 0 ||
      receivedAmount > billTotal ||
      (partialCredit && creditAmount <= 0)
    ) {
      setError("Enter a payment amount greater than zero and less than the bill total.");
      setPayingCustomerId(null);
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
        receivedAmount
    ) {
      setError(
        `Split payment total must be Rs. ${receivedAmount}.`
      );
      setPayingCustomerId(null);
      return;
    }

    const now = new Date().toISOString();
    const invoiceNumber =
      salesStore.getNextInvoiceNumber();
    const saleId = `SALE-${invoiceNumber}-CUSTOMER`;
    const netTableAmount = Math.max(
      0,
      selectedAccount.totalGameAmount -
        Math.min(selectedAccount.discount, selectedAccount.totalGameAmount)
    );
    const discountAfterTable = Math.max(
      0,
      selectedAccount.discount - selectedAccount.totalGameAmount
    );
    const netCafeAmount = Math.max(
      0,
      (selectedTotals?.cafeTotal ?? 0) - discountAfterTable
    );
    const paidTableAmount = Math.min(receivedAmount, netTableAmount);
    const paidCafeAmount = Math.min(
      Math.max(0, receivedAmount - paidTableAmount),
      netCafeAmount
    );
    const paidAccessoryAmount = Math.min(
      Math.max(0, receivedAmount - paidTableAmount - paidCafeAmount),
      selectedTotals?.accessoryTotal ?? 0
    );

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
        partialCredit ? paidTableAmount : selectedAccount.totalGameAmount,
      cafeAmount:
        partialCredit ? paidCafeAmount : selectedTotals?.cafeTotal ?? 0,
      subtotal:
        partialCredit
          ? receivedAmount
          : selectedAccount.totalGameAmount +
            (selectedTotals?.cafeTotal ?? 0) +
            (selectedTotals?.accessoryTotal ?? 0),
      discount: partialCredit ? 0 : selectedAccount.discount,
      grandTotal:
        receivedAmount,
      originalTableAmount:
        selectedAccount.gameCharges.reduce(
          (total, charge) => total + (charge.originalAmount ?? charge.amount),
          0
        ),
      originalGameCount: selectedEligibleGames,
      advanceGamesApplied: selectedAccount.advanceGamesApplied ?? 0,
      advanceReduction: selectedAccount.advanceReduction ?? 0,
      settlementLabel:
        (selectedTotals?.grandTotal ?? 0) === 0 &&
        (selectedAccount.advanceGamesApplied ?? 0) > 0
          ? "Settled by Advance Games"
          : undefined,
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
            partialCredit ? paidTableAmount : selectedAccount.totalGameAmount,
          cafeAmount:
            partialCredit
              ? paidCafeAmount + paidAccessoryAmount
              : selectedAccount.totalCafeAmount +
                (selectedTotals?.accessoryTotal ?? 0),
          totalAmount:
            receivedAmount,
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

    if (partialCredit) {
      const entry = addCreditFromCustomerBill({
        account: selectedAccount,
        originalBillNumber: getBillPrimaryLabel(selectedAccount),
        tableName: getBillTableLabel(selectedAccount),
        tableTotal: Math.max(0, netTableAmount - paidTableAmount),
        cafeTotal: Math.max(0, netCafeAmount - paidCafeAmount),
        accessoryTotal: Math.max(
          0,
          (selectedTotals?.accessoryTotal ?? 0) - paidAccessoryAmount
        ),
        discount: 0,
        finalAmount: creditAmount,
        creditNote: partialCredit.creditNote,
        businessDayId: activeBusinessDay.id,
      });

      if (!entry) {
        setError("This bill is already in the Credit Ledger.");
        setPayingCustomerId(null);
        return;
      }

      markCustomerBillCredited(selectedAccount.id);
    } else {
      markCustomerBillPaid({
        customerId: selectedAccount.id,
        paymentMethod,
        activeBusinessDayId: activeBusinessDay.id,
        saleId,
      });
    }

    const paidSessionIds = new Set(
      [
        ...selectedAccount.gameCharges,
        ...selectedAccount.cafeCharges,
        ...(selectedAccount.accessoryCharges ?? []),
      ]
        .map((charge) => charge.sessionId)
        .filter((sessionId): sessionId is string =>
          Boolean(sessionId)
        )
    );

    paidSessionIds.forEach((sessionId) => {
      removePendingBill(`BILL-${sessionId}`);
    });

    toast.success({
      title: "Payment Received",
      description: partialCredit
        ? `${formatCurrency(receivedAmount)} received · ${formatCurrency(creditAmount)} moved to Credit Ledger.`
        : getBillPrimaryLabel(selectedAccount),
    });
    setSelectedId(null);
    setPaymentMethod(defaultPaymentMethod);
    setPaymentSplits([]);
    setPayingCustomerId(null);
    setIsPartialCreditDialogOpen(false);
    setPartialPaymentText("");
    if (paymentMode) {
      navigate("/operator/billing", { replace: true });
    }
  };

  const handleOpenCreditDialog = () => {
    setMessage("");
    setError("");

    if (!selectedAccount) return;

    if (isSelectedBillStillRunning) {
      setError(
        `${selectedAccount.customerName} is still playing on ${selectedRunningTable?.name}. End the table before moving this bill to credit.`
      );
      return;
    }

    if (
      !hasMeaningfulCreditCustomerName(selectedAccount)
    ) {
      setError(
        "Edit the customer name from the Customer Bills row before moving this bill to credit."
      );
      return;
    }

    const existingCredit =
      useCreditLedgerStore
        .getState()
        .entries.some(
          (entry) =>
            entry.sourceCustomerAccountId ===
              selectedAccount.id &&
            entry.status !== "cancelled"
        );

    if (existingCredit) {
      setError(
        "This bill is already in the Credit Ledger."
      );
      return;
    }

    setCreditNote("");
    setIsCreditDialogOpen(true);
  };

  const handleOpenPartialCreditDialog = () => {
    setMessage("");
    setError("");

    if (!selectedAccount || !selectedTotals) return;

    if (isSelectedBillStillRunning) {
      setError(
        `${selectedAccount.customerName} is still playing on ${selectedRunningTable?.name}. End the table before receiving this bill.`
      );
      return;
    }

    if (!hasMeaningfulCreditCustomerName(selectedAccount)) {
      setError("Enter a proper customer name before giving partial credit.");
      return;
    }

    const existingCredit = useCreditLedgerStore
      .getState()
      .entries.some(
        (entry) =>
          entry.sourceCustomerAccountId === selectedAccount.id &&
          entry.status !== "cancelled"
      );

    if (existingCredit) {
      setError("This bill is already in the Credit Ledger.");
      return;
    }

    setPartialPaymentText("");
    setCreditNote("");
    setIsPartialCreditDialogOpen(true);
  };

  const handleMoveToCredit = () => {
    setMessage("");
    setError("");

    if (!selectedAccount || !selectedTotals) return;

    if (
      !hasMeaningfulCreditCustomerName(selectedAccount)
    ) {
      setError(
        "Enter a proper customer name before moving this bill to credit."
      );
      setIsCreditDialogOpen(false);
      return;
    }

    const entry = addCreditFromCustomerBill({
      account: selectedAccount,
      originalBillNumber:
        getBillPrimaryLabel(selectedAccount),
      tableName: getBillTableLabel(selectedAccount),
      cafeTotal: selectedTotals.cafeTotal,
      accessoryTotal:
        selectedTotals.accessoryTotal,
      finalAmount: selectedTotals.grandTotal,
      creditNote,
      businessDayId: activeBusinessDay?.id,
    });

    if (!entry) {
      setError(
        "This bill is already in the Credit Ledger."
      );
      setIsCreditDialogOpen(false);
      return;
    }

    markCustomerBillCredited(selectedAccount.id);

    const creditedSessionIds = new Set(
      [
        ...selectedAccount.gameCharges,
        ...selectedAccount.cafeCharges,
        ...(selectedAccount.accessoryCharges ?? []),
      ]
        .map((charge) => charge.sessionId)
        .filter((sessionId): sessionId is string =>
          Boolean(sessionId)
        )
    );

    creditedSessionIds.forEach((sessionId) => {
      removePendingBill(`BILL-${sessionId}`);
    });

    setMessage(
      `${entry.customerName} moved to Credit Ledger.`
    );
    setSelectedId(null);
    setPaymentMethod(defaultPaymentMethod);
    setPaymentSplits([]);
    setCreditNote("");
    setIsCreditDialogOpen(false);
    if (paymentMode) {
      navigate("/operator/billing", { replace: true });
    }
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
              {paymentMode ? "Collect Payment" : "Customer Bills"}
            </h1>
            <p className="text-sm text-slate-500">
              {paymentMode
                ? "Collect payment for ended sessions and open bills."
                : "View and manage customer bill records."}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="p-4">
              <p className="text-sm text-slate-500">
                {billStatusFilter === "paid"
                  ? "Paid Bills"
                  : billStatusFilter === "cancelled"
                    ? "Cancelled Bills"
                  : billStatusFilter === "all"
                    ? "All Bills"
                    : "Open Bills"}
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-950">
                {totals.count.toLocaleString()} bills
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-slate-500">
                {billStatusFilter === "paid"
                  ? "Paid Amount"
                  : billStatusFilter === "cancelled"
                    ? "Cancelled Amount"
                  : billStatusFilter === "all"
                    ? "Total Amount"
                    : "Outstanding Amount"}
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

        <div className="grid gap-5">
          <Card className="overflow-hidden">
            <div className="space-y-3 border-b p-4">
              <div className="grid gap-1.5">
                <label
                  htmlFor="customer-bills-search"
                  className="text-xs font-semibold uppercase text-slate-500"
                >
                  Search
                </label>
                <div className="flex items-center gap-3">
                  <Search className="h-4 w-4 text-slate-400" />
                  <Input
                    id="customer-bills-search"
                    name="customerBillsSearch"
                    placeholder="Search bill no, customer, player, table..."
                    value={search}
                    onChange={(event) =>
                      setSearch(event.target.value)
                    }
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <label className="grid min-w-32 gap-1.5 text-xs font-semibold uppercase text-slate-500">
                  Date
                <select
                  id="customer-bills-date-filter"
                  name="customerBillsDateFilter"
                  className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-normal normal-case text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  value={dateFilter}
                  onChange={(event) =>
                    setDateFilter(
                      event.target.value as DateFilter
                    )
                  }
                >
                  <option value="all">All Dates</option>
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="this-month">This Month</option>
                </select>
                </label>

                <label className="grid min-w-32 gap-1.5 text-xs font-semibold uppercase text-slate-500">
                  Bill Type
                <select
                  id="customer-bills-type-filter"
                  name="customerBillsTypeFilter"
                  className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-normal normal-case text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  value={billTypeFilter}
                  onChange={(event) =>
                    setBillTypeFilter(
                      event.target.value as BillTypeFilter
                    )
                  }
                >
                  <option value="all">All Types</option>
                  <option value="table">Table Bills</option>
                  <option value="cafe">Cafe Bills</option>
                  <option value="accessories">
                    Accessories
                  </option>
                </select>
                </label>

                <label className="grid min-w-32 gap-1.5 text-xs font-semibold uppercase text-slate-500">
                  Table
                <select
                  id="customer-bills-table-filter"
                  name="customerBillsTableFilter"
                  className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-normal normal-case text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  value={tableFilter}
                  onChange={(event) =>
                    setTableFilter(event.target.value)
                  }
                >
                  <option value="all">All Tables</option>
                  {tableOptions.map((table) => (
                    <option key={table} value={table}>
                      {table}
                    </option>
                  ))}
                </select>
                </label>

                <label className="grid min-w-32 gap-1.5 text-xs font-semibold uppercase text-slate-500">
                  Payment Status
                <select
                  id="customer-bills-status-filter"
                  name="customerBillsStatusFilter"
                  className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-normal normal-case text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  value={billStatusFilter}
                  onChange={(event) => {
                    setBillStatusFilter(
                      event.target.value as BillStatusFilter
                    );
                    setSelectedId(null);
                  }}
                >
                  <option value="unpaid">Unpaid</option>
                  <option value="paid">Paid</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="all">All Statuses</option>
                </select>
                </label>

                {(search ||
                  dateFilter !== "all" ||
                  billTypeFilter !== "all" ||
                  tableFilter !== "all" ||
                  billStatusFilter !== "unpaid") && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9"
                    onClick={() => {
                      setSearch("");
                      setDateFilter("all");
                      setBillTypeFilter("all");
                      setTableFilter("all");
                      setBillStatusFilter("unpaid");
                      setSelectedId(null);
                    }}
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
            </div>

            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[1120px] table-fixed text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs uppercase text-slate-500 shadow-sm dark:bg-slate-900 dark:text-slate-300">
                  <tr>
                    <th className="w-36 whitespace-nowrap px-3 py-3">
                      Bill No
                    </th>
                    <th className="w-44 px-3 py-3">
                      Customer / Table
                    </th>
                    <th className="w-28 whitespace-nowrap px-3 py-3">
                      Ended At
                    </th>
                    <th className="w-28 whitespace-nowrap px-3 py-3">
                      Type
                    </th>
                    <th className="w-24 whitespace-nowrap px-3 py-3 text-right">
                      Table Bill
                    </th>
                    <th className="w-24 whitespace-nowrap px-3 py-3 text-right">
                      Cafe Bill
                    </th>
                    <th className="w-24 whitespace-nowrap px-3 py-3 text-right">
                      Accessories
                    </th>
                    <th className="w-24 whitespace-nowrap px-3 py-3 text-right">
                      Total
                    </th>
                    <th className="w-20 whitespace-nowrap px-3 py-3 text-center">
                      Status
                    </th>
                    <th className="sticky right-0 z-20 w-36 whitespace-nowrap bg-slate-50 px-3 py-3 text-right shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)] dark:bg-slate-900">
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
                        selectedAccount?.id === account.id || contextAccountId === account.id;
                      const tableLabel =
                        getBillTableLabel(account) ||
                        runningTable?.name ||
                        "—";

                      return (
                        <tr
                          key={account.id}
                          tabIndex={0}
                          onContextMenu={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setContextAccountId(account.id);
                            setContextMenu({ account, x: event.clientX, y: event.clientY });
                          }}
                          onClick={() => openBill(account)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              openBill(account);
                            }
                          }}
                          className={`group cursor-pointer border-l-4 transition focus:outline-none focus:ring-2 focus:ring-inset focus:ring-amber-300 ${
                            selected
                              ? "border-l-amber-500 bg-amber-50/80 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.22)] dark:bg-amber-950/45 dark:shadow-[inset_0_0_0_1px_rgba(251,191,36,0.32)]"
                              : "border-l-transparent bg-white hover:bg-amber-50/40 dark:bg-slate-950 dark:hover:bg-slate-800"
                          }`}
                        >
                          <td className="whitespace-nowrap px-3 py-3 align-middle font-mono text-sm font-semibold text-slate-950 dark:text-slate-100">
                              {getBillPrimaryLabel(
                                account
                              )}
                          </td>
                          <td className="px-3 py-3 align-middle">
                            <p className="font-semibold text-slate-950 dark:text-slate-100">
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
                          <td className="px-3 py-3 align-middle">
                            <span className="block whitespace-nowrap font-medium text-slate-700 dark:text-slate-200">
                              {formatShortDate(timestamp)}
                            </span>
                            <span className="block whitespace-nowrap text-xs text-slate-500">
                              {formatTime(timestamp)}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 align-middle">
                            {getBillTypeLabel(account)}
                          </td>
                          <td className="px-3 py-3 text-right align-middle tabular-nums">
                            {formatAmountOrDash(account.totalGameAmount)}
                          </td>
                          <td className="px-3 py-3 text-right align-middle tabular-nums">
                            {formatAmountOrDash(totals.cafeTotal)}
                          </td>
                          <td className="px-3 py-3 text-right align-middle tabular-nums">
                            {formatAmountOrDash(totals.accessoryTotal)}
                          </td>
                          <td className="px-3 py-3 text-right align-middle font-bold tabular-nums text-slate-950 dark:text-slate-100">
                            {formatCurrency(totals.grandTotal)}
                          </td>
                          <td className="px-3 py-3 text-center align-middle">
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-xs font-bold ${
                                account.cancelledAt
                                  ? "bg-red-50 text-red-700 ring-1 ring-red-200"
                                  : account.paymentStatus === "paid"
                                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                                  : "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                              }`}
                            >
                              {account.cancelledAt
                                ? "Cancelled"
                                : account.paymentStatus === "paid"
                                ? "Paid"
                                : "Unpaid"}
                            </span>
                          </td>
                          <td
                            className={`sticky right-0 z-[1] px-3 py-3 text-right align-middle shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)] ${
                              selected
                                ? "bg-amber-50 dark:bg-amber-950"
                                : "bg-white group-hover:bg-amber-50 dark:bg-slate-950 dark:group-hover:bg-slate-800"
                            }`}
                          >
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openBill(account);
                                  setIsEditingCustomer(true);
                                }}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant={selected ? "outline" : "default"}
                                className="h-8 min-w-16 px-2"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openBill(account);
                                }}
                              >
                                {selected ? "Selected" : "View"}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    }
                  )}

                  {openAccounts.length === 0 && (
                    <tr>
                      <td
                        colSpan={10}
                        className="p-4"
                      >
                        <EmptyState
                          compact
                          icon={Search}
                          title={accounts.length === 0 ? "No Customer Bills Yet" : "No Matching Bills"}
                          description={accounts.length === 0 ? "Bills will appear here after a table session, canteen order, or accessory charge is created." : "Try changing your search or filters."}
                          actionLabel={accounts.length === 0 ? undefined : "Clear Filters"}
                          onAction={accounts.length === 0 ? undefined : () => {
                            setSearch("");
                            setDateFilter("all");
                            setBillTypeFilter("all");
                            setBillStatusFilter("unpaid");
                            setTableFilter("all");
                          }}
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {contextMenu && (
            <BillContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              onClose={() => {
                setContextMenu(null);
                setContextAccountId(null);
              }}
              actions={([
                {
                  id: "view",
                  label: "View Details",
                  onSelect: () => openBill(contextMenu.account),
                },
                ...(contextMenu.account.paymentStatus !== "paid" && !contextMenu.account.cancelledAt
                  ? [{
                      id: "payment" as const,
                      label: "Collect Payment",
                      onSelect: () => navigate(`/operator/billing?customerBillId=${contextMenu.account.id}`),
                    },
                    {
                      id: "edit" as const,
                      label: "Edit Customer Details",
                      onSelect: () => {
                        openBill(contextMenu.account);
                        setIsEditingCustomer(true);
                      },
                    }]
                  : []),
                ...(canCancelBills && !contextMenu.account.cancelledAt
                  ? [{
                      id: "delete" as const,
                      label: "Delete Bill",
                      destructive: true,
                      onSelect: () => {
                        openBill(contextMenu.account);
                        handleDeleteSelectedBill();
                      },
                    }]
                  : []),
              ] satisfies BillContextMenuAction[])}
            />
          )}

          {selectedAccount && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-[1px] sm:p-6"
              role="dialog"
              aria-modal="true"
              aria-label={`Bill details for ${getBillPrimaryLabel(selectedAccount)}`}
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  setSelectedId(null);
                  setIsEditingCustomer(false);
                  if (paymentMode) {
                    navigate("/operator/billing", { replace: true });
                  }
                }
              }}
            >
            <Card
              className="flex h-[min(90vh,860px)] w-[min(96vw,960px)] flex-col overflow-hidden border-slate-300 p-0 shadow-2xl dark:border-slate-700"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="border-b bg-white px-5 pb-3 pt-5 dark:bg-slate-950">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-500">
                      Open Bill
                    </p>
                    {isEditingCustomer ? (
                      <div className="mt-2 grid gap-2">
                        <Input
                          id="customer-bill-edit-name"
                          name="customerBillEditName"
                          value={editName}
                          onChange={(event) =>
                            setEditName(
                              event.target.value
                            )
                          }
                          placeholder="Customer name"
                        />
                        <Input
                          id="customer-bill-edit-note"
                          name="customerBillEditNote"
                          value={editNote}
                          onChange={(event) =>
                            setEditNote(
                              event.target.value
                            )
                          }
                          placeholder="Note e.g. black shirt"
                        />
                        <Input
                          id="customer-bill-edit-phone"
                          name="customerBillEditPhone"
                          value={editPhone}
                          onChange={(event) =>
                            setEditPhone(
                              event.target.value
                            )
                          }
                          placeholder="Phone optional"
                        />
                        {(selectedAccount.paymentStatus === "unpaid" ||
                          selectedOutsidePurchases.length > 0) && (
                          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="font-bold text-slate-950">
                                  Customer Outside Purchases
                                </p>
                                <p className="text-xs text-slate-600">
                                  Record an outside item paid for this bill owner.
                                </p>
                              </div>
                              {selectedAccount.paymentStatus === "unpaid" &&
                                !selectedAccountIsCancelled && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="gap-2"
                                    onClick={() =>
                                      setIsOutsidePurchaseOpen(true)
                                    }
                                  >
                                    <ShoppingBag className="h-4 w-4" />
                                    Add Outside Purchase
                                  </Button>
                                )}
                            </div>

                            <div className="mt-2 max-h-36 space-y-2 overflow-y-auto">
                              {selectedOutsidePurchases.map((purchase) => (
                                <div
                                  key={purchase.id}
                                  className="flex items-center justify-between gap-3 rounded-md border bg-white px-3 py-2 text-sm"
                                >
                                  <div className="min-w-0">
                                    <p className="truncate font-semibold text-slate-950">
                                      {purchase.description}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      {purchase.status === "pending"
                                        ? "Reimbursement Pending"
                                        : purchase.status === "partial"
                                          ? "Partially Reimbursed"
                                          : purchase.status === "reimbursed"
                                            ? "Reimbursed"
                                            : "Cancelled"}
                                      {" · "}
                                      {purchase.paymentMethod
                                        ? paymentMethodLabels[
                                            purchase.paymentMethod
                                          ]
                                        : "Cash Drawer"}
                                    </p>
                                  </div>
                                  <div className="shrink-0 text-right">
                                    <p className="font-bold">
                                      {formatCurrency(
                                        purchase.amountPaidFromDrawer
                                      )}
                                    </p>
                                    <p className="text-xs text-amber-700">
                                      Outstanding{" "}
                                      {formatCurrency(
                                        purchase.outstandingAmount
                                      )}
                                    </p>
                                  </div>
                                </div>
                              ))}

                              {selectedOutsidePurchases.length === 0 && (
                                <p className="text-sm text-slate-500">
                                  No outside purchases attached to this bill.
                                </p>
                              )}
                            </div>
                          </div>
                        )}
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
                          {canCancelBills && !selectedAccountIsCancelled && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="ml-auto gap-1.5 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                              disabled={isSelectedBillStillRunning}
                              onClick={handleDeleteSelectedBill}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete Bill
                            </Button>
                          )}
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
                          {getBillTableLabel(selectedAccount) || "No table"}
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
                        <div className={`mt-3 grid gap-2 ${selectedAccount.paymentStatus === "paid" ? "grid-cols-1" : "grid-cols-[0.7fr_0.9fr_1.15fr]"}`}>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9 justify-center gap-2 px-2"
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
                            Edit
                          </Button>
                          {selectedAccount.paymentStatus === "unpaid" && !selectedAccountIsCancelled && (
                            <>
                              <Button
                                size="sm"
                                className="h-9 justify-center gap-2 bg-emerald-950 px-2 hover:bg-emerald-900"
                                onClick={() =>
                                  navigate(
                                    `/operator/cafe?customerBillId=${selectedAccount.id}`
                                  )
                                }
                              >
                                <Coffee className="h-4 w-4" />
                                Add Cafe
                              </Button>
                              <Button
                                size="sm"
                                className="h-9 justify-center gap-2 bg-slate-950 px-2 hover:bg-slate-900"
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
                      </>
                    )}
                  </div>
                  <div className="shrink-0">
                    <div className="flex items-center justify-end gap-2">
                      <div className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ring-1 ${selectedAccountIsCancelled ? "bg-red-50 text-red-700 ring-red-200" : selectedAccount.paymentStatus === "paid" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-700 ring-amber-200"}`}>
                        {selectedAccountIsCancelled
                          ? "Cancelled"
                          : selectedAccount.paymentStatus === "paid"
                          ? "Paid"
                          : "Awaiting Payment"}
                      </div>
                      {selectedBillAge && (
                        <span className="whitespace-nowrap text-xs font-medium text-slate-500">
                          {selectedBillAge}
                        </span>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-10 w-10 rounded-full p-0 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                        aria-label="Close bill details"
                        onClick={() => {
                          setSelectedId(null);
                          setError("");
                          setMessage("");
                          setPaymentSplits([]);
                          setIsEditingCustomer(false);
                          if (paymentMode) {
                            navigate("/operator/billing", { replace: true });
                          }
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-2.5 pr-7 [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]">
                <section className="mb-3 rounded-lg border bg-slate-50 px-3 py-2">
                  <h3 className="mb-2 text-sm font-bold text-slate-900">
                    Session Time
                  </h3>
                  <div className="grid gap-2 text-sm sm:grid-cols-4">
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

                <section className="mb-3">
                  <h3 className="mb-2 font-bold">
                    Sessions
                  </h3>
                  <div className="space-y-2">
                    {selectedGameLines
                      .slice()
                      .sort(compareChargeTimestamps)
                      .map(
                      (charge, index) => (
                        <div
                          key={charge.id}
                          className="rounded-lg border bg-white px-3 py-2 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-950">
                                {charge.sessionType === "time"
                                  ? "Time Charge"
                                  : `Game ${index + 1} · ${getChargeTypeLabel(charge.sessionType)}`}
                              </p>
                              <p className="mt-0.5 text-xs text-slate-500">
                                {formatChargeTimeRange(
                                  charge.startedAt,
                                  charge.endedAt,
                                  selectedGameLines[0]?.startedAt
                                )} · {formatChargeDuration(charge.startedAt, charge.endedAt)}
                              </p>
                              <p className="mt-0.5 text-xs font-medium text-slate-600">
                                Winner: {charge.winnerName ?? "—"}
                              </p>
                              <p className="mt-0.5 text-xs font-medium text-slate-600">
                                Loser: {charge.loserName ?? "—"}
                              </p>
                              <p className="mt-0.5 text-xs text-slate-500">
                                Payer: {charge.payerName ?? "—"}
                              </p>
                              {charge.isFinal && (
                                <span className="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                                  Final {charge.finalGames ?? 1}
                                </span>
                              )}
                            </div>
                            <p className="shrink-0 font-bold text-slate-950">
                              {formatCurrency(charge.amount)}
                            </p>
                          </div>
                        </div>
                      )
                    )}

                    {selectedGameLines
                      .length === 0 && (
                      <p className="text-sm text-slate-500">
                        No game charges.
                      </p>
                    )}
                  </div>
                </section>

                <section className="mb-3">
                  <h3 className="mb-2 font-bold">
                    Cafe Charges
                  </h3>
                  <div className="space-y-2">
                    {getCafeCharges(selectedAccount).map(
                      (charge) => (
                        <div
                          key={charge.id}
                          className="flex justify-between gap-3 rounded-lg border bg-slate-50 px-3 py-2"
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
                      <p className="text-sm text-slate-500">
                        No cafe items added
                      </p>
                    )}
                  </div>
                </section>

                <section className="mb-1">
                  <h3 className="mb-2 font-bold">
                    Accessories Charges
                  </h3>
                  <div className="space-y-2">
                    {getAccessoryCharges(selectedAccount).map(
                      (charge) => (
                        <div
                          key={charge.id}
                          className="flex justify-between gap-3 rounded-lg border bg-indigo-50 px-3 py-2"
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
                      <p className="text-sm text-slate-500">
                        No accessories added
                      </p>
                    )}
                  </div>
                </section>

              </div>

              <div className="max-h-[52vh] space-y-1 overflow-y-auto border-t bg-white px-5 py-2.5 text-sm shadow-[0_-10px_24px_rgba(15,23,42,0.08)] [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]">
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
                  {paymentMode && selectedAccount.paymentStatus === "unpaid" && !selectedAccountIsCancelled ? (
                  <div className="rounded-lg border bg-emerald-50 p-2.5">
                    <div className="flex items-center justify-between text-sm text-slate-700">
                      <span>Advance Games</span>
                      <strong>{selectedAdvanceBalance}</strong>
                    </div>
                    {selectedAccount.advanceApplicationId ? (
                      <Button className="mt-2 w-full" size="sm" variant="outline" onClick={handleUndoAdvanceGames}>
                        Undo Advance Games
                      </Button>
                    ) : (
                      <div className="mt-2 flex gap-2">
                        <Input
                          className="h-9"
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={selectedMaximumAdvanceGames}
                          step={1}
                          value={advanceGamesText}
                          onChange={(event) => setAdvanceGamesText(event.target.value.replace(/\D/g, ""))}
                          disabled={selectedMaximumAdvanceGames < 1}
                        />
                        <Button size="sm" onClick={handleApplyAdvanceGames} disabled={selectedMaximumAdvanceGames < 1}>
                          Apply Advance Games
                        </Button>
                      </div>
                    )}
                  </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <span>Advance Games Applied</span>
                      <strong>{selectedAccount.advanceGamesApplied ?? 0}</strong>
                    </div>
                  )}
                  {paymentMode && selectedAccount.paymentStatus === "unpaid" && !selectedAccountIsCancelled ? (
                  <div className="flex items-center justify-between gap-3">
                    <span>Discount</span>
                    <div className="flex items-center gap-2">
                      <Input
                        id="customer-bill-discount"
                        name="customerBillDiscount"
                        className="h-9 w-24"
                        type="number"
                        min={0}
                        value={discountText}
                        onFocus={(event) =>
                          event.currentTarget.select()
                        }
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
                  ) : (
                    <div className="flex justify-between">
                      <span>Discount</span>
                      <strong>{formatCurrency(selectedAccount.discount)}</strong>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-1.5 text-lg">
                    <span className="font-bold">
                      Grand Total
                    </span>
                    <strong className="text-xl text-slate-950">
                      {formatCurrency(selectedTotals?.grandTotal ?? 0)}
                    </strong>
                  </div>

                {selectedAccountIsCancelled ? (
                  <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    <p className="font-bold">Bill cancelled</p>
                    {selectedAccount.cancelledReason && <p className="mt-1">{selectedAccount.cancelledReason}</p>}
                    {selectedAccount.cancelledNote && <p className="mt-1 text-red-700">{selectedAccount.cancelledNote}</p>}
                  </div>
                ) : selectedAccount.paymentStatus === "paid" ? (
                  <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold">Payment received</p>
                        <p className="mt-1">
                          {selectedAccount.paidAt
                            ? `${formatShortDate(selectedAccount.paidAt)} at ${formatTime(selectedAccount.paidAt)}`
                            : "Paid"}
                          {selectedAccount.paymentMethod
                            ? ` \u00B7 ${paymentLabel(selectedAccount.paymentMethod)}`
                            : ""}
                        </p>
                      </div>
                      {canCorrectPayments && !isEditingPaidPayment && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 bg-white"
                          onClick={() => {
                            setCorrectedPaymentMethod(
                              selectedAccount.paymentMethod ?? "cash"
                            );
                            setIsEditingPaidPayment(true);
                          }}
                        >
                          Edit payment
                        </Button>
                      )}
                    </div>

                    {isEditingPaidPayment && (
                      <div className="mt-3 grid gap-2 border-t border-emerald-200 pt-3">
                        <label className="font-semibold" htmlFor="correct-paid-payment-method">
                          Correct payment method
                        </label>
                        <select
                          id="correct-paid-payment-method"
                          className="h-9 rounded-md border border-emerald-200 bg-white px-3 text-slate-900"
                          value={correctedPaymentMethod}
                          onChange={(event) =>
                            setCorrectedPaymentMethod(
                              event.target.value as PaymentMethod
                            )
                          }
                        >
                          {paymentMethods.map((method) => (
                            <option key={method.value} value={method.value}>
                              {method.label}
                            </option>
                          ))}
                        </select>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleCorrectPaymentMethod}>
                            Save correction
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-white"
                            onClick={() => setIsEditingPaidPayment(false)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : paymentMode ? (
                <div className="mt-2 rounded-lg border bg-slate-50 p-2">
                  {error && (
                    <p className="mb-3 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-red-200">
                      {error}
                    </p>
                  )}

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
                    className="mt-2 w-full gap-2"
                    onClick={() => handleReceivePayment()}
                    disabled={
                      isReceivingSelectedPayment ||
                      isSelectedBillStillRunning
                    }
                  >
                    <ReceiptText className="h-4 w-4" />
                    {isReceivingSelectedPayment
                      ? "Receiving Payment..."
                      : isSelectedBillStillRunning
                      ? `Still Playing on ${selectedRunningTable?.name}`
                      : `Receive Payment${
                          paymentSplits.length >
                          0
                            ? " - Split Payment"
                            : ` - ${paymentLabel(
                                paymentMethod
                              )}`
                        }`}
                  </Button>
                  <Button
                    className="mt-2 w-full"
                    variant="outline"
                    onClick={handleOpenPartialCreditDialog}
                    disabled={isSelectedBillStillRunning}
                  >
                    Pay Part &amp; Credit Rest
                  </Button>
                  <Button
                    className="mt-2 w-full"
                    variant="outline"
                    onClick={handleOpenCreditDialog}
                    disabled={isSelectedBillStillRunning}
                  >
                    Move to Credit
                  </Button>
                </div>
                ) : (
                  <Button
                    className="mt-2 w-full"
                    disabled={isSelectedBillStillRunning}
                    onClick={() => navigate(`/operator/billing?customerBillId=${selectedAccount.id}`)}
                  >
                    {isSelectedBillStillRunning
                      ? `Still Playing on ${selectedRunningTable?.name}`
                      : "Go to Collect Payment"}
                  </Button>
                )}
              </div>
            </Card>
            </div>
          )}
        </div>

        {isCreditDialogOpen &&
          selectedAccount &&
          selectedTotals && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
              <Card className="max-h-[90vh] w-full max-w-xl overflow-y-auto p-5">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-950">
                      Move to Credit Ledger
                    </h2>
                    <p className="text-sm text-slate-500">
                      This records the amount as customer credit, not as payment.
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0"
                    onClick={() =>
                      setIsCreditDialogOpen(false)
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="rounded-lg border bg-slate-50 p-3">
                    <p className="font-bold text-slate-950">
                      {getBillPrimaryLabel(
                        selectedAccount
                      )}
                    </p>
                    <p className="text-slate-500">
                      {getBillTableLabel(
                        selectedAccount
                      ) || "No table"}
                    </p>
                    {selectedAccount.customerNote && (
                      <p className="text-slate-500">
                        {selectedAccount.customerNote}
                      </p>
                    )}
                    {selectedAccount.phone && (
                      <p className="text-slate-500">
                        {selectedAccount.phone}
                      </p>
                    )}
                  </div>

                  <div className="rounded-lg border p-3">
                    <h3 className="mb-2 font-bold">
                      Bill Details
                    </h3>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span>Table Charges</span>
                        <strong>
                          {formatCurrency(
                            selectedAccount.totalGameAmount
                          )}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Cafe Charges</span>
                        <strong>
                          {formatCurrency(
                            selectedTotals.cafeTotal
                          )}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Accessories</span>
                        <strong>
                          {formatCurrency(
                            selectedTotals.accessoryTotal
                          )}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Discount</span>
                        <strong>
                          {formatCurrency(
                            Math.min(
                              selectedAccount.discount,
                              selectedAccount.totalGameAmount
                            )
                          )}
                        </strong>
                      </div>
                      <div className="flex justify-between border-t pt-2 text-base">
                        <span className="font-bold">
                          Final Outstanding
                        </span>
                        <strong>
                          {formatCurrency(
                            selectedTotals.grandTotal
                          )}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border p-3">
                      <h3 className="mb-2 font-bold">
                        Cafe Items
                      </h3>
                      <div className="space-y-1">
                        {getCafeCharges(
                          selectedAccount
                        ).map((charge) => (
                          <div
                            key={charge.id}
                            className="flex justify-between gap-3"
                          >
                            <span>
                              {charge.name} x
                              {charge.quantity}
                            </span>
                            <strong>
                              {formatCurrency(
                                charge.subtotal
                              )}
                            </strong>
                          </div>
                        ))}
                        {getCafeCharges(
                          selectedAccount
                        ).length === 0 && (
                          <p className="text-slate-500">
                            No cafe items
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg border p-3">
                      <h3 className="mb-2 font-bold">
                        Accessories
                      </h3>
                      <div className="space-y-1">
                        {getAccessoryCharges(
                          selectedAccount
                        ).map((charge) => (
                          <div
                            key={charge.id}
                            className="flex justify-between gap-3"
                          >
                            <span>
                              {charge.name
                                .replace(
                                  "[Accessory]",
                                  ""
                                )
                                .trim()}{" "}
                              x{charge.quantity}
                            </span>
                            <strong>
                              {formatCurrency(
                                charge.subtotal
                              )}
                            </strong>
                          </div>
                        ))}
                        {getAccessoryCharges(
                          selectedAccount
                        ).length === 0 && (
                          <p className="text-slate-500">
                            No accessories
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <label className="block font-semibold text-slate-700">
                    Credit Note
                    <Input
                      className="mt-1"
                      value={creditNote}
                      onChange={(event) =>
                        setCreditNote(
                          event.target.value
                        )
                      }
                      placeholder="Optional reason or promise note"
                    />
                  </label>
                </div>

                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      setIsCreditDialogOpen(false)
                    }
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleMoveToCredit}>
                    Add to Credit Ledger
                  </Button>
                </div>
              </Card>
            </div>
          )}

        {isPartialCreditDialogOpen &&
          selectedAccount &&
          selectedTotals && (() => {
            const paidAmount = Number(partialPaymentText);
            const validPaidAmount =
              Number.isFinite(paidAmount) &&
              paidAmount > 0 &&
              paidAmount < selectedTotals.grandTotal;
            const remainingAmount = validPaidAmount
              ? selectedTotals.grandTotal - paidAmount
              : selectedTotals.grandTotal;

            return (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4">
                <Card className="w-full max-w-md p-5">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-slate-950">
                        Pay Part &amp; Credit Rest
                      </h2>
                      <p className="text-sm text-slate-500">
                        Record the amount received now and move only the balance to Credit Ledger.
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0"
                      onClick={() => setIsPartialCreditDialogOpen(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 rounded-lg border bg-slate-50 p-3 text-sm">
                      <div>
                        <p className="text-slate-500">Bill Total</p>
                        <p className="text-lg font-bold">{formatCurrency(selectedTotals.grandTotal)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Credit Balance</p>
                        <p className="text-lg font-bold text-amber-700">{formatCurrency(remainingAmount)}</p>
                      </div>
                    </div>

                    <label className="block text-sm font-semibold text-slate-700">
                      Amount Received
                      <Input
                        className="mt-1"
                        type="number"
                        min="1"
                        max={Math.max(1, selectedTotals.grandTotal - 1)}
                        value={partialPaymentText}
                        onChange={(event) => setPartialPaymentText(event.target.value)}
                        placeholder="e.g. 1500"
                        autoFocus
                      />
                    </label>

                    <div className="rounded-lg border px-3 py-2 text-sm">
                      Payment method: <strong>{paymentLabel(paymentMethod)}</strong>
                    </div>

                    <label className="block text-sm font-semibold text-slate-700">
                      Credit Note
                      <Input
                        className="mt-1"
                        value={creditNote}
                        onChange={(event) => setCreditNote(event.target.value)}
                        placeholder="Optional note"
                      />
                    </label>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsPartialCreditDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      disabled={!validPaidAmount || isReceivingSelectedPayment}
                      onClick={() =>
                        handleReceivePayment({
                          paidAmount,
                          creditNote,
                        })
                      }
                    >
                      Confirm
                    </Button>
                  </div>
                </Card>
              </div>
            );
          })()}

        {selectedAccount && selectedOutsidePurchaseContext && (
          <OutsidePurchaseDialog
            open={isOutsidePurchaseOpen}
            tableId={selectedOutsidePurchaseContext.tableId}
            tableName={selectedOutsidePurchaseContext.tableName}
            sessionId={selectedOutsidePurchaseContext.sessionId}
            owners={[
              {
                customerId: selectedAccount.id,
                customerAccountId: selectedAccount.id,
                customerToken: selectedAccount.customerToken,
                customerName: selectedAccount.customerName,
              },
            ]}
            onOpenChange={setIsOutsidePurchaseOpen}
          />
        )}
      </div>
    </main>
  );
}

export default CustomerBillsPage;
