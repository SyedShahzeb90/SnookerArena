import { ArrowLeft, ReceiptText, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { PaymentMethod } from "@/types/session";
import type { PaymentSplit } from "@/features/sales/types/sale";
import BillingDialog from "../components/BillingDialog";
import { useCheckoutStore, type PendingBill } from "../store/checkoutStore";
import { useSalesStore } from "@/features/sales/store/salesStore";
import type { Sale } from "@/features/sales/types/sale";
import { getSessionPlayers } from "@/features/sessions/utils/sessionPlayers";
import { calculateGamePrice } from "@/features/pricing/utils/calculateGamePrice";
import { useBusinessDayStore } from "@/features/business-day/store/businessDayStore";
import { getRemainingPendingBillTotal } from "@/features/business-day/utils/businessDaySummary";
import { calculateDoubleGamePayerBreakdown } from "@/features/sessions/utils/doubleGameBilling";
import { useCustomerAccountStore } from "@/features/customers/store/customerAccountStore";
import {
  getWalkInDisplayName,
  isWalkInName,
} from "@/features/sessions/utils/walkInLabel";
import type { CustomerAccount } from "@/features/customers/types/customerAccount";
import {
  getBillPrimaryLabel,
  getBillTableLabel,
} from "@/features/customers/utils/billDisplay";
import { normalizePlayerName } from "@/features/cafe/utils/playerIdentity";
import {
  getPlayerCafeAmount,
  getSessionPlayerCustomerId,
  hasPlayerName,
} from "../utils/playerBillIdentity";
type StatusFilter = "pending" | "paid" | "cancelled";
type ViewFilter = StatusFilter | "all";
type DateFilter =
  | "all"
  | "today"
  | "yesterday"
  | "this-week"
  | "this-month"
  | "custom";
type PaymentMethodFilter = PaymentMethod | "all";
type TableFilter = number | "all";
const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: "Cash",
  card: "Card",
  jazzcash: "JazzCash",
  easypaisa: "Easypaisa",
};
const cancellationReasons = [
  "Wrong entry",
  "Duplicate bill",
  "Customer left unpaid",
  "Testing mistake",
  "Other",
];
function getSalePaymentLabel(sale: {
  paymentMethod: PaymentMethod;
  paymentSplits?: PaymentSplit[];
}) {
  if (!sale.paymentSplits?.length) {
    return paymentMethodLabels[sale.paymentMethod];
  }
  return sale.paymentSplits
    .map((split) => `${paymentMethodLabels[split.method]} Rs. ${split.amount}`)
    .join(" + ");
}

function formatCurrency(amount: number) {
  return `Rs. ${Math.round(amount).toLocaleString()}`;
}

function formatAmountOrDash(amount: number) {
  return amount > 0 ? formatCurrency(amount) : "—";
}

function formatCustomerDisplayName(value?: string) {
  const name = value?.trim();

  if (!name || isWalkInName(name)) {
    return "Walk-in Customer";
  }

  if (/^(ID|VIP|CEO|CFO|CTO)$/i.test(name)) {
    return name.toUpperCase();
  }

  return name.replace(/\b[\w']+\b/g, (word) =>
    word.length <= 1
      ? word.toUpperCase()
      : word[0].toUpperCase() + word.slice(1).toLowerCase(),
  );
}

function formatCustomerDisplayText(value?: string) {
  return (value ?? "")
    .split(/\s+vs\s+/i)
    .map((part) => formatCustomerDisplayName(part))
    .join(" vs ");
}

function formatGameTypeLabel(
  charges: Array<{ sessionType?: string; tableType?: string }> = [],
) {
  const playableCharges = charges.filter((charge) => charge.sessionType);
  const chargeCount = playableCharges.length;
  const suffix = chargeCount > 1 ? ` ×${chargeCount}` : "";

  if (!chargeCount) {
    return undefined;
  }

  if (playableCharges.some((charge) => charge.tableType === "private-room")) {
    return `Private Room${suffix}`;
  }

  const sessionTypes = new Set(
    playableCharges.map((charge) => charge.sessionType),
  );

  if (sessionTypes.size > 1) {
    return `Multiple Games${suffix}`;
  }

  const [sessionType] = Array.from(sessionTypes);

  if (sessionType === "single") {
    return `Single Game${suffix}`;
  }

  if (sessionType === "double") {
    return `Double Game${suffix}`;
  }

  if (sessionType === "time") {
    return `Table Booking${suffix}`;
  }

  if (sessionType === "private") {
    return `Private Room${suffix}`;
  }

  return `Table Booking${suffix}`;
}

function formatTableChargeLineLabel(
  lines: Array<{ type?: string }> = [],
  fallbackSessionType?: string,
  tableType?: string,
) {
  if (lines.length > 0) {
    const suffix = lines.length > 1 ? ` ×${lines.length}` : "";
    const types = new Set(lines.map((line) => line.type));

    if (types.size > 1) {
      return `Multiple Games${suffix}`;
    }

    const [type] = Array.from(types);

    if (type === "singleGame") {
      return `Single Game${suffix}`;
    }

    if (type === "doubleGame") {
      return `Double Game${suffix}`;
    }

    return `Table Booking${suffix}`;
  }

  return formatGameTypeLabel([
    { sessionType: fallbackSessionType, tableType },
  ]);
}

function getUsableTime(value?: string | Date) {
  if (!value) return undefined;

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? undefined : date;
}

function formatDateTimeLines(value?: string | Date) {
  const date = getUsableTime(value);

  if (!date) {
    return { date: "Time unavailable", time: "" };
  }

  return {
    date: date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    time: date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

function getPendingAge(value?: string | Date) {
  const date = getUsableTime(value);

  if (!date) return "";

  const diffMinutes = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 60000),
  );

  if (diffMinutes < 60) {
    return `${Math.max(1, diffMinutes)} min`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hrs`;
  if (diffHours < 48) return "Yesterday";

  return `${Math.floor(diffHours / 24)} days`;
}

function isValidOpenBill(bill: PendingBill) {
  return (
    bill.status !== "cancelled" &&
    getRemainingPendingBillTotal(bill) > 0
  );
}
type CheckoutRow =
  | {
      type: "pending";
      bill: PendingBill;
      playerName: string;
      customerId?: string;
      snookerAmount: number;
      cafeAmount: number;
      total: number;
    }
  | { type: "account"; account: CustomerAccount }
  | { type: "paid"; sale: Sale };
function getAccountAccessoryAmount(account: CustomerAccount) {
  return (
    account.accessoryCharges?.reduce(
      (total, charge) => total + charge.subtotal,
      0,
    ) ?? 0
  );
}
function getAccountCafeAmount(account: CustomerAccount) {
  return account.cafeCharges
    .filter((charge) => !charge.name.startsWith("[Accessory]"))
    .reduce((total, charge) => total + charge.subtotal, 0);
}
function getAccountCafeAmountForSession(
  account: CustomerAccount | undefined,
  bill: PendingBill
) {
  if (!account) return 0;

  const sessionStart = new Date(
    bill.session.startTime
  ).getTime();
  const sessionEnd = bill.session.endTime
    ? new Date(bill.session.endTime).getTime()
    : Date.now();

  return account.cafeCharges
    .filter(
      (charge) => {
        if (charge.name.startsWith("[Accessory]")) {
          return false;
        }

        if (
          charge.sessionId &&
          (charge.sessionId === bill.session.id ||
            charge.sessionId.startsWith(
              `${bill.session.id}-`
            ))
        ) {
          return true;
        }

        if (charge.sessionId) {
          return false;
        }

        const orderedAt = new Date(
          charge.orderedAt ?? charge.createdAt
        ).getTime();

        return (
          charge.tableId === bill.tableId &&
          orderedAt >= sessionStart &&
          orderedAt <= sessionEnd
        );
      }
    )
    .reduce((total, charge) => total + charge.subtotal, 0);
}
function accountHasSessionActivity(
  account: CustomerAccount,
  sessionId: string
) {
  return (
    account.gameCharges.some(
      (charge) => charge.sessionId === sessionId
    ) ||
    account.cafeCharges.some(
      (charge) => charge.sessionId === sessionId
    ) ||
    (account.accessoryCharges ?? []).some(
      (charge) => charge.sessionId === sessionId
    )
  );
}
function findPendingPlayerAccount({
  accounts,
  sessionId,
  customerId,
  playerName,
}: {
  accounts?: CustomerAccount[];
  sessionId: string;
  customerId?: string;
  playerName: string;
}) {
  if (!accounts?.length) return undefined;

  if (customerId) {
    const account = accounts.find(
      (candidate) => candidate.id === customerId
    );

    if (account) return account;
  }

  const targetName = normalizePlayerName(playerName);

  return accounts.find(
    (account) =>
      accountHasSessionActivity(account, sessionId) &&
      normalizePlayerName(account.customerName) ===
        targetName
  );
}
function getAccountsForPendingBill(
  bill: PendingBill,
  accounts?: CustomerAccount[]
) {
  if (!accounts?.length) return [];

  return accounts.filter((account) => {
    if (
      account.status !== "active" ||
      account.paymentStatus !== "unpaid"
    ) {
      return false;
    }

    if (accountHasSessionActivity(account, bill.session.id)) {
      return true;
    }

    return account.cafeCharges.some((charge) => {
      if (charge.name.startsWith("[Accessory]")) {
        return false;
      }

      return (
        getAccountCafeAmountForSession(account, bill) > 0
      );
    });
  });
}
function getPendingPayerBreakdown(
  bill: PendingBill,
  tableAmount: number
) {
  const lines = bill.session.tableChargeLines ?? [];

  if (lines.length > 0) {
    return lines.map((line) => ({
      playerName:
        line.payerName ??
        line.loserName ??
        bill.session.payerName ??
        bill.session.loserName ??
        bill.session.player1,
      tableAmountShare: line.amount,
    }));
  }

  const players = getSessionPlayers(bill.session);
  const payerName =
    bill.session.payerName ??
    bill.session.loserName ??
    players[0];

  return calculateDoubleGamePayerBreakdown({
    session: { ...bill.session, payerName },
    tableAmount,
  });
}
function getDateRange(
  filter: DateFilter,
  customStart: string,
  customEnd: string,
) {
  if (filter === "all") {
    return undefined;
  }

  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  if (filter === "yesterday") {
    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() - 1);
  }
  if (filter === "this-week") {
    const day = start.getDay();
    const diff = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - diff);
  }
  if (filter === "this-month") {
    start.setDate(1);
  }
  if (filter === "custom") {
    return {
      start: customStart ? new Date(`${customStart}T00:00:00`) : start,
      end: customEnd ? new Date(`${customEnd}T23:59:59`) : end,
    };
  }
  return { start, end };
}
function isInDateRange(value: string | Date, start: Date, end: Date) {
  const time = new Date(value).getTime();
  return time >= start.getTime() && time <= end.getTime();
}
function getPendingPlayerBillRows(
  bill: PendingBill,
  customerAccounts?: CustomerAccount[]
) {
  const linkedAccounts = getAccountsForPendingBill(
    bill,
    customerAccounts
  );
  const players = Array.from(
    new Set(
      [
        ...getSessionPlayers(bill.session),
        ...linkedAccounts.map(
          (account) => account.customerName
        ),
      ]
        .map((player) => player.trim())
        .filter(Boolean)
    ),
  );
  const paidPlayerNames = bill.paidPlayerNames ?? [];
  if (!bill.session.endTime) return [];
  const pricing = calculateGamePrice({
    sessionType: bill.session.sessionType,
    tableType: bill.tableType,
    startTime: new Date(bill.session.startTime),
    endTime: new Date(bill.session.endTime),
  });
  const payerBreakdown = getPendingPayerBreakdown(
    bill,
    pricing.gameAmount
  );
  return players
    .filter(
      (playerName) =>
        !hasPlayerName(paidPlayerNames, playerName)
    )
    .map((playerName) => {
      const sessionCafeAmount = getPlayerCafeAmount(
        bill.session,
        playerName,
      );
      const customerId = getSessionPlayerCustomerId(
        bill.session,
        playerName,
      );
      const account = findPendingPlayerAccount({
        accounts: customerAccounts,
        sessionId: bill.session.id,
        customerId,
        playerName,
      });
      const accountCafeAmount = getAccountCafeAmountForSession(
        account,
        bill
      );
      const cafeAmount = Math.max(
        sessionCafeAmount,
        accountCafeAmount
      );
      const snookerAmount = payerBreakdown.reduce(
        (total, payer) =>
          normalizePlayerName(payer.playerName) ===
          normalizePlayerName(playerName)
            ? total + payer.tableAmountShare
            : total,
        0
      );
      const total = snookerAmount + cafeAmount;
      return {
        type: "pending" as const,
        bill,
        playerName,
        customerId,
        snookerAmount,
        cafeAmount,
        total,
      };
    })
    .filter((row) => row.total > 0);
}
function getRowTime(row: CheckoutRow) {
  if (row.type === "pending") {
    return row.bill.session.endTime ?? row.bill.createdAt;
  }
  if (row.type === "account") {
    return row.account.lastActivityAt ?? row.account.openedAt;
  }
  return row.sale.endedAt ?? row.sale.createdAt;
}

function getRowPaidTime(row: CheckoutRow) {
  return row.type === "paid"
    ? row.sale.paidAt ?? row.sale.createdAt
    : undefined;
}
function getCheckoutRowDisplayName(row: CheckoutRow, name?: string) {
  if (row.type === "pending") {
    return getWalkInDisplayName({
      name,
      tableId: row.bill.tableId,
      tableName: row.bill.tableName,
      tableType: row.bill.tableType,
      time: row.bill.session.startTime,
    });
  }
  if (row.type === "account") {
    return getWalkInDisplayName({
      name,
      tableName: getBillTableLabel(row.account),
      time: row.account.lastActivityAt ?? row.account.openedAt,
    });
  }
  return getWalkInDisplayName({
    name,
    tableId: row.sale.tableId,
    tableName: row.sale.tableName,
    time: row.sale.startedAt,
  });
}
function getCheckoutRowPlayersLabel(
  row: CheckoutRow,
  account?: CustomerAccount,
) {
  if (row.type === "pending") {
    if (account) {
      if (isWalkInName(account.customerName)) {
        const note = account.customerNote?.trim();
        return note
          ? `Walk-in · ${formatCustomerDisplayText(note)}`
          : "Walk-in Customer";
      }
      return formatCustomerDisplayName(account.customerName);
    }
    return isWalkInName(row.playerName)
      ? "Walk-in Customer"
      : formatCustomerDisplayName(row.playerName);
  }
  if (row.type === "account") {
    if (isWalkInName(row.account.customerName)) {
      const note = row.account.customerNote?.trim();

      return note
        ? `Walk-in · ${formatCustomerDisplayText(note)}`
        : "Walk-in Customer";
    }

    return formatCustomerDisplayText(row.account.customerName);
  }
  if (row.sale.sessionType === "double") {
    const teamA = row.sale.teamAPlayers?.filter(Boolean) ?? [];
    const teamB = row.sale.teamBPlayers?.filter(Boolean) ?? [];
    if (teamA.length || teamB.length) {
      return [teamA.join(", "), teamB.join(", ")].filter(Boolean).join(" vs ");
    }
  }
  return row.sale.players
    .map((player) =>
      isWalkInName(player.name)
        ? "Walk-in Customer"
        : formatCustomerDisplayName(player.name),
    )
    .join(", ");
}
function getCheckoutRowBillLabel(row: CheckoutRow, account?: CustomerAccount) {
  if (row.type === "pending") {
    if (row.bill.staffBillNumber) {
      return row.bill.staffBillNumber;
    }
    if (account) {
      if (account.staffBillNumber) {
        return account.staffBillNumber;
      }
      return isWalkInName(account.customerName)
        ? getCheckoutRowDisplayName(row, account.customerName)
        : account.customerToken;
    }
    return isWalkInName(row.playerName)
      ? getCheckoutRowDisplayName(row, row.playerName)
      : row.bill.id;
  }
  if (row.type === "account") {
    return getBillPrimaryLabel(row.account);
  }
  return (
    row.sale.staffBillNumber ??
    row.sale.customerToken ??
    (isWalkInName(row.sale.payerName ?? row.sale.players[0]?.name)
      ? getCheckoutRowDisplayName(
          row,
          row.sale.payerName ?? row.sale.players[0]?.name,
        )
      : row.sale.invoiceNumber)
  );
}
function getCheckoutRowTypeLabel(row: CheckoutRow) {
  if (row.type === "pending") {
    return (
      formatTableChargeLineLabel(
        row.bill.session.tableChargeLines,
        row.bill.session.sessionType,
        row.bill.tableType,
      ) ?? "Table Booking"
    );
  }
  if (row.type === "account") {
    if (row.account.totalGameAmount > 0) {
      return formatGameTypeLabel(row.account.gameCharges) ?? "Table Booking";
    }
    if (
      getAccountAccessoryAmount(row.account) > 0 &&
      getAccountCafeAmount(row.account) === 0
    ) {
      return "Accessories Only";
    }
    return "Cafe Only";
  }
  const saleType = row.sale.saleType;
  if (saleType === "cafe-only" || saleType === "cafe_only") {
    return "Cafe Only";
  }
  if (saleType === "customer_bill") {
    return "Customer Bill";
  }
  if (saleType === "accessories") {
    return "Accessories Only";
  }

  const saleChargeLabel = formatGameTypeLabel(row.sale.gameCharges);
  if (saleChargeLabel) {
    return saleChargeLabel;
  }

  if (
    row.sale.sessionType === "private" ||
    /^private/i.test(row.sale.tableName) ||
    /^pr/i.test(row.sale.tableName)
  ) {
    return "Private Room";
  }
  if (row.sale.sessionType === "single") {
    return "Single Game";
  }
  if (row.sale.sessionType === "double") {
    return "Double Game";
  }
  return "Table Booking";
}
function getCheckoutRowAccessoryAmount(row: CheckoutRow) {
  if (row.type === "pending") {
    return 0;
  }
  if (row.type === "account") {
    return getAccountAccessoryAmount(row.account);
  }
  return (
    row.sale.cafeCharges
      ?.filter((charge) => charge.name.startsWith("[Accessory]"))
      .reduce((total, charge) => total + charge.subtotal, 0) ?? 0
  );
}
function getCheckoutRowTableAmount(row: CheckoutRow) {
  if (row.type === "pending") {
    return row.snookerAmount;
  }
  if (row.type === "account") {
    return row.account.totalGameAmount;
  }
  return row.sale.tableAmount;
}
function getCheckoutRowCafeAmount(row: CheckoutRow) {
  const accessoryAmount = getCheckoutRowAccessoryAmount(row);
  if (row.type === "pending") {
    return row.cafeAmount;
  }
  if (row.type === "account") {
    return getAccountCafeAmount(row.account);
  }
  return Math.max(row.sale.cafeAmount - accessoryAmount, 0);
}
function getCheckoutRowDiscount(row: CheckoutRow) {
  if (row.type === "paid") {
    return row.sale.discount;
  }
  if (row.type === "account") {
    return row.account.discount;
  }
  return row.bill.session.payerName &&
    row.bill.session.payerName !== row.playerName
    ? 0
    : row.bill.session.discount;
}
function getCheckoutRowTotal(row: CheckoutRow) {
  if (row.type === "paid") {
    return row.sale.grandTotal;
  }
  if (row.type === "account") {
    return row.account.grandTotal;
  }
  return Math.max(row.total - getCheckoutRowDiscount(row), 0);
}
function combinePendingRows(rows: CheckoutRow[]) {
  const pendingRows = new Map<
    string,
    Extract<CheckoutRow, { type: "pending" }>
  >();
  const combinedRows: CheckoutRow[] = [];
  rows.forEach((row) => {
    if (row.type === "paid" || row.type === "account") {
      combinedRows.push(row);
      return;
    }
    const key = row.customerId
      ? `customer-${row.customerId}`
      : `${row.bill.id}-${normalizePlayerName(row.playerName)}`;
    const existing = pendingRows.get(key);
    if (!existing) {
      pendingRows.set(key, row);
      combinedRows.push(row);
      return;
    }
    existing.snookerAmount += row.snookerAmount;
    existing.cafeAmount += row.cafeAmount;
    existing.total += row.total;
  });
  return combinedRows;
}
function dedupeCheckoutRows(rows: CheckoutRow[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const account = row.type === "account" ? row.account : undefined;
    const key =
      row.type === "account"
        ? `account-${row.account.id}`
        : row.type === "pending"
          ? `pending-${row.customerId ?? row.bill.staffBillNumber ?? row.bill.id}`
          : `paid-${row.sale.id}`;
    const billLabel = getCheckoutRowBillLabel(row, account);
    const stableKey = row.type === "paid" ? key : `open-${billLabel}`;
    if (seen.has(stableKey)) {
      return false;
    }
    seen.add(stableKey);
    return true;
  });
}
function isCheckoutTableSale(sale: Sale) {
  return sale.saleType === undefined || sale.saleType === "table";
}
function CheckoutPage() {
  const navigate = useNavigate();
  const pendingBills = useCheckoutStore((state) => state.pendingBills);
  const receivePendingBillPayment = useCheckoutStore(
    (state) => state.receivePendingBillPayment,
  );
  const receivePendingPlayerBillPayment = useCheckoutStore(
    (state) => state.receivePendingPlayerBillPayment,
  );
  const removePendingBill = useCheckoutStore(
    (state) => state.removePendingBill,
  );
  const cancelPendingBill = useCheckoutStore(
    (state) => state.cancelPendingBill,
  );
  const updatePendingBillDiscount = useCheckoutStore(
    (state) => state.updatePendingBillDiscount,
  );
  const sales = useSalesStore((state) => state.sales);
  const deleteSale = useSalesStore((state) => state.deleteSale);
  const activeBusinessDay = useBusinessDayStore((state) =>
    state.getActiveBusinessDay(),
  );
  const customerAccounts = useCustomerAccountStore((state) => state.accounts);
  const [selectedBill, setSelectedBill] = useState<PendingBill | null>(null);
  const [selectedPlayerName, setSelectedPlayerName] = useState<
    string | undefined
  >();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ViewFilter>("pending");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [paymentMethodFilter, setPaymentMethodFilter] =
    useState<PaymentMethodFilter>("all");
  const [tableFilter, setTableFilter] = useState<TableFilter>("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [message, setMessage] = useState("");
  const [billToCancel, setBillToCancel] = useState<PendingBill | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelNote, setCancelNote] = useState("");
  const [cancelError, setCancelError] = useState("");
  const customerAccountById = useMemo(
    () => new Map(customerAccounts.map((account) => [account.id, account])),
    [customerAccounts],
  );
  useEffect(() => {
    pendingBills.forEach((bill) => {
      const alreadyPaid = sales.some(
        (sale) =>
          sale.sessionId === bill.session.id || sale.sessionId === bill.id,
      );
      if (alreadyPaid) {
        removePendingBill(bill.id);
      }
    });
  }, [pendingBills, removePendingBill, sales]);
  const unpaidBills = useMemo(
    () =>
      pendingBills.filter(
        (bill) =>
          !sales.some(
            (sale) =>
              sale.sessionId === bill.session.id || sale.sessionId === bill.id,
          ),
      ),
    [pendingBills, sales],
  );
  const activePendingBills = useMemo(
    () => unpaidBills.filter((bill) => isValidOpenBill(bill)),
    [unpaidBills],
  );
  const cancelledBills = useMemo(
    () => unpaidBills.filter((bill) => bill.status === "cancelled"),
    [unpaidBills],
  );
  const openCustomerAccountBills = useMemo(
    () =>
      customerAccounts.filter(
        (account) =>
          account.status === "active" &&
          account.paymentStatus === "unpaid" &&
          account.grandTotal > 0,
      ),
    [customerAccounts],
  );
  const displayPendingBills = useMemo(
    () =>
      activePendingBills.filter((bill) => {
        const billStaffNumber = bill.staffBillNumber;
        return !openCustomerAccountBills.some((account) => {
          return (
            billStaffNumber &&
            account.staffBillNumber === billStaffNumber
          );
        });
      }),
    [activePendingBills, openCustomerAccountBills],
  );
  const activeCustomerAccounts = useMemo(() => {
    const pendingCustomerIds = new Set<string>();
    displayPendingBills.forEach((bill) => {
      [
        bill.session.player1CustomerId,
        bill.session.player2CustomerId,
        bill.session.player3CustomerId,
        bill.session.player4CustomerId,
      ]
        .filter((id): id is string => Boolean(id))
        .forEach((id) => pendingCustomerIds.add(id));
    });
    return openCustomerAccountBills.filter(
      (account) => !pendingCustomerIds.has(account.id),
    );
  }, [displayPendingBills, openCustomerAccountBills]);
  const checkoutSales = useMemo(
    () => sales.filter(isCheckoutTableSale),
    [sales],
  );
  const todaySales = useMemo(() => {
    const today = new Date();
    return checkoutSales.filter((sale) => {
      const createdAt = new Date(sale.createdAt);
      return createdAt.toDateString() === today.toDateString();
    });
  }, [checkoutSales]);
  const totalReceivedToday = todaySales.reduce(
    (total, sale) => total + sale.grandTotal,
    0,
  );
  const openRows = useMemo(
    () =>
      dedupeCheckoutRows(
        combinePendingRows([
          ...displayPendingBills.flatMap((bill) =>
            getPendingPlayerBillRows(
              bill,
              openCustomerAccountBills
            )
          ),
          ...activeCustomerAccounts.map((account) => ({
            type: "account" as const,
            account,
          })),
        ])
      ),
    [
      activeCustomerAccounts,
      displayPendingBills,
      openCustomerAccountBills,
    ]
  );
  const openBillsCount = openRows.length;
  const openAmount = openRows.reduce(
    (total, row) => total + getCheckoutRowTotal(row),
    0
  );
  const rowsForTableOptions = useMemo(() => {
    const query = search.trim().toLowerCase();
    const range = getDateRange(dateFilter, customStart, customEnd);
    const rows: CheckoutRow[] =
      statusFilter === "pending"
        ? [
            ...displayPendingBills.flatMap((bill) =>
              getPendingPlayerBillRows(
                bill,
                openCustomerAccountBills
              ),
            ),
            ...activeCustomerAccounts.map((account) => ({
              type: "account" as const,
              account,
            })),
          ]
        : statusFilter === "paid"
          ? checkoutSales.map((sale) => ({ type: "paid", sale }))
          : statusFilter === "cancelled"
            ? cancelledBills.flatMap((bill) =>
                getPendingPlayerBillRows(
                  bill,
                  openCustomerAccountBills
                )
              )
            : [
                ...displayPendingBills.flatMap((bill) =>
                  getPendingPlayerBillRows(
                    bill,
                    openCustomerAccountBills
                  ),
                ),
                ...activeCustomerAccounts.map((account) => ({
                  type: "account" as const,
                  account,
                })),
                ...cancelledBills.flatMap((bill) =>
                  getPendingPlayerBillRows(
                    bill,
                    openCustomerAccountBills
                  ),
                ),
                ...checkoutSales.map((sale) => ({
                  type: "paid" as const,
                  sale,
                })),
              ];
    const tableFilteredRows = dedupeCheckoutRows(
      combinePendingRows(rows),
    ).filter((row) => {
      if (
        range &&
        !isInDateRange(getRowTime(row), range.start, range.end)
      ) {
        return false;
      }
      if (
        paymentMethodFilter !== "all" &&
        row.type === "paid" &&
        !(
          row.sale.paymentMethod === paymentMethodFilter ||
          row.sale.paymentSplits?.some(
            (split) => split.method === paymentMethodFilter,
          )
        )
      ) {
        return false;
      }
      return true;
    });
    return tableFilteredRows
      .filter((row) => {
        if (!query) return true;
        const invoice =
          row.type === "pending"
            ? row.bill.id
            : row.type === "account"
              ? row.account.customerToken
              : row.sale.invoiceNumber;
        const tableName =
          row.type === "pending"
            ? row.bill.tableName
            : row.type === "account"
              ? getBillTableLabel(row.account) || "-"
              : row.sale.tableName;
        const players =
          row.type === "pending"
            ? [row.playerName]
            : row.type === "account"
              ? [row.account.customerName]
              : row.sale.players.map((player) => player.name);
        const account =
          row.type === "pending" && row.customerId
            ? customerAccountById.get(row.customerId)
            : row.type === "account"
              ? row.account
              : undefined;
        const displayPlayers = getCheckoutRowPlayersLabel(row, account);
        const billLabel = getCheckoutRowBillLabel(row, account);
        const payerName =
          row.type === "pending"
            ? row.bill.session.payerName
            : row.type === "account"
              ? row.account.customerName
              : row.sale.payerName;
        const displayPayer = getCheckoutRowDisplayName(row, payerName);
        const paymentMethod =
          row.type === "paid" ? getSalePaymentLabel(row.sale) : "";
        const accountCafeItems =
          row.type === "account"
            ? row.account.cafeCharges.map((charge) => charge.name).join(" ")
            : "";
        const playerNames = players.filter(Boolean).join(" ").toLowerCase();
        return (
          invoice.toLowerCase().includes(query) ||
          billLabel.toLowerCase().includes(query) ||
          (account?.customerToken ?? "").toLowerCase().includes(query) ||
          (account?.customerName ?? "").toLowerCase().includes(query) ||
          (account?.customerNote ?? "").toLowerCase().includes(query) ||
          tableName.toLowerCase().includes(query) ||
          playerNames.includes(query) ||
          displayPlayers.toLowerCase().includes(query) ||
          (payerName ?? "").toLowerCase().includes(query) ||
          displayPayer.toLowerCase().includes(query) ||
          paymentMethod.toLowerCase().includes(query) ||
          accountCafeItems.toLowerCase().includes(query) ||
          (row.type === "pending" &&
            (row.bill.cancelledReason ?? "").toLowerCase().includes(query)) ||
          (row.type === "pending" &&
            (row.bill.cancelledNote ?? "").toLowerCase().includes(query))
        );
      })
      .sort((first, second) => {
        const firstTime = new Date(getRowTime(first)).getTime();
        const secondTime = new Date(getRowTime(second)).getTime();
        return secondTime - firstTime;
      });
  }, [
    customEnd,
    customStart,
    dateFilter,
    displayPendingBills,
    activeCustomerAccounts,
    cancelledBills,
    paymentMethodFilter,
    search,
    statusFilter,
    checkoutSales,
    customerAccountById,
    openCustomerAccountBills,
  ]);
  const tableOptions = useMemo(() => {
    const options = new Map<number, string>();
    rowsForTableOptions.forEach((row) => {
      if (row.type === "pending") {
        options.set(row.bill.tableId, row.bill.tableName);
        return;
      }
      if (row.type === "account") {
        row.account.gameCharges.forEach((charge) =>
          options.set(charge.tableId, charge.tableName),
        );
        return;
      }
      if (row.sale.tableId > 0) {
        options.set(row.sale.tableId, row.sale.tableName);
      }
    });
    return Array.from(options.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((first, second) =>
        first.id === second.id
          ? first.name.localeCompare(second.name)
          : first.id - second.id,
      );
  }, [rowsForTableOptions]);
  const checkoutRows = useMemo(
    () =>
      rowsForTableOptions.filter((row) => {
        if (tableFilter === "all") {
          return true;
        }
        return row.type === "pending"
          ? row.bill.tableId === tableFilter
          : row.type === "account"
            ? row.account.gameCharges.some(
                (charge) => charge.tableId === tableFilter,
              )
            : row.sale.tableId === tableFilter;
      }),
    [rowsForTableOptions, tableFilter],
  );
  const unsearchedRowsCount = rowsForTableOptions.filter((row) => {
    if (tableFilter === "all") return true;

    return row.type === "pending"
      ? row.bill.tableId === tableFilter
      : row.type === "account"
        ? row.account.gameCharges.some(
            (charge) => charge.tableId === tableFilter,
          )
        : row.sale.tableId === tableFilter;
  }).length;
  const isDefaultFilterState =
    statusFilter === "pending" &&
    dateFilter === "all" &&
    paymentMethodFilter === "all" &&
    tableFilter === "all" &&
    !search.trim() &&
    !customStart &&
    !customEnd;
  const statusNoun =
    statusFilter === "pending"
      ? "pending bills"
      : statusFilter === "paid"
        ? "paid bills"
        : statusFilter === "cancelled"
          ? "cancelled bills"
          : "bills";
  const resultSummary =
    isDefaultFilterState && checkoutRows.length !== openBillsCount
      ? `Showing ${checkoutRows.length} of ${openBillsCount} open bills`
      : search.trim()
        ? `Showing ${checkoutRows.length} matching bills`
        : checkoutRows.length === unsearchedRowsCount
          ? `Showing ${checkoutRows.length} ${statusNoun}`
          : `Showing ${checkoutRows.length} of ${unsearchedRowsCount} ${statusNoun}`;
  const filteredTotals = useMemo(
    () =>
      checkoutRows.reduce(
        (summary, row) => ({
          table: summary.table + getCheckoutRowTableAmount(row),
          cafe: summary.cafe + getCheckoutRowCafeAmount(row),
          accessories:
            summary.accessories + getCheckoutRowAccessoryAmount(row),
          total: summary.total + getCheckoutRowTotal(row),
        }),
        { table: 0, cafe: 0, accessories: 0, total: 0 },
      ),
    [checkoutRows],
  );
  const clearFilters = () => {
    setStatusFilter("pending");
    setDateFilter("all");
    setPaymentMethodFilter("all");
    setTableFilter("all");
    setSearch("");
    setCustomStart("");
    setCustomEnd("");
  };
  const showPaymentColumn = statusFilter === "paid" || statusFilter === "all";
  const showStatusColumn = statusFilter !== "paid";
  const showAccessoriesColumn = true;
  const emptyColumnCount =
    9 +
    (showAccessoriesColumn ? 1 : 0) +
    (showStatusColumn ? 1 : 0) +
    (showPaymentColumn ? 1 : 0);
  const handleReceivePayment = (
    paymentMethod: PaymentMethod,
    payerName?: string,
    paymentSplits?: PaymentSplit[],
    discount?: number,
  ) => {
    if (!selectedBill) return;
    if (selectedBill.status === "cancelled") {
      setMessage("Cancelled bills cannot receive payment.");
      return;
    }
    if (!activeBusinessDay) {
      setMessage("Please start the day before receiving payment.");
      return;
    }
    receivePendingBillPayment({
      billId: selectedBill.id,
      paymentMethod,
      paymentSplits,
      payerName,
      discount,
    });
    setSelectedBill(null);
  };
  const handleReceivePlayerBill = (input: {
    paymentMethod: PaymentMethod;
    paymentSplits?: PaymentSplit[];
    payerName?: string;
    playerName: string;
    tableAmount: number;
    cafeAmount: number;
    cafeItems: PendingBill["session"]["cafeOrders"];
    allPlayerNames: string[];
    discount?: number;
  }) => {
    if (!selectedBill) return;
    if (selectedBill.status === "cancelled") {
      setMessage("Cancelled bills cannot receive payment.");
      return;
    }
    if (!activeBusinessDay) {
      setMessage("Please start the day before receiving payment.");
      return;
    }
    receivePendingPlayerBillPayment({ billId: selectedBill.id, ...input });
    const paidPlayerNames = selectedBill.paidPlayerNames ?? [];
    const nextPaidPlayerNames = paidPlayerNames.includes(input.playerName)
      ? paidPlayerNames
      : [...paidPlayerNames, input.playerName];
    const allBillsReceived = input.allPlayerNames.every((name) =>
      nextPaidPlayerNames.includes(name),
    );
    if (allBillsReceived) {
      setSelectedBill(null);
      setSelectedPlayerName(undefined);
    } else {
      setSelectedBill({
        ...selectedBill,
        paidPlayerNames: nextPaidPlayerNames,
      });
    }
  };
  const handleUpdateSelectedBillDiscount = (discount: number) => {
    if (!selectedBill) return;
    updatePendingBillDiscount(selectedBill.id, discount);
    setSelectedBill({
      ...selectedBill,
      session: { ...selectedBill.session, discount },
    });
  };
  const handleCancelPendingBill = (bill: PendingBill) => {
    setBillToCancel(bill);
    setCancelReason("");
    setCancelNote("");
    setCancelError("");
  };
  const confirmCancelPendingBill = () => {
    if (!billToCancel) return;
    const reason = cancelReason.trim();
    const note = cancelNote.trim();
    if (!reason) {
      setCancelError("Please select a cancellation reason.");
      return;
    }
    if (reason === "Other" && !note) {
      setCancelError("Please enter a note for Other.");
      return;
    }
    cancelPendingBill({ billId: billToCancel.id, reason, note });
    useCustomerAccountStore
      .getState()
      .removeSessionCharges(billToCancel.session.id);
    if (selectedBill?.id === billToCancel.id) {
      setSelectedBill(null);
      setSelectedPlayerName(undefined);
    }
    setMessage(
      `Cancelled bill ${billToCancel.staffBillNumber ?? billToCancel.id}.`,
    );
    setBillToCancel(null);
  };
  const handleDeleteSale = (sale: Sale) => {
    const confirmed = window.confirm(
      `Delete paid bill ${sale.invoiceNumber}? This is for removing mistaken test bills.`,
    );
    if (!confirmed) return;
    deleteSale(sale.id);
    setMessage(`Deleted paid bill ${sale.invoiceNumber}.`);
  };
  const openCheckoutRow = (row: CheckoutRow) => {
    if (row.type === "account") {
      navigate(`/operator/customer-bills?customerBillId=${row.account.id}`);
      return;
    }

    if (row.type === "pending") {
      const sessionCafeAmount = getPlayerCafeAmount(
        row.bill.session,
        row.playerName
      );
      const missingCafeAmount = Math.max(
        row.cafeAmount - sessionCafeAmount,
        0
      );
      const orderedAt = new Date(
        row.bill.session.endTime ??
          row.bill.createdAt
      ).toISOString();

      setSelectedBill(
        missingCafeAmount > 0
          ? {
              ...row.bill,
              session: {
                ...row.bill.session,
                cafeAmount:
                  row.bill.session.cafeAmount +
                  missingCafeAmount,
                cafeOrders: [
                  ...row.bill.session.cafeOrders,
                  {
                    menuItemId: `ACCOUNT-CAFE-${row.bill.id}-${row.playerName}`,
                    name: "Cafe Bill",
                    price: missingCafeAmount,
                    quantity: 1,
                    subtotal: missingCafeAmount,
                    timeAdded: new Date(orderedAt),
                    tableId: row.bill.tableId,
                    sessionId: row.bill.session.id,
                    customerName: row.playerName,
                    playerName: row.playerName,
                    playerId: row.customerId,
                    orderedAt,
                  },
                ],
              },
            }
          : row.bill
      );
      setSelectedPlayerName(row.playerName);
    }
  };
  return (
    <main className="min-h-screen bg-slate-100 px-6 py-6">
      {" "}
      <div className="mx-auto max-w-[1600px]">
        {" "}
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          {" "}
          <div>
            {" "}
            <Button
              variant="ghost"
              className="mb-3 gap-2"
              onClick={() => navigate("/operator")}
            >
              {" "}
              <ArrowLeft className="h-4 w-4" /> Dashboard{" "}
            </Button>{" "}
            <div className="flex items-center gap-3">
              {" "}
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-slate-700 shadow-sm ring-1 ring-slate-200">
                {" "}
                <ReceiptText className="h-5 w-5" />{" "}
              </div>{" "}
              <div>
                {" "}
                <h1 className="text-2xl font-bold text-slate-950">
                  {" "}
                  Customer Bills / Checkout{" "}
                </h1>{" "}
                <p className="text-sm text-slate-500">
                  {" "}
                  Ended game bills waiting for payment.{" "}
                </p>{" "}
              </div>{" "}
            </div>{" "}
          </div>{" "}
        </div>{" "}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {" "}
          <Card className="p-4">
            {" "}
            <p className="text-sm text-slate-500"> Open Bills </p>{" "}
            <p className="mt-1 text-2xl font-bold">
              {" "}
              {openBillsCount.toLocaleString()} bills{" "}
            </p>{" "}
          </Card>{" "}
          <Card className="p-4">
            {" "}
            <p className="text-sm text-slate-500"> Outstanding Amount </p>{" "}
            <p className="mt-1 text-2xl font-bold">
              {" "}
              {formatCurrency(openAmount)}{" "}
            </p>{" "}
          </Card>{" "}
          <Card className="p-4">
            {" "}
            <p className="text-sm text-slate-500"> Paid Bills Today </p>{" "}
            <p className="mt-1 text-2xl font-bold">
              {" "}
              {todaySales.length.toLocaleString()}{" "}
            </p>{" "}
          </Card>{" "}
          <Card className="p-4">
            {" "}
            <p className="text-sm text-slate-500"> Amount Received Today </p>{" "}
            <p className="mt-1 text-2xl font-bold">
              {" "}
              {formatCurrency(totalReceivedToday)}{" "}
            </p>{" "}
          </Card>{" "}
        </section>{" "}
        {message && (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {" "}
            {message}{" "}
          </p>
        )}{" "}
        <Card className="mt-5 overflow-hidden">
          {" "}
          <div className="grid gap-3 border-b p-4">
            {" "}
            <div className="flex items-center gap-2">
              {" "}
              <Search className="h-4 w-4 text-slate-400" />{" "}
              <Input
                placeholder="Search bill no, customer, player, table..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />{" "}
            </div>{" "}
            <div className="flex flex-wrap items-center gap-3">
              {" "}
              <div className="flex rounded-lg border bg-white p-1">
                {" "}
                {(["pending", "paid", "cancelled", "all"] as ViewFilter[]).map(
                  (value) => (
                    <Button
                      key={value}
                      variant={statusFilter === value ? "default" : "ghost"}
                      onClick={() => setStatusFilter(value)}
                    >
                      {" "}
                      {value === "all"
                        ? "All"
                        : value === "paid"
                          ? "Paid"
                          : value === "cancelled"
                            ? "Cancelled"
                            : "Pending"}{" "}
                    </Button>
                  ),
                )}{" "}
              </div>{" "}
              <div className="flex flex-wrap rounded-lg border bg-white p-1">
                {" "}
                {(
                  [
                    ["all", "All Dates"],
                    ["today", "Today"],
                    ["yesterday", "Yesterday"],
                    ["this-week", "This Week"],
                    ["this-month", "This Month"],
                    ["custom", "Custom Range"],
                  ] as [DateFilter, string][]
                ).map(([value, label]) => (
                  <Button
                    key={value}
                    variant={dateFilter === value ? "default" : "ghost"}
                    onClick={() => setDateFilter(value)}
                  >
                    {" "}
                    {label}{" "}
                  </Button>
                ))}{" "}
              </div>{" "}
              <select
                className="h-10 rounded-md border bg-white px-3 text-sm"
                value={paymentMethodFilter}
                onChange={(event) =>
                  setPaymentMethodFilter(
                    event.target.value as PaymentMethodFilter,
                  )
                }
              >
                {" "}
                <option value="all"> All Payments </option>{" "}
                <option value="cash">Cash</option>{" "}
                <option value="card">Card</option>{" "}
                <option value="jazzcash"> JazzCash </option>{" "}
                <option value="easypaisa"> Easypaisa </option>{" "}
              </select>{" "}
              <select
                className="h-10 rounded-md border bg-white px-3 text-sm"
                value={tableFilter}
                onChange={(event) =>
                  setTableFilter(
                    event.target.value === "all"
                      ? "all"
                      : Number(event.target.value),
                  )
                }
              >
                {" "}
                <option value="all"> All Tables </option>{" "}
                {tableOptions.map((table) => (
                  <option key={table.id} value={table.id}>
                    {" "}
                    {table.name}{" "}
                  </option>
                ))}{" "}
              </select>{" "}
            </div>{" "}
            {dateFilter === "custom" && (
              <div className="grid gap-3 sm:grid-cols-2">
                {" "}
                <Input
                  type="date"
                  value={customStart}
                  onChange={(event) => setCustomStart(event.target.value)}
                />{" "}
                <Input
                  type="date"
                  value={customEnd}
                  onChange={(event) => setCustomEnd(event.target.value)}
                />{" "}
              </div>
            )}{" "}
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <div>
                <p className="font-medium text-slate-600">{resultSummary}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span>
                    {statusFilter === "pending"
                      ? "Outstanding in current view"
                      : statusFilter === "paid"
                        ? "Paid total in current view"
                        : statusFilter === "cancelled"
                          ? "Cancelled historical total"
                          : "Total in current view"}
                    :{" "}
                    <strong className="text-slate-800">
                      {formatCurrency(filteredTotals.total)}
                    </strong>
                  </span>
                  <span>
                    Table{" "}
                    <strong className="text-slate-700">
                      {formatCurrency(filteredTotals.table)}
                    </strong>
                  </span>
                  <span>
                    Cafe{" "}
                    <strong className="text-slate-700">
                      {formatCurrency(filteredTotals.cafe)}
                    </strong>
                  </span>
                  <span>
                    Accessories{" "}
                    <strong className="text-slate-700">
                      {formatCurrency(filteredTotals.accessories)}
                    </strong>
                  </span>
                </div>
              </div>
              {!isDefaultFilterState && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </div>{" "}
          <div className="max-h-[calc(100vh-23rem)] min-h-[220px] w-full overflow-auto pb-2">
            {" "}
            <table
              className={`${
                showPaymentColumn && showStatusColumn
                  ? "w-[1468px]"
                  : showPaymentColumn
                    ? "w-[1336px]"
                    : "w-[1316px]"
              } table-fixed text-left text-sm`}
            >
              <colgroup>
                <col className="w-[7rem]" />
                <col className="w-[8rem]" />
                <col className="w-[8rem]" />
                <col className="w-[5.75rem]" />
                <col className="w-[11.5rem]" />
                <col className="w-[6.5rem]" />
                <col className="w-[6.5rem]" />
                <col className="w-[7rem]" />
                <col className="w-[6.5rem]" />
                {showStatusColumn && <col className="w-[8.25rem]" />}
                {showPaymentColumn && <col className="w-[9.5rem]" />}
                <col className="w-[7.25rem]" />
              </colgroup>
              {" "}
              <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase text-slate-500 shadow-sm">
                {" "}
                <tr>
                  {" "}
                  <th className="whitespace-nowrap px-3 py-2.5">
                    {" "}
                    Bill No{" "}
                  </th>{" "}
                  <th className="whitespace-nowrap px-3 py-2.5">
                    {" "}
                    Ended At{" "}
                  </th>{" "}
                  <th className="whitespace-nowrap px-3 py-2.5"> Type </th>{" "}
                  <th className="whitespace-nowrap px-3 py-2.5"> Table </th>{" "}
                  <th className="whitespace-nowrap px-3 py-2.5"> Customer / Players </th>{" "}
                  <th className="whitespace-nowrap px-3 py-2.5 text-right"> Table Bill </th>{" "}
                  <th className="whitespace-nowrap px-3 py-2.5 text-right"> Cafe Bill </th>{" "}
                  {showAccessoriesColumn && (
                    <th className="whitespace-nowrap px-3 py-2.5 text-right"> Accessories </th>
                  )}{" "}
                  <th className="whitespace-nowrap px-3 py-2.5 text-right"> Total </th>{" "}
                  {showStatusColumn && <th className="whitespace-nowrap px-3 py-2.5"> Status </th>}{" "}
                  {showPaymentColumn && (
                    <th className="whitespace-nowrap px-3 py-2.5"> Payment Method </th>
                  )}{" "}
                  <th className="whitespace-nowrap px-3 py-2.5 text-right"> Action </th>{" "}
                </tr>{" "}
              </thead>{" "}
              <tbody>
                {" "}
                {checkoutRows.map((row) => {
                  const account =
                    row.type === "account"
                      ? row.account
                      : row.type === "pending" && row.customerId
                        ? customerAccountById.get(row.customerId)
                        : undefined;
                  const endedAt = formatDateTimeLines(getRowTime(row));
                  const paidAt = formatDateTimeLines(getRowPaidTime(row));
                  const statusLabel =
                    row.type === "pending"
                      ? row.bill.status === "cancelled"
                        ? "Cancelled"
                        : "Awaiting Payment"
                      : row.type === "account"
                        ? "Awaiting Payment"
                        : "Paid";
                  const pendingAge =
                    row.type === "pending" || row.type === "account"
                      ? getPendingAge(getRowTime(row))
                      : "";
                  return (
                    <tr
                      key={
                        row.type === "pending"
                          ? `${row.bill.id}-${row.playerName}`
                          : row.type === "account"
                            ? `account-${row.account.id}`
                            : row.sale.id
                      }
                      tabIndex={0}
                      onClick={() => openCheckoutRow(row)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          openCheckoutRow(row);
                        }
                      }}
                      className="group cursor-pointer border-t bg-white transition hover:bg-amber-50/40 focus:bg-amber-50/40 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-amber-300"
                    >
                      {" "}
                      <td className="whitespace-nowrap px-3 py-2 align-middle font-mono text-sm font-semibold text-slate-900">
                        {" "}
                        {getCheckoutRowBillLabel(row, account)}{" "}
                      </td>{" "}
                      <td className="px-3 py-2 align-middle text-slate-700">
                        <span className="block whitespace-nowrap font-medium text-slate-700">
                          {endedAt.date}
                        </span>
                        {endedAt.time && (
                          <span className="block whitespace-nowrap text-xs text-slate-500">
                            {endedAt.time}
                          </span>
                        )}
                        {getRowPaidTime(row) && paidAt.time && (
                          <span className="block whitespace-nowrap text-xs text-emerald-700">
                            Paid {paidAt.time}
                          </span>
                        )}
                      </td>{" "}
                      <td className="whitespace-nowrap px-3 py-2 align-middle">
                        {" "}
                        {getCheckoutRowTypeLabel(row)}{" "}
                      </td>{" "}
                      <td className="whitespace-nowrap px-3 py-2 align-middle">
                        {" "}
                        {row.type === "pending"
                          ? row.bill.tableName
                          : row.type === "account"
                            ? getBillTableLabel(row.account) || "-"
                            : row.sale.tableName}{" "}
                      </td>{" "}
                      <td className="px-3 py-2 align-middle">
                        {" "}
                        {getCheckoutRowPlayersLabel(row, account)}{" "}
                      </td>{" "}
                      <td className="px-3 py-2 text-right align-middle tabular-nums">
                        {formatAmountOrDash(getCheckoutRowTableAmount(row))}
                      </td>{" "}
                      <td className="px-3 py-2 text-right align-middle tabular-nums">
                        {formatAmountOrDash(getCheckoutRowCafeAmount(row))}
                      </td>{" "}
                      {showAccessoriesColumn && (
                        <td className="px-3 py-2 text-right align-middle tabular-nums">
                          {formatAmountOrDash(
                            getCheckoutRowAccessoryAmount(row),
                          )}
                        </td>
                      )}{" "}
                      <td className="px-3 py-2 text-right align-middle font-bold tabular-nums text-slate-950">
                        {formatCurrency(getCheckoutRowTotal(row))}
                      </td>{" "}
                      {showStatusColumn && (
                        <td className="px-3 py-2 align-middle">
                          {" "}
                          <span
                            className={
                              row.type === "pending" &&
                              row.bill.status === "cancelled"
                                ? "whitespace-nowrap rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-red-200"
                                : row.type === "pending" ||
                                    row.type === "account"
                                  ? "whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200"
                                  : "whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200"
                            }
                          >
                            {statusLabel}
                          </span>{" "}
                          {pendingAge && (
                            <p className="mt-0.5 text-xs leading-tight text-slate-500">
                              {pendingAge}
                            </p>
                          )}
                        </td>
                      )}{" "}
                      {showPaymentColumn && (
                        <td className="px-3 py-2">
                          {" "}
                          {row.type === "pending" || row.type === "account"
                            ? "-"
                            : getSalePaymentLabel(row.sale)}{" "}
                        </td>
                      )}{" "}
                      <td className="px-3 py-2 text-right align-middle">
                        {" "}
                        {row.type === "pending" || row.type === "account" ? (
                          <div className="flex flex-nowrap justify-end gap-2">
                            {" "}
                            <Button
                              size="sm"
                              className="h-8 whitespace-nowrap px-3"
                              variant={
                                row.type === "pending" &&
                                row.bill.status === "cancelled"
                                  ? "outline"
                                  : "default"
                              }
                              onClick={(event) => {
                                event.stopPropagation();
                                openCheckoutRow(row);
                              }}
                            >
                              {" "}
                              {row.type === "pending" &&
                              row.bill.status === "cancelled"
                                ? "View Details"
                                : "View & Pay"}{" "}
                            </Button>{" "}
                            {row.type === "pending" &&
                              row.bill.status !== "cancelled" && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="gap-1 whitespace-nowrap border-red-200 text-red-700 hover:bg-red-50"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleCancelPendingBill(row.bill);
                                  }}
                                >
                                  {" "}
                                  <Trash2 className="h-3.5 w-3.5" /> Cancel
                                  Bill{" "}
                                </Button>
                              )}{" "}
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1 whitespace-nowrap border-red-200 text-red-700 hover:bg-red-50"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDeleteSale(row.sale);
                            }}
                          >
                            {" "}
                            <Trash2 className="h-3.5 w-3.5" /> Delete{" "}
                          </Button>
                        )}{" "}
                      </td>{" "}
                    </tr>
                  );
                })}{" "}
                {checkoutRows.length === 0 && (
                  <tr>
                    {" "}
                    <td
                      colSpan={emptyColumnCount}
                      className="px-4 py-10 text-center text-slate-500"
                    >
                      {" "}
                      {statusFilter === "pending"
                        ? "No pending bills found."
                        : statusFilter === "paid"
                          ? "No paid bills found today."
                          : statusFilter === "cancelled"
                            ? "No cancelled bills found."
                            : "No bills found."}{" "}
                    </td>{" "}
                  </tr>
                )}{" "}
              </tbody>{" "}
            </table>{" "}
          </div>{" "}
        </Card>{" "}
      </div>{" "}
      {selectedBill && (
        <BillingDialog
          open={!!selectedBill}
          session={selectedBill.session}
          tableType={selectedBill.tableType}
          tableName={selectedBill.tableName}
          billNumber={selectedBill.staffBillNumber ?? selectedBill.id}
          status={
            selectedBill.status === "cancelled" ? "Cancelled" : "Awaiting Payment"
          }
          playerName={selectedPlayerName}
          paidPlayerNames={selectedBill.paidPlayerNames}
          onClose={() => {
            setSelectedBill(null);
            setSelectedPlayerName(undefined);
          }}
          onUpdateDiscount={handleUpdateSelectedBillDiscount}
          canReceivePayment={
            !!activeBusinessDay && selectedBill.status !== "cancelled"
          }
          readOnly={selectedBill.status === "cancelled"}
          cancelledAt={selectedBill.cancelledAt}
          cancelledReason={selectedBill.cancelledReason}
          cancelledNote={selectedBill.cancelledNote}
          onPaymentBlocked={() =>
            setMessage(
              "Please start the day and enter the operator name before receiving payment.",
            )
          }
          onReceivePayment={handleReceivePayment}
          onReceivePlayerBill={handleReceivePlayerBill}
        />
      )}{" "}
      {billToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
          {" "}
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            {" "}
            <h2 className="text-lg font-bold text-slate-950">
              {" "}
              Cancel unpaid bill?{" "}
            </h2>{" "}
            <p className="mt-2 text-sm text-slate-600">
              {" "}
              Are you sure you want to cancel this unpaid bill? It will stay in
              history with Cancelled status.{" "}
            </p>{" "}
            <div className="mt-4 space-y-3">
              {" "}
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                {" "}
                Cancellation reason{" "}
                <select
                  className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                  value={cancelReason}
                  onChange={(event) => {
                    setCancelReason(event.target.value);
                    setCancelError("");
                  }}
                >
                  {" "}
                  <option value=""> Select reason </option>{" "}
                  {cancellationReasons.map((reason) => (
                    <option key={reason} value={reason}>
                      {" "}
                      {reason}{" "}
                    </option>
                  ))}{" "}
                </select>{" "}
              </label>{" "}
              {cancelReason === "Other" && (
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  {" "}
                  Note{" "}
                  <textarea
                    className="min-h-24 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                    placeholder="Write the reason"
                    value={cancelNote}
                    onChange={(event) => {
                      setCancelNote(event.target.value);
                      setCancelError("");
                    }}
                  />{" "}
                </label>
              )}{" "}
              {cancelError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200">
                  {" "}
                  {cancelError}{" "}
                </p>
              )}{" "}
            </div>{" "}
            <div className="mt-5 flex justify-end gap-2">
              {" "}
              <Button variant="outline" onClick={() => setBillToCancel(null)}>
                {" "}
                Keep Bill{" "}
              </Button>{" "}
              <Button
                className="bg-red-700 hover:bg-red-800"
                disabled={
                  !cancelReason ||
                  (cancelReason === "Other" && !cancelNote.trim())
                }
                onClick={confirmCancelPendingBill}
              >
                {" "}
                Cancel Bill{" "}
              </Button>{" "}
            </div>{" "}
          </div>{" "}
        </div>
      )}{" "}
    </main>
  );
}
export default CheckoutPage;
