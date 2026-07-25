import { ArrowLeft, CheckCircle2, ReceiptText, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { BillContextMenu, type BillContextMenuAction } from "@/components/ui/bill-context-menu";
import { useToast } from "@/components/ui/toast";
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
import {
  calculateDoubleGamePayerBreakdown,
  calculateTableChargeLinePayerBreakdown,
} from "@/features/sessions/utils/doubleGameBilling";
import { useCustomerAccountStore } from "@/features/customers/store/customerAccountStore";
import {
  getWalkInDisplayName,
  isWalkInName,
} from "@/features/sessions/utils/walkInLabel";
import type { CustomerAccount } from "@/features/customers/types/customerAccount";
import {
  getBillPrimaryLabel,
  getBillTableLabel,
  formatCustomerDisplayLabel,
} from "@/features/customers/utils/billDisplay";
import { normalizePlayerName } from "@/features/cafe/utils/playerIdentity";
import { useCafeStore } from "@/features/cafe/store/cafeStore";
import {
  getPlayerCafeAmount,
  hasPlayerName,
} from "../utils/playerBillIdentity";
import { formatAppDate, formatAppTime, useAppDateTimeFormats } from "@/lib/dateTime";
import CustomerBillsPage from "@/features/customers/pages/CustomerBillsPage";
import { useAdminModeStore } from "@/features/admin-mode/adminModeStore";
import { useTableStore } from "@/store/tableStore";
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
function getCustomerAccountSessionIds(account: CustomerAccount) {
  return new Set(
    [
      ...account.gameCharges,
      ...account.cafeCharges,
      ...(account.accessoryCharges ?? []),
    ]
      .map((charge) => charge.sessionId)
      .filter((sessionId): sessionId is string => Boolean(sessionId))
  );
}
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
    date: formatAppDate(date),
    time: formatAppTime(date),
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
  const physicalSessionId = (value?: string) =>
    (value ?? "").split("-TCL-")[0];
  const targetSessionId = physicalSessionId(sessionId);
  const matchesSession = (value?: string) =>
    physicalSessionId(value) === targetSessionId;

  return (
    account.gameCharges.some(
      (charge) => matchesSession(charge.sessionId)
    ) ||
    account.cafeCharges.some(
      (charge) => matchesSession(charge.sessionId)
    ) ||
    (account.accessoryCharges ?? []).some(
      (charge) => matchesSession(charge.sessionId)
    )
  );
}
function getAccountTableIds(account: CustomerAccount) {
  return new Set(
    [
      ...account.gameCharges.map((charge) => charge.tableId),
      ...account.cafeCharges.map((charge) => charge.tableId),
      ...(account.accessoryCharges ?? []).map(
        (charge) => charge.tableId
      ),
    ].filter((tableId): tableId is number =>
      typeof tableId === "number"
    )
  );
}
function getAccountActivityTimes(account: CustomerAccount) {
  return [
    account.openedAt,
    account.lastActivityAt,
    ...account.gameCharges.flatMap((charge) => [
      charge.startedAt,
      charge.endedAt,
      charge.createdAt,
    ]),
    ...account.cafeCharges.flatMap((charge) => [
      charge.orderedAt,
      charge.createdAt,
    ]),
    ...(account.accessoryCharges ?? []).flatMap((charge) => [
      charge.orderedAt,
      charge.createdAt,
    ]),
  ]
    .map((value) => (value ? new Date(value).getTime() : NaN))
    .filter((value) => Number.isFinite(value));
}
function accountMirrorsLegacyPendingBill(
  account: CustomerAccount,
  bill: PendingBill
) {
  if (accountHasSessionActivity(account, bill.session.id)) {
    return true;
  }

  const billStaffNumber = bill.staffBillNumber?.trim();
  if (
    billStaffNumber &&
    account.staffBillNumber === billStaffNumber
  ) {
    return true;
  }

  const tableMatches = getAccountTableIds(account).has(bill.tableId);
  if (!tableMatches) {
    return false;
  }

  const accountName = normalizePlayerName(account.customerName);
  const sessionPlayers = getSessionPlayers(bill.session).map((player) =>
    normalizePlayerName(player)
  );
  const nameMatches =
    sessionPlayers.includes(accountName) ||
    (isWalkInName(account.customerName) &&
      sessionPlayers.some((name) => name === "walk-in customer"));

  if (!nameMatches) {
    return false;
  }

  const sessionStart = new Date(bill.session.startTime).getTime();
  const sessionEnd = bill.session.endTime
    ? new Date(bill.session.endTime).getTime()
    : sessionStart;
  const toleranceMs = 5 * 60 * 1000;

  return getAccountActivityTimes(account).some(
    (time) =>
      time >= sessionStart - toleranceMs &&
      time <= sessionEnd + toleranceMs
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
    return lines.flatMap((line) =>
      calculateTableChargeLinePayerBreakdown({
        session: bill.session,
        line,
      })
    );
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
function pendingBillHasCafeOnlyPlayer(
  bill: PendingBill
) {
  if (!bill.session.endTime) return false;

  const cafePlayers = Array.from(
    new Set(
      bill.session.cafeOrders
        .filter(
          (item) =>
            !item.name.startsWith("[Accessory]") &&
            item.subtotal > 0
        )
        .map(
          (item) =>
            item.playerName ?? item.customerName ?? ""
        )
        .map((name) => name.trim())
        .filter(Boolean)
    )
  );

  if (cafePlayers.length === 0) {
    return false;
  }

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

  return cafePlayers.some((playerName) => {
    const tableAmount = payerBreakdown.reduce(
      (total, payer) =>
        normalizePlayerName(payer.playerName) ===
        normalizePlayerName(playerName)
          ? total + payer.tableAmountShare
          : total,
      0
    );

    return tableAmount <= 0;
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
  const players = [
    {
      playerName: bill.session.player1,
      customerId: bill.session.player1CustomerId,
    },
    {
      playerName: bill.session.player2,
      customerId: bill.session.player2CustomerId,
    },
    {
      playerName: bill.session.player3,
      customerId: bill.session.player3CustomerId,
    },
    {
      playerName: bill.session.player4,
      customerId: bill.session.player4CustomerId,
    },
    ...linkedAccounts.map((account) => ({
      playerName: account.customerName,
      customerId: account.id,
    })),
  ].filter(
    (player): player is {
      playerName: string;
      customerId: string | undefined;
    } => Boolean(player.playerName?.trim())
  );
  const seenPlayerKeys = new Set<string>();
  const uniquePlayers = players.filter((player) => {
    const key = player.customerId
      ? `customer-${player.customerId}`
      : `name-${normalizePlayerName(player.playerName)}`;

    if (seenPlayerKeys.has(key)) {
      return false;
    }

    seenPlayerKeys.add(key);
    return true;
  });
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
  ) as Array<{
    line?: {
      type?: string;
      payerCustomerId?: string;
    };
    playerName: string;
    tableAmountShare: number;
  }>;
  return uniquePlayers
    .filter(
      ({ playerName }) =>
        !hasPlayerName(paidPlayerNames, playerName)
    )
    .map(({ playerName, customerId }) => {
      const sessionCafeAmount = getPlayerCafeAmount(
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
      const settledAccountAmount = account?.gameCharges
        .filter((charge) => charge.sessionId === bill.session.id)
        .reduce((total, charge) => total + charge.amount, 0);
      const snookerAmount = settledAccountAmount !== undefined
        ? Math.max(0, settledAccountAmount - (account?.advanceReduction ?? 0))
        : payerBreakdown.reduce(
        (total, payer) => {
          const payerCustomerId =
            payer.line?.type === "doubleGame"
              ? undefined
              : payer.line?.payerCustomerId ??
                bill.session.payerCustomerId;
          const matchesCustomer =
            customerId && payerCustomerId
              ? payerCustomerId === customerId
              : false;
          const matchesName =
            normalizePlayerName(payer.playerName) ===
              normalizePlayerName(playerName);

          return matchesCustomer || matchesName
            ? total + payer.tableAmountShare
            : total;
        },
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

function getRowStartTime(row: CheckoutRow) {
  if (row.type === "pending") {
    return row.bill.session.startTime ?? row.bill.createdAt;
  }
  if (row.type === "account") {
    const times = getAccountActivityTimes(row.account);
    const earliest = times.length ? Math.min(...times) : NaN;

    return Number.isFinite(earliest)
      ? new Date(earliest).toISOString()
      : row.account.openedAt;
  }
  return row.sale.startedAt ?? row.sale.createdAt;
}

function getRowPaidTime(row: CheckoutRow) {
  return row.type === "paid"
    ? getSalePaymentTime(row.sale)
    : undefined;
}
function getSalePaymentTime(sale: Sale) {
  return sale.paidAt ?? sale.createdAt;
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
    return formatCustomerDisplayLabel(row.account);
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
        return "Walk-in Customer";
      }
      return getBillPrimaryLabel(account);
    }
    return isWalkInName(row.playerName)
      ? "Walk-in Customer"
      : formatCustomerDisplayName(row.playerName);
  }
  if (row.type === "account") {
    if (isWalkInName(row.account.customerName)) {
      return "Walk-in Customer";
    }
    return getBillPrimaryLabel(row.account);
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
function getCheckoutRowTableLabel(row: CheckoutRow) {
  if (row.type === "pending") {
    return row.bill.tableName;
  }
  if (row.type === "account") {
    return getBillTableLabel(row.account) || "-";
  }
  return row.sale.tableName;
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
  const tableAmount = getCheckoutRowTableAmount(row);
  const eligibleAmount =
    tableAmount + getCheckoutRowCafeAmount(row);

  if (row.type === "paid") {
    return Math.min(
      row.sale.discount,
      eligibleAmount
    );
  }
  if (row.type === "account") {
    return Math.min(
      row.account.discount,
      eligibleAmount
    );
  }
  const discount = row.bill.session.payerName &&
    row.bill.session.payerName !== row.playerName
    ? 0
    : row.bill.session.discount;

  return Math.min(discount, eligibleAmount);
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
function isCheckoutPaidSale(sale: Sale) {
  return sale.paymentStatus === "paid";
}
function CheckoutPage() {
  useAppDateTimeFormats();
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const selectedCustomerBillId = searchParams.get("customerBillId");
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
  const tables = useTableStore((state) => state.tables);
  const canCancelBills = useAdminModeStore((state) => state.can("cancel_bills"));
  const cancelCustomerAccount = useCustomerAccountStore(
    (state) => state.cancelCustomerAccount
  );
  const [selectedBill, setSelectedBill] = useState<PendingBill | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    row: CheckoutRow;
    x: number;
    y: number;
  } | null>(null);
  const [contextRowKey, setContextRowKey] = useState<string | null>(null);
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
  const [billToCancel, setBillToCancel] = useState<PendingBill | null>(null);
  const [accountToCancel, setAccountToCancel] =
    useState<CustomerAccount | null>(null);
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
        if (pendingBillHasCafeOnlyPlayer(bill)) {
          return true;
        }

        const billStaffNumber = bill.staffBillNumber;
        return !openCustomerAccountBills.some((account) => {
          return (
            (billStaffNumber &&
              account.staffBillNumber === billStaffNumber) ||
            accountMirrorsLegacyPendingBill(account, bill)
          );
        });
      }),
    [activePendingBills, openCustomerAccountBills],
  );
  const activeCustomerAccounts = useMemo(() => {
    const pendingCustomerIds = new Set(
      displayPendingBills
        .flatMap((bill) =>
          getPendingPlayerBillRows(
            bill,
            openCustomerAccountBills
          )
        )
        .map((row) => row.customerId)
        .filter((id): id is string => Boolean(id))
    );
    return openCustomerAccountBills.filter(
      (account) => !pendingCustomerIds.has(account.id),
    );
  }, [displayPendingBills, openCustomerAccountBills]);
  const currentlyPlayingCustomerIds = useMemo(() => {
    const customerIds = new Set<string>();

    tables.forEach((table) => {
      if (
        !table.session ||
        (table.status !== "running" && table.status !== "paused")
      ) {
        return;
      }

      [
        table.session.player1CustomerId,
        table.session.player2CustomerId,
        table.session.player3CustomerId,
        table.session.player4CustomerId,
      ]
        .filter((id): id is string => Boolean(id))
        .forEach((id) => customerIds.add(id));
    });

    return customerIds;
  }, [tables]);
  const collectiblePendingRows = useMemo(
    () =>
      displayPendingBills
        .flatMap((bill) =>
          getPendingPlayerBillRows(
            bill,
            openCustomerAccountBills
          )
        )
        .filter(
          (row) =>
            !row.customerId ||
            !currentlyPlayingCustomerIds.has(row.customerId)
        ),
    [
      currentlyPlayingCustomerIds,
      displayPendingBills,
      openCustomerAccountBills,
    ]
  );
  const collectibleCustomerAccounts = useMemo(
    () =>
      activeCustomerAccounts.filter(
        (account) =>
          !currentlyPlayingCustomerIds.has(account.id)
      ),
    [activeCustomerAccounts, currentlyPlayingCustomerIds]
  );
  const checkoutSales = useMemo(
    () => sales.filter(isCheckoutPaidSale),
    [sales],
  );
  const todaySales = useMemo(() => {
    const today = new Date();
    return checkoutSales.filter((sale) => {
      const paidAt = getUsableTime(getSalePaymentTime(sale));
      return paidAt?.toDateString() === today.toDateString();
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
          ...collectiblePendingRows,
          ...collectibleCustomerAccounts.map((account) => ({
            type: "account" as const,
            account,
          })),
        ])
      ),
    [
      collectibleCustomerAccounts,
      collectiblePendingRows,
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
            ...collectiblePendingRows,
            ...collectibleCustomerAccounts.map((account) => ({
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
                ...collectiblePendingRows,
                ...collectibleCustomerAccounts.map((account) => ({
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
        !isInDateRange(
          row.type === "paid"
            ? getSalePaymentTime(row.sale)
            : getRowTime(row),
          range.start,
          range.end
        )
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
        const firstTime = new Date(
          first.type === "paid"
            ? getSalePaymentTime(first.sale)
            : getRowTime(first)
        ).getTime();
        const secondTime = new Date(
          second.type === "paid"
            ? getSalePaymentTime(second.sale)
            : getRowTime(second)
        ).getTime();
        return secondTime - firstTime;
      });
  }, [
    customEnd,
    customStart,
    dateFilter,
    collectiblePendingRows,
    collectibleCustomerAccounts,
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
  const emptyColumnCount = 9;
  const handleReceivePayment = (
    paymentMethod: PaymentMethod,
    payerName?: string,
    paymentSplits?: PaymentSplit[],
    discount?: number,
  ) => {
    if (!selectedBill) return;
    if (selectedBill.status === "cancelled") {
      toast.warning({
        title: "Payment Not Available",
        description: "Cancelled bills cannot receive payment.",
      });
      return;
    }
    if (!activeBusinessDay) {
      toast.warning({
        title: "Start Business Day",
        description: "Start the day before receiving payment.",
      });
      return;
    }
    const billLabel = selectedBill.staffBillNumber ?? selectedBill.id;
    receivePendingBillPayment({
      billId: selectedBill.id,
      paymentMethod,
      paymentSplits,
      payerName,
      discount,
    });
    setSelectedBill(null);
    toast.success({
      title: "Payment Received",
      description: billLabel,
    });
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
      toast.warning({
        title: "Payment Not Available",
        description: "Cancelled bills cannot receive payment.",
      });
      return;
    }
    if (!activeBusinessDay) {
      toast.warning({
        title: "Start Business Day",
        description: "Start the day before receiving payment.",
      });
      return;
    }
    const billLabel = selectedBill.staffBillNumber ?? selectedBill.id;
    receivePendingPlayerBillPayment({ billId: selectedBill.id, ...input });
    toast.success({
      title: "Payment Received",
      description: `${input.playerName} · ${billLabel}`,
    });
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
    const cancelledSourceIds = new Set(
      useCustomerAccountStore
        .getState()
        .accounts.flatMap((account) =>
          account.cafeCharges
            .filter((charge) => charge.sessionId === billToCancel.session.id)
            .map((charge) => charge.sourceOrderId)
        )
        .filter((sourceOrderId): sourceOrderId is string => Boolean(sourceOrderId))
    );
    cancelledSourceIds.forEach((sourceOrderId) => {
      useCafeStore.getState().reverseStockForCharge(
        sourceOrderId,
        `Cancelled bill ${billToCancel.staffBillNumber ?? billToCancel.id}`
      );
    });
    cancelPendingBill({ billId: billToCancel.id, reason, note });
    useCustomerAccountStore
      .getState()
      .removeSessionCharges(billToCancel.session.id);
    if (selectedBill?.id === billToCancel.id) {
      setSelectedBill(null);
      setSelectedPlayerName(undefined);
    }
    toast.success({
      title: "Bill Deleted",
      description: `Bill ${billToCancel.staffBillNumber ?? billToCancel.id} was saved in Cancelled history.`,
    });
    setBillToCancel(null);
  };
  const handleCancelAccountBill = (account: CustomerAccount) => {
    setAccountToCancel(account);
    setCancelReason("");
    setCancelNote("");
    setCancelError("");
  };
  const confirmCancelAccountBill = () => {
    if (!accountToCancel) return;
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

    getCustomerAccountSessionIds(accountToCancel).forEach((sessionId) => {
      removePendingBill(`BILL-${sessionId}`);
    });
    cancelCustomerAccount({ id: accountToCancel.id, reason, note });
    toast.success({
      title: "Bill Deleted",
      description: `Bill ${getBillPrimaryLabel(accountToCancel)} was saved in Cancelled history.`,
    });
    setAccountToCancel(null);
  };
  const handleDeleteSale = (sale: Sale) => {
    if (!useAdminModeStore.getState().can("cancel_bills")) {
      toast.warning({
        title: "Admin Mode Required",
        description: "Enter Admin Mode to delete a paid bill.",
      });
      return;
    }
    const confirmed = window.confirm(
      `Delete paid bill ${sale.invoiceNumber}? This is for removing mistaken test bills.`,
    );
    if (!confirmed) return;
    deleteSale(sale.id);
    toast.success({
      title: "Bill Deleted",
      description: `Paid bill ${sale.invoiceNumber} was deleted.`,
    });
  };
  const openCheckoutRow = (row: CheckoutRow) => {
    if (row.type === "account") {
      navigate(`/operator/billing?customerBillId=${row.account.id}`);
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
  if (selectedCustomerBillId) {
    return <CustomerBillsPage paymentMode />;
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-100 px-3 py-4 sm:px-4 lg:px-5 xl:px-6">
      {" "}
      <div className="mx-auto w-full max-w-[1560px]">
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
                  Collect Payment{" "}
                </h1>{" "}
                <p className="text-sm text-slate-500">
                  {" "}
                  Collect payment for ended sessions and open bills.{" "}
                </p>{" "}
              </div>{" "}
            </div>{" "}
          </div>{" "}
        </div>{" "}
        <section className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-3">
          {" "}
          <Card className="flex min-h-[104px] flex-col justify-between p-3.5">
            {" "}
            <p className="text-xs font-medium text-slate-500"> Open Bills </p>{" "}
            <p className="mt-1 text-xl font-bold text-slate-950">
              {" "}
              {openBillsCount.toLocaleString()}{" "}
            </p>{" "}
            <p className="text-xs text-slate-500">Awaiting payment</p>
          </Card>{" "}
          <Card className="flex min-h-[104px] flex-col justify-between p-3.5">
            {" "}
            <p className="text-xs font-medium text-slate-500"> Outstanding Amount </p>{" "}
            <p className="mt-1 text-xl font-bold text-amber-700">
              {" "}
              {formatCurrency(openAmount)}{" "}
            </p>{" "}
            <p className="text-xs text-slate-500">Pending collection</p>
          </Card>{" "}
          <Card className="flex min-h-[104px] flex-col justify-between p-3.5">
            {" "}
            <p className="text-xs font-medium text-slate-500"> Paid Bills Today </p>{" "}
            <p className="mt-1 text-xl font-bold text-slate-950">
              {" "}
              {todaySales.length.toLocaleString()}{" "}
            </p>{" "}
            <p className="text-xs text-slate-500">Completed today</p>
          </Card>{" "}
          <Card className="flex min-h-[104px] flex-col justify-between p-3.5">
            {" "}
            <p className="text-xs font-medium text-slate-500"> Amount Received Today </p>{" "}
            <p className="mt-1 text-xl font-bold text-emerald-700">
              {" "}
              {formatCurrency(totalReceivedToday)}{" "}
            </p>{" "}
            <p className="text-xs text-slate-500">All payment methods</p>
          </Card>{" "}
        </section>{" "}
        <Card className="mt-5 overflow-hidden">
          {" "}
          <div className="grid min-w-0 gap-3 border-b p-3 sm:p-4">
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
            <div className="flex min-w-0 flex-wrap items-end gap-2.5">
              {" "}
              <div className="flex max-w-full flex-wrap rounded-lg border bg-white p-1">
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
              <div className="flex max-w-full flex-wrap rounded-lg border bg-white p-1">
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
              <label className="grid min-w-[150px] gap-1 text-xs font-semibold text-slate-500">
                Payment
                <select
                  className="h-10 rounded-md border bg-white px-3 text-sm font-normal text-slate-900"
                  value={paymentMethodFilter}
                  onChange={(event) =>
                    setPaymentMethodFilter(
                      event.target.value as PaymentMethodFilter,
                    )
                  }
                >
                  <option value="all">All Payments</option>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="jazzcash">JazzCash</option>
                  <option value="easypaisa">Easypaisa</option>
                </select>
              </label>
              <label className="grid min-w-[140px] gap-1 text-xs font-semibold text-slate-500">
                Table
                <select
                  className="h-10 rounded-md border bg-white px-3 text-sm font-normal text-slate-900"
                  value={tableFilter}
                  onChange={(event) =>
                    setTableFilter(
                      event.target.value === "all"
                        ? "all"
                        : Number(event.target.value),
                    )
                  }
                >
                  <option value="all">All Tables</option>
                  {tableOptions.map((table) => (
                    <option key={table.id} value={table.id}>
                      {table.name}
                    </option>
                  ))}
                </select>
              </label>
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
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-slate-50 px-3 py-2 text-sm">
              <div>
                <p className="font-medium text-slate-600">{resultSummary}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
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
                    Canteen{" "}
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
          <div className="max-h-[calc(100vh-22rem)] min-h-[220px] w-full overflow-x-auto overflow-y-auto overscroll-x-contain pb-2">
            {" "}
            <table className="w-full min-w-[900px] max-w-[1180px] table-fixed text-left text-sm">
              <colgroup>
                <col className="w-[4.75rem]" />
                <col className="w-[4.75rem]" />
                <col className="w-[9rem]" />
                <col className="w-[6.25rem]" />
                <col className="w-[5.25rem]" />
                <col className="w-[6rem]" />
                <col className="w-[6rem]" />
                <col className="w-[7.5rem]" />
                <col className="w-[12rem]" />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase text-slate-500 shadow-sm">
                <tr>
                  <th className="whitespace-nowrap px-2 py-2.5 sm:px-3">
                    Started At
                  </th>
                  <th className="whitespace-nowrap px-2 py-2.5 sm:px-3">
                    Ended At
                  </th>
                  <th className="whitespace-nowrap px-2 py-2.5">
                    Customer / Table
                  </th>
                  <th className="whitespace-nowrap px-2 py-2.5 text-right sm:px-3">Table Charges</th>
                  <th className="whitespace-nowrap px-2 py-3 text-right sm:px-3">Canteen</th>
                  <th className="whitespace-nowrap px-2 py-2.5 text-right sm:px-3">Accessories</th>
                  <th className="whitespace-nowrap px-2 py-2.5 text-right sm:px-3">Total</th>
                  <th className="whitespace-nowrap px-2 py-2.5 sm:px-3">Status</th>
                  <th className="sticky right-0 z-20 whitespace-nowrap bg-slate-50 px-2 py-2.5 text-right shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.35)] dark:bg-slate-900">Action</th>
                </tr>
              </thead>
              <tbody>
                {checkoutRows.map((row) => {
                  const account =
                    row.type === "account"
                      ? row.account
                      : row.type === "pending" && row.customerId
                        ? customerAccountById.get(row.customerId)
                        : undefined;
                  const startedAt = formatDateTimeLines(getRowStartTime(row));
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
                  const rowIsSelected =
                    (row.type === "pending" && selectedBill?.id === row.bill.id) ||
                    contextRowKey === (row.type === "pending" ? `${row.bill.id}-${row.playerName}` : row.type === "account" ? `account-${row.account.id}` : row.sale.id);
                  const startedAtTitle =
                    startedAt.time && startedAt.date
                      ? `${startedAt.date} ${startedAt.time}`
                      : startedAt.date;
                  const endedAtTitle =
                    endedAt.time && endedAt.date
                      ? `${endedAt.date} ${endedAt.time}`
                      : endedAt.date;
                  const customerTableLabel = getCheckoutRowTableLabel(row);
                  const customerPlayersLabel = getCheckoutRowPlayersLabel(
                    row,
                    account,
                  );
                  const fullIdentityTitle = `${customerPlayersLabel} - ${customerTableLabel} - ${getCheckoutRowBillLabel(row, account)}`;
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
                      onContextMenu={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setContextRowKey(row.type === "pending" ? `${row.bill.id}-${row.playerName}` : row.type === "account" ? `account-${row.account.id}` : row.sale.id);
                        setContextMenu({ row, x: event.clientX, y: event.clientY });
                      }}
                      onClick={() => openCheckoutRow(row)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          openCheckoutRow(row);
                        }
                      }}
                      className={`group cursor-pointer border-t transition focus:outline-none focus:ring-2 focus:ring-inset focus:ring-amber-300 ${
                        rowIsSelected
                          ? "bg-amber-50 ring-1 ring-inset ring-amber-200"
                          : "bg-white hover:bg-slate-50"
                      }`}
                    >
                      <td className="px-2 py-3 align-middle text-slate-700 sm:px-3">
                        <span
                          className="block whitespace-nowrap font-medium text-slate-700 dark:text-slate-200"
                          title={startedAtTitle}
                        >
                          {startedAt.time || "-"}
                        </span>
                      </td>
                      <td className="px-2 py-3 align-middle text-slate-700 sm:px-3">
                        <span
                          className="block whitespace-nowrap font-medium text-slate-700 dark:text-slate-200"
                          title={endedAtTitle}
                        >
                          {endedAt.time || "-"}
                        </span>
                        {getRowPaidTime(row) && paidAt.time && (
                          <span className="block whitespace-nowrap text-xs text-emerald-700">
                            Paid {paidAt.time}
                          </span>
                        )}
                      </td>
                      <td className="max-w-[9rem] overflow-hidden px-2 py-3 align-middle">
                        <span
                          className="block truncate whitespace-nowrap font-semibold text-slate-950 dark:text-slate-100"
                          title={fullIdentityTitle}
                        >
                          {customerPlayersLabel}
                        </span>
                        <span
                          className="block truncate whitespace-nowrap text-xs text-slate-500 dark:text-slate-400"
                          title={customerTableLabel}
                        >
                          {customerTableLabel}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-2 py-3 text-right align-middle tabular-nums sm:px-3">
                        {formatAmountOrDash(getCheckoutRowTableAmount(row))}
                      </td>
                      <td className="whitespace-nowrap px-2 py-3 text-right align-middle tabular-nums sm:px-3">
                        {formatAmountOrDash(getCheckoutRowCafeAmount(row))}
                      </td>
                      <td className="whitespace-nowrap px-2 py-3 text-right align-middle tabular-nums sm:px-3">
                        {formatAmountOrDash(
                          getCheckoutRowAccessoryAmount(row),
                        )}
                      </td>
                      <td className="whitespace-nowrap px-2 py-3 text-right align-middle font-bold tabular-nums text-slate-950 sm:px-3">
                        {formatCurrency(getCheckoutRowTotal(row))}
                      </td>
                      <td className="px-2 py-3 align-middle sm:px-3">
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
                        </span>
                        {pendingAge && (
                          <p className="mt-0.5 text-xs leading-tight text-slate-500">
                            {pendingAge}
                          </p>
                        )}
                      </td>
                      <td
                        className={`sticky right-0 z-10 px-2 py-3 text-right align-middle shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.35)] ${
                          rowIsSelected
                            ? "bg-amber-50 dark:bg-amber-950"
                            : "bg-white group-hover:bg-slate-50 dark:bg-slate-950 dark:group-hover:bg-slate-800"
                        }`}
                      >
                        {row.type === "pending" || row.type === "account" ? (
                          <div className="flex flex-wrap justify-end gap-1">
                            <Button
                              size="sm"
                              className="h-8 whitespace-nowrap px-2"
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
                              {row.type === "pending" &&
                              row.bill.status === "cancelled"
                                ? "View Details"
                                : "View & Pay"}
                            </Button>
                            {row.type === "pending" &&
                              row.bill.status !== "cancelled" && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="gap-1 whitespace-nowrap border-red-200 px-2 text-red-700 hover:bg-red-50"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleCancelPendingBill(row.bill);
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" /> Delete Bill
                                </Button>
                              )}
                            {row.type === "account" && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-1 whitespace-nowrap border-red-200 px-2 text-red-700 hover:bg-red-50"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleCancelAccountBill(row.account);
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Delete Bill
                              </Button>
                            )}
                          </div>
                        ) : canCancelBills ? (
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
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
                {checkoutRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={emptyColumnCount}
                      className="p-4"
                    >
                      <EmptyState
                        compact
                        icon={checkoutRows.length === openBillsCount ? CheckCircle2 : Search}
                        title={checkoutRows.length === openBillsCount ? "No Pending Payments" : "No Matching Bills"}
                        description={checkoutRows.length === openBillsCount ? "Everything has been collected." : "Try changing your search or filters."}
                        actionLabel={checkoutRows.length === openBillsCount ? undefined : "Clear Filters"}
                        onAction={checkoutRows.length === openBillsCount ? undefined : clearFilters}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      {contextMenu && (
        <BillContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => {
            setContextMenu(null);
            setContextRowKey(null);
          }}
          actions={([
            {
              id: "view",
              label: contextMenu.row.type === "pending" && contextMenu.row.bill.status !== "cancelled" ? "Collect Payment" : "View Details",
              onSelect: () => openCheckoutRow(contextMenu.row),
            },
            ...(canCancelBills
              ? contextMenu.row.type === "pending" && contextMenu.row.bill.status !== "cancelled"
                ? [{
                    id: "delete" as const,
                    label: "Delete Bill",
                    destructive: true,
                    onSelect: () => handleCancelPendingBill((contextMenu.row as Extract<CheckoutRow, { type: "pending" }>).bill),
                  }]
                : contextMenu.row.type === "account"
                  ? [{
                      id: "delete" as const,
                      label: "Delete Bill",
                      destructive: true,
                      onSelect: () => handleCancelAccountBill((contextMenu.row as Extract<CheckoutRow, { type: "account" }>).account),
                    }]
                  : []
              : []),
          ] satisfies BillContextMenuAction[])}
        />
      )}
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
            toast.warning({
              title: "Payment Not Available",
              description:
                "Start the day and select an operator before receiving payment.",
            })
          }
          onReceivePayment={handleReceivePayment}
          onReceivePlayerBill={handleReceivePlayerBill}
        />
      )}{" "}
      {(billToCancel || accountToCancel) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
          {" "}
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            {" "}
            <h2 className="text-lg font-bold text-slate-950">
              {" "}
              Delete unpaid bill?{" "}
            </h2>{" "}
            <p className="mt-2 text-sm text-slate-600">
              {" "}
              This bill will be removed from Pending and kept in history with
              Cancelled status.{" "}
            </p>{" "}
            <div className="mt-4 space-y-3">
              {" "}
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                {" "}
                Deletion reason{" "}
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
              <Button
                variant="outline"
                onClick={() => {
                  setBillToCancel(null);
                  setAccountToCancel(null);
                }}
              >
                {" "}
                Keep Bill{" "}
              </Button>{" "}
              <Button
                className="bg-red-700 hover:bg-red-800"
                disabled={
                  !cancelReason ||
                  (cancelReason === "Other" && !cancelNote.trim())
                }
                onClick={() =>
                  billToCancel
                    ? confirmCancelPendingBill()
                    : confirmCancelAccountBill()
                }
              >
                {" "}
                Delete Bill{" "}
              </Button>{" "}
            </div>{" "}
          </div>{" "}
        </div>
      )}{" "}
    </main>
  );
}
export default CheckoutPage;
