import { ArrowLeft, CheckCircle2, ReceiptText, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageShell } from "@/components/layout/page-layout";
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
  getPlayerCafeItems,
  getPlayerCafeAmount,
  getSessionPlayerBillingIdentities,
  hasPlayerName,
  type SessionPlayerBillingIdentity,
} from "../utils/playerBillIdentity";
import { formatAppDate, formatAppDateTime, formatAppTime, useAppDateTimeFormats } from "@/lib/dateTime";
import CustomerBillsPage from "@/features/customers/pages/CustomerBillsPage";
import { useAdminModeStore } from "@/features/admin-mode/adminModeStore";
import { useTableStore } from "@/store/tableStore";
import { useDeferredPayment } from "../DeferredPaymentProvider";
import {
  DEFAULT_PAYMENT_METHOD_LABELS,
  getPaymentMethodLabels,
  getPaymentMethodOptions,
  useClubSettingsStore,
} from "@/features/settings/store/clubSettingsStore";
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
type BillTypeFilter =
  | "all"
  | "table"
  | "cafe-only"
  | "accessories-only"
  | "mixed";
type CurrentlyPlayingBills = {
  customerIds: Set<string>;
  sessionIds: Set<string>;
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
function isCustomerAccountCurrentlyPlaying(
  account: CustomerAccount,
  playing: CurrentlyPlayingBills,
) {
  if (playing.customerIds.has(account.id)) return true;

  const accountSessionIds = getCustomerAccountSessionIds(account);
  return Array.from(accountSessionIds).some((sessionId) =>
    playing.sessionIds.has(sessionId),
  );
}
function getSalePaymentLabel(sale: {
  paymentMethod: PaymentMethod;
  paymentSplits?: PaymentSplit[];
}, labels: Record<PaymentMethod, string> = DEFAULT_PAYMENT_METHOD_LABELS) {
  if (!sale.paymentSplits?.length) {
    return labels[sale.paymentMethod];
  }
  return sale.paymentSplits
    .map((split) => `${labels[split.method]} Rs. ${split.amount}`)
    .join(" + ");
}
function getSaleAccessoryAmount(sale: Sale) {
  return (
    sale.orderedItems
      ?.filter((item) => item.name.startsWith("[Accessory]"))
      .reduce((total, item) => total + item.subtotal, 0) ?? 0
  );
}
function getSaleCafeReceiptAmount(sale: Sale) {
  return Math.max(sale.cafeAmount - getSaleAccessoryAmount(sale), 0);
}
function getSaleCustomerLabel(sale: Sale) {
  const playerNames = sale.players
    ?.map((player) => player.name)
    .filter(Boolean)
    .join(", ");

  return (
    sale.customerName ||
    sale.payerName ||
    playerNames ||
    "Walk-in Customer"
  );
}
function getSaleTypeLabel(sale: Sale) {
  if (sale.saleType === "cafe-only" || sale.saleType === "cafe_only") {
    return "Cafe Only";
  }
  if (sale.saleType === "customer_bill") return "Customer Bill";
  if (sale.saleType === "accessories") return "Accessories";
  return "Table Bill";
}
function formatReceiptDuration(minutes: number) {
  if (!Number.isFinite(minutes) || minutes < 1) return "Less than 1 min";

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours < 1) return `${minutes} min`;
  if (remainingMinutes === 0) return `${hours} hr`;
  return `${hours} hr ${remainingMinutes} min`;
}
function getReceiptSessionSummaryRows(sale: Sale) {
  const lines = sale.tableChargeLines ?? [];
  const gameChargeLines = (sale.gameCharges ?? []).flatMap((charge) =>
    charge.lineCharges?.length
      ? charge.lineCharges.map((line) => ({
          sessionType: line.sessionType,
          amount: line.amount,
          durationMinutes: line.durationMinutes,
          isFinal: line.isFinal,
          finalGames: line.finalGames,
          gameCount: undefined,
          tableType: charge.tableType,
        }))
      : [
          {
            sessionType: charge.sessionType,
            amount: charge.amount,
            durationMinutes: charge.durationMinutes,
            isFinal: charge.isFinal,
            finalGames: charge.finalGames,
            gameCount: charge.gameCount,
            tableType: charge.tableType,
          },
        ],
  );

  if (!lines.length && !gameChargeLines.length) {
    return sale.tableAmount > 0
      ? [
          {
            label: "Table / Session Charges",
            detail: "",
            amount: sale.tableAmount,
          },
        ]
      : [];
  }

  if (!lines.length) {
    const rows: Array<{ label: string; detail: string; amount: number }> = [];
    const finalLines = gameChargeLines.filter((line) => line.isFinal);
    const singleLines = gameChargeLines.filter(
      (line) => line.sessionType === "single" && !line.isFinal,
    );
    const doubleLines = gameChargeLines.filter(
      (line) => line.sessionType === "double" && !line.isFinal,
    );
    const timeLines = gameChargeLines.filter(
      (line) => line.sessionType === "time" || line.sessionType === "private",
    );
    const totalAmount = (selectedLines: typeof gameChargeLines) =>
      selectedLines.reduce((total, line) => total + line.amount, 0);
    const totalCount = (selectedLines: typeof gameChargeLines) =>
      selectedLines.reduce(
        (total, line) => total + (line.gameCount ?? line.finalGames ?? 1),
        0,
      );

    if (singleLines.length) {
      rows.push({
        label: "Single Games",
        detail: String(totalCount(singleLines)),
        amount: totalAmount(singleLines),
      });
    }
    if (doubleLines.length) {
      rows.push({
        label: "Double Games",
        detail: String(totalCount(doubleLines)),
        amount: totalAmount(doubleLines),
      });
    }
    if (finalLines.length) {
      rows.push({
        label: "Final Games",
        detail: String(totalCount(finalLines)),
        amount: totalAmount(finalLines),
      });
    }
    const timeGroups = timeLines.reduce(
      (groups, line) => {
        const label =
          line.sessionType === "private" || line.tableType === "private-room"
            ? "Private Room"
            : "Table Booking";
        const group = groups.get(label) ?? { durationMinutes: 0, amount: 0 };
        group.durationMinutes += line.durationMinutes ?? 0;
        group.amount += line.amount;
        groups.set(label, group);
        return groups;
      },
      new Map<string, { durationMinutes: number; amount: number }>(),
    );
    timeGroups.forEach((group, label) => {
      rows.push({
        label,
        detail: formatReceiptDuration(group.durationMinutes),
        amount: group.amount,
      });
    });

    return rows;
  }

  const singleLines = lines.filter(
    (line) => line.type === "singleGame" && !line.isFinal,
  );
  const doubleLines = lines.filter(
    (line) => line.type === "doubleGame" && !line.isFinal,
  );
  const finalLines = lines.filter((line) => line.isFinal);
  const bookingLines = lines.filter((line) => line.type === "tableBooking");
  const rows: Array<{ label: string; detail: string; amount: number }> = [];
  const totalAmount = (
    selectedLines: typeof lines,
  ) => selectedLines.reduce((total, line) => total + line.amount, 0);

  if (singleLines.length) {
    rows.push({
      label: "Single Games",
      detail: String(singleLines.length),
      amount: totalAmount(singleLines),
    });
  }
  if (doubleLines.length) {
    rows.push({
      label: "Double Games",
      detail: String(doubleLines.length),
      amount: totalAmount(doubleLines),
    });
  }
  if (finalLines.length) {
    rows.push({
      label: "Final Games",
      detail: String(
        finalLines.reduce((total, line) => total + (line.finalGames ?? 1), 0),
      ),
      amount: totalAmount(finalLines),
    });
  }
  if (bookingLines.length) {
    rows.push({
      label:
        sale.sessionType === "private"
          ? "Private Room"
          : sale.sessionType === "time"
            ? "Table Booking"
            : "Time Booking",
      detail: formatReceiptDuration(
        bookingLines.reduce(
          (total, line) => total + (line.durationMinutes ?? 0),
          0,
        ),
      ),
      amount: totalAmount(bookingLines),
    });
  }

  return rows;
}
function getReceiptSessionDetailLabel(
  line: NonNullable<Sale["tableChargeLines"]>[number],
  index: number,
) {
  if (line.isFinal) {
    return `Final ${line.finalGames ?? 1} · Final Game`;
  }
  if (line.type === "doubleGame") {
    return `Game ${index + 1} · Double Game`;
  }
  if (line.type === "singleGame") {
    return `Game ${index + 1} · Single Game`;
  }
  return "Time Booking";
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
type CombineSelectableRow = Extract<
  CheckoutRow,
  { type: "pending" } | { type: "account" }
>;

function isPendingRowCurrentlyPlaying(
  row: Extract<CheckoutRow, { type: "pending" }>,
  playing: CurrentlyPlayingBills,
) {
  return (
    playing.sessionIds.has(row.bill.session.id) ||
    (row.customerId ? playing.customerIds.has(row.customerId) : false)
  );
}
function getPendingPlayerPaymentKey(billId: string, playerName: string) {
  return `bill:${billId}:player:${normalizePlayerName(playerName)}`;
}
function getCombineRowKey(row: CombineSelectableRow) {
  return row.type === "account"
    ? `account:${row.account.id}`
    : getPendingPlayerPaymentKey(row.bill.id, row.playerName);
}

function isDeferredCheckoutRow(
  row: CheckoutRow,
  pendingPaymentKeys: ReadonlySet<string>,
) {
  if (row.type === "account") {
    return pendingPaymentKeys.has(`account:${row.account.id}`);
  }
  if (row.type !== "pending") return false;
  return (
    pendingPaymentKeys.has(`bill:${row.bill.id}`) ||
    pendingPaymentKeys.has(
      getPendingPlayerPaymentKey(row.bill.id, row.playerName),
    )
  );
}
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
function getAccountPaymentTotals(account: CustomerAccount) {
  const cafeTotal = getAccountCafeAmount(account);
  const accessoryTotal = getAccountAccessoryAmount(account);
  const grandTotal = Math.max(
    0,
    account.totalGameAmount +
      cafeTotal +
      accessoryTotal -
      Math.min(account.discount, account.totalGameAmount + cafeTotal),
  );

  return { cafeTotal, accessoryTotal, grandTotal };
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
function checkoutRowMatchesTable(row: CheckoutRow, tableId: number) {
  if (row.type === "pending") {
    return row.bill.tableId === tableId;
  }
  if (row.type === "account") {
    return row.account.gameCharges.some((charge) => charge.tableId === tableId);
  }
  return (
    row.sale.tableId === tableId ||
    row.sale.gameCharges?.some((charge) => charge.tableId === tableId) ||
    row.sale.cafeCharges?.some((charge) => charge.tableId === tableId) ||
    row.sale.orderedItems?.some((item) => item.tableId === tableId)
  );
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

function matchesBillTypeFilter(
  row: CheckoutRow,
  filter: BillTypeFilter,
) {
  if (filter === "all") return true;

  const tableAmount = getCheckoutRowTableAmount(row);
  const cafeAmount = getCheckoutRowCafeAmount(row);
  const accessoryAmount = getCheckoutRowAccessoryAmount(row);

  if (filter === "table") return tableAmount > 0;
  if (filter === "cafe-only") {
    return tableAmount === 0 && cafeAmount > 0 && accessoryAmount === 0;
  }
  if (filter === "accessories-only") {
    return tableAmount === 0 && cafeAmount === 0 && accessoryAmount > 0;
  }

  return [tableAmount, cafeAmount, accessoryAmount].filter(
    (amount) => amount > 0,
  ).length > 1;
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
  const updateSalePaymentMethod = useSalesStore(
    (state) => state.updateSalePaymentMethod,
  );
  const activeBusinessDay = useBusinessDayStore((state) =>
    state.getActiveBusinessDay(),
  );
  const clubSettings = useClubSettingsStore((state) => state.settings);
  const paymentMethodLabels = useMemo(
    () => getPaymentMethodLabels(clubSettings),
    [clubSettings],
  );
  const paymentMethodOptions = useMemo(
    () => getPaymentMethodOptions(clubSettings),
    [clubSettings],
  );
  const customerAccounts = useCustomerAccountStore((state) => state.accounts);
  const tables = useTableStore((state) => state.tables);
  const canCancelBills = useAdminModeStore((state) => state.can("cancel_bills"));
  const { pendingPaymentKeys, schedulePayment } = useDeferredPayment();
  const cancelCustomerAccount = useCustomerAccountStore(
    (state) => state.cancelCustomerAccount
  );
  const markCustomerBillPaid = useCustomerAccountStore(
    (state) => state.markCustomerBillPaid,
  );
  const replaceCafeChargesForOrder = useCustomerAccountStore(
    (state) => state.replaceCafeChargesForOrder,
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
  const [selectedSaleReceipt, setSelectedSaleReceipt] = useState<Sale | null>(
    null,
  );
  const [salePaymentToEdit, setSalePaymentToEdit] = useState<Sale | null>(
    null,
  );
  const [correctedPaymentMethod, setCorrectedPaymentMethod] =
    useState<PaymentMethod>("cash");
  const [restoredPaymentDraft, setRestoredPaymentDraft] = useState<{
    billId: string;
    paymentMethod: PaymentMethod;
    paymentSplits: PaymentSplit[];
    payerName?: string;
    discount?: number;
  } | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ViewFilter>("pending");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [paymentMethodFilter, setPaymentMethodFilter] =
    useState<PaymentMethodFilter>("all");
  const [tableFilter, setTableFilter] = useState<TableFilter>("all");
  const [billTypeFilter, setBillTypeFilter] =
    useState<BillTypeFilter>("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [billToCancel, setBillToCancel] = useState<PendingBill | null>(null);
  const [accountToCancel, setAccountToCancel] =
    useState<CustomerAccount | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelNote, setCancelNote] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [combineSelectionMode, setCombineSelectionMode] = useState(false);
  const [combineSelectedKeys, setCombineSelectedKeys] = useState<string[]>([]);
  const [combineDialogOpen, setCombineDialogOpen] = useState(false);
  const [combinePaymentMethod, setCombinePaymentMethod] =
    useState<PaymentMethod>("cash");
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
  useEffect(() => {
    pendingBills.forEach((bill) => {
      const tableBillCafeItems = bill.session.cafeOrders.filter(
        (item) => item.tableBill,
      );
      if (!tableBillCafeItems.length) return;

      const payerName =
        bill.session.payerName ??
        bill.session.loserName ??
        tableBillCafeItems[0]?.playerName ??
        tableBillCafeItems[0]?.customerName;
      if (!payerName) return;

      const payerCustomerId =
        bill.session.payerCustomerId ??
        tableBillCafeItems.find((item) => item.playerId)?.playerId;

      replaceCafeChargesForOrder({
        customerId: payerCustomerId,
        customerName: payerName,
        sourceOrderId: `TABLE-BILL-CAFE-${bill.session.id}`,
        charges: tableBillCafeItems.map((item) => ({
          itemId: item.menuItemId,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          subtotal: item.subtotal,
          tableId: bill.tableId,
          tableName: bill.tableName,
          sessionId: bill.session.id,
          orderedAt:
            item.orderedAt ??
            new Date(
              bill.session.endTime ?? bill.createdAt,
            ).toISOString(),
        })),
      });
    });
  }, [pendingBills, replaceCafeChargesForOrder]);
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
  const currentlyPlayingBills = useMemo<CurrentlyPlayingBills>(() => {
    const customerIds = new Set<string>();
    const sessionIds = new Set<string>();

    tables.forEach((table) => {
      if (
        !table.session ||
        (table.status !== "running" && table.status !== "paused")
      ) {
        return;
      }

      sessionIds.add(table.session.id);
      [
        table.session.player1CustomerId,
        table.session.player2CustomerId,
        table.session.player3CustomerId,
        table.session.player4CustomerId,
        ...(table.session.extraPlayerCustomerIds ?? []),
      ]
        .filter((id): id is string => Boolean(id))
        .forEach((id) => customerIds.add(id));
    });

    return { customerIds, sessionIds };
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
            !isPendingRowCurrentlyPlaying(row, currentlyPlayingBills)
        ),
    [
      currentlyPlayingBills,
      displayPendingBills,
      openCustomerAccountBills,
    ]
  );
  const collectibleCustomerAccounts = useMemo(
    () =>
      activeCustomerAccounts.filter(
        (account) =>
          !isCustomerAccountCurrentlyPlaying(account, currentlyPlayingBills)
      ),
    [activeCustomerAccounts, currentlyPlayingBills]
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
        ]),
      ).filter((row) => !isDeferredCheckoutRow(row, pendingPaymentKeys)),
    [
      collectibleCustomerAccounts,
      collectiblePendingRows,
      pendingPaymentKeys,
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
      if (isDeferredCheckoutRow(row, pendingPaymentKeys)) {
        return false;
      }
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
          row.type === "paid"
            ? getSalePaymentLabel(row.sale, paymentMethodLabels)
            : "";
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
    pendingPaymentKeys,
  ]);
  const tableOptions = useMemo(() => {
    return tables
      .map((table) => ({ id: table.id, name: table.name }))
      .sort((first, second) =>
        first.id === second.id
          ? first.name.localeCompare(second.name)
          : first.id - second.id,
      );
  }, [tables]);
  const checkoutRows = useMemo(
    () =>
      rowsForTableOptions.filter((row) => {
        if (!matchesBillTypeFilter(row, billTypeFilter)) {
          return false;
        }
        if (tableFilter === "all") {
          return true;
        }
        return checkoutRowMatchesTable(row, tableFilter);
      }),
    [billTypeFilter, rowsForTableOptions, tableFilter],
  );
  const unsearchedRowsCount = rowsForTableOptions.filter((row) => {
    if (!matchesBillTypeFilter(row, billTypeFilter)) return false;
    if (tableFilter === "all") return true;

    return checkoutRowMatchesTable(row, tableFilter);
  }).length;
  const isDefaultFilterState =
    statusFilter === "pending" &&
    dateFilter === "all" &&
    paymentMethodFilter === "all" &&
    tableFilter === "all" &&
    billTypeFilter === "all" &&
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
  const combineSelectedKeySet = useMemo(
    () => new Set(combineSelectedKeys),
    [combineSelectedKeys],
  );
  const isCombineSelectableRow = (
    row: CheckoutRow,
  ): row is CombineSelectableRow => {
    if (getCheckoutRowTotal(row) <= 0 || isDeferredCheckoutRow(row, pendingPaymentKeys)) {
      return false;
    }
    if (row.type === "pending") {
      return row.bill.status !== "cancelled";
    }
    return (
      row.type === "account" &&
      row.account.status === "active" &&
      row.account.paymentStatus === "unpaid"
    );
  };
  const combineSelectedRows = useMemo(
    () =>
      checkoutRows.filter(
        (row): row is CombineSelectableRow =>
          isCombineSelectableRow(row) &&
          combineSelectedKeySet.has(getCombineRowKey(row)),
      ),
    [checkoutRows, combineSelectedKeySet, pendingPaymentKeys],
  );
  const combineSelectedTotal = useMemo(
    () =>
      combineSelectedRows.reduce(
        (total, row) => total + getCheckoutRowTotal(row),
        0,
      ),
    [combineSelectedRows],
  );
  useEffect(() => {
    if (!combineSelectionMode) return;
    setCombineSelectedKeys((keys) =>
      keys.filter((key) =>
        checkoutRows.some(
          (row) =>
            isCombineSelectableRow(row) && getCombineRowKey(row) === key,
        ),
      ),
    );
  }, [checkoutRows, combineSelectionMode, pendingPaymentKeys]);
  const clearCombineSelection = () => {
    setCombineSelectionMode(false);
    setCombineSelectedKeys([]);
    setCombineDialogOpen(false);
  };
  const clearFilters = () => {
    setStatusFilter("pending");
    setDateFilter("all");
    setPaymentMethodFilter("all");
    setTableFilter("all");
    setBillTypeFilter("all");
    setSearch("");
    setCustomStart("");
    setCustomEnd("");
    clearCombineSelection();
  };
  const handleDeletePaidSale = (sale: Sale) => {
    if (!canCancelBills) return;

    const confirmed = window.confirm(
      `Delete paid sale ${sale.invoiceNumber}? Use this only to remove a duplicate or mistaken receipt.`
    );
    if (!confirmed) return;

    deleteSale(sale.id);
    if (selectedSaleReceipt?.id === sale.id) {
      setSelectedSaleReceipt(null);
    }
    setContextMenu(null);
    setContextRowKey(null);
    toast.success({
      title: "Paid Sale Deleted",
      description: `${sale.invoiceNumber} was removed from paid sales.`,
    });
  };
  const openEditSalePayment = (sale: Sale) => {
    setSalePaymentToEdit(sale);
    setCorrectedPaymentMethod(sale.paymentMethod);
    setContextMenu(null);
    setContextRowKey(null);
  };
  const handleCorrectSalePaymentMethod = () => {
    if (!salePaymentToEdit) return;

    updateSalePaymentMethod(
      salePaymentToEdit.id,
      correctedPaymentMethod,
    );
    const updatedSale = {
      ...salePaymentToEdit,
      paymentMethod: correctedPaymentMethod,
      paymentSplits: undefined,
    };
    if (selectedSaleReceipt?.id === salePaymentToEdit.id) {
      setSelectedSaleReceipt(updatedSale);
    }
    setSalePaymentToEdit(null);
    toast.success({
      title: "Payment Method Updated",
      description: `${salePaymentToEdit.invoiceNumber} is now ${paymentMethodLabels[correctedPaymentMethod]}.`,
    });
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
    const billSnapshot = selectedBill;
    const billLabel = billSnapshot.staffBillNumber ?? billSnapshot.id;
    const scheduled = schedulePayment({
      key: `bill:${billSnapshot.id}`,
      label: billLabel,
      commit: () =>
        receivePendingBillPayment({
          billId: billSnapshot.id,
          paymentMethod,
          paymentSplits,
          payerName,
          discount,
        }),
      onUndo: () => {
        setRestoredPaymentDraft({
          billId: billSnapshot.id,
          paymentMethod,
          paymentSplits: paymentSplits ?? [],
          payerName,
          discount,
        });
        setSelectedBill(billSnapshot);
        setSelectedPlayerName(undefined);
      },
    });
    if (!scheduled) return;
    setRestoredPaymentDraft(null);
    setSelectedBill(null);
    setSelectedPlayerName(undefined);
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
    const billSnapshot = selectedBill;
    const billLabel = billSnapshot.staffBillNumber ?? billSnapshot.id;
    const scheduled = schedulePayment({
      key: getPendingPlayerPaymentKey(billSnapshot.id, input.playerName),
      label: `${input.playerName} - ${billLabel}`,
      commit: () =>
        receivePendingPlayerBillPayment({ billId: billSnapshot.id, ...input }),
      onUndo: () => {
        setRestoredPaymentDraft({
          billId: billSnapshot.id,
          paymentMethod: input.paymentMethod,
          paymentSplits: input.paymentSplits ?? [],
          payerName: input.payerName,
          discount: input.discount,
        });
        setSelectedBill(billSnapshot);
        setSelectedPlayerName(input.playerName);
      },
    });
    if (!scheduled) return;
    setRestoredPaymentDraft(null);
    setSelectedBill(null);
    setSelectedPlayerName(undefined);
  };
  const toggleCombineRow = (
    row: CombineSelectableRow,
  ) => {
    const key = getCombineRowKey(row);
    setCombineSelectedKeys((keys) =>
      keys.includes(key)
        ? keys.filter((selectedKey) => selectedKey !== key)
        : [...keys, key],
    );
  };
  const payCombinedAccountBill = (
    account: CustomerAccount,
    paymentMethod: PaymentMethod,
  ) => {
    if (!activeBusinessDay) return;

    const salesStore = useSalesStore.getState();
    const currentAccount = useCustomerAccountStore
      .getState()
      .getCustomerById(account.id);
    const alreadyPaid =
      currentAccount?.paymentStatus === "paid" ||
      salesStore.sales.some(
        (sale) =>
          sale.paymentStatus === "paid" &&
          (sale.customerAccountId === account.id ||
            sale.sessionId === account.id),
      );

    if (alreadyPaid) return;

    const now = new Date().toISOString();
    const totals = getAccountPaymentTotals(account);
    const invoiceNumber = salesStore.getNextInvoiceNumber();
    const saleId = `SALE-${invoiceNumber}-CUSTOMER`;
    const originalTableAmount = account.gameCharges.reduce(
      (total, charge) => total + (charge.originalAmount ?? charge.amount),
      0,
    );
    const originalGameCount = account.gameCharges.reduce(
      (total, charge) => total + (charge.gameCount ?? 1),
      0,
    );
    const orderedItems = [
      ...account.cafeCharges,
      ...(account.accessoryCharges ?? []),
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
    }));

    salesStore.addSale({
      id: saleId,
      invoiceNumber,
      tableId: 0,
      tableName: account.lastTableName ?? "-",
      saleType: "customer_bill",
      sessionId: account.id,
      players: [{ name: account.customerName }],
      sessionType: "time",
      payerName: account.customerName,
      startedAt: account.openedAt,
      endedAt: now,
      durationMinutes: 0,
      createdAt: now,
      paidAt: now,
      tableAmount: account.totalGameAmount,
      cafeAmount: totals.cafeTotal,
      subtotal: account.totalGameAmount + totals.cafeTotal + totals.accessoryTotal,
      discount: account.discount,
      grandTotal: totals.grandTotal,
      originalTableAmount,
      originalGameCount,
      advanceGamesApplied: account.advanceGamesApplied ?? 0,
      advanceReduction: account.advanceReduction ?? 0,
      paymentMethod,
      paymentStatus: "paid",
      activeBusinessDayId: activeBusinessDay.id,
      orderedItems,
      playerBreakdown: [
        {
          playerName: account.customerName,
          tableAmountShare: account.totalGameAmount,
          cafeAmount: account.totalCafeAmount + totals.accessoryTotal,
          totalAmount: totals.grandTotal,
          cafeItems: orderedItems,
        },
      ],
      customerAccountId: account.id,
      customerToken: account.customerToken,
      customerName: account.customerName,
      customerNote: account.customerNote,
      gameCharges: account.gameCharges,
      cafeCharges: account.cafeCharges,
    });

    markCustomerBillPaid({
      customerId: account.id,
      paymentMethod,
      activeBusinessDayId: activeBusinessDay.id,
      saleId,
    });

    [
      ...account.gameCharges,
      ...account.cafeCharges,
      ...(account.accessoryCharges ?? []),
    ]
      .map((charge) => charge.sessionId)
      .filter((sessionId): sessionId is string => Boolean(sessionId))
      .forEach((sessionId) => removePendingBill(`BILL-${sessionId}`));
  };
  const handleCombinePayment = () => {
    if (combineSelectedRows.length < 2) {
      toast.warning({
        title: "Select More Bills",
        description: "Choose at least 2 pending bills to combine payment.",
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

    const scheduledRows = combineSelectedRows.filter((row) => {
      if (row.type === "account") {
        const accountSnapshot = row.account;
        return schedulePayment({
          key: getCombineRowKey(row),
          label: getBillPrimaryLabel(accountSnapshot),
          commit: () =>
            payCombinedAccountBill(accountSnapshot, combinePaymentMethod),
          onUndo: () => {
            setSelectedBill(null);
            setSelectedPlayerName(undefined);
            navigate(`/operator/billing?customerBillId=${accountSnapshot.id}`);
          },
        });
      }

      const billSnapshot = row.bill;
      const playerIdentity: SessionPlayerBillingIdentity = {
        playerName: row.playerName,
        customerId: row.customerId,
      };
      const sessionCafeAmount = getPlayerCafeAmount(
        billSnapshot.session,
        playerIdentity,
      );
      const missingCafeAmount = Math.max(row.cafeAmount - sessionCafeAmount, 0);
      const orderedAt = new Date(
        billSnapshot.session.endTime ?? billSnapshot.createdAt,
      ).toISOString();
      const cafeItems =
        missingCafeAmount > 0
          ? [
              ...getPlayerCafeItems(billSnapshot.session, playerIdentity),
              {
                menuItemId: `ACCOUNT-CAFE-${billSnapshot.id}-${row.playerName}`,
                name: "Cafe Bill",
                price: missingCafeAmount,
                quantity: 1,
                subtotal: missingCafeAmount,
                timeAdded: new Date(orderedAt),
                tableId: billSnapshot.tableId,
                sessionId: billSnapshot.session.id,
                customerName: row.playerName,
                playerName: row.playerName,
                playerId: row.customerId,
                orderedAt,
              },
            ]
          : getPlayerCafeItems(billSnapshot.session, playerIdentity);
      const allPlayerNames = Array.from(
        new Set([
          ...getSessionPlayerBillingIdentities(billSnapshot.session).map(
            (player) => player.playerName,
          ),
          row.playerName,
        ]),
      );
      const scheduled = schedulePayment({
        key: getCombineRowKey(row),
        label: `${row.playerName} - ${
          billSnapshot.staffBillNumber ?? billSnapshot.id
        }`,
        commit: () =>
          receivePendingPlayerBillPayment({
            billId: billSnapshot.id,
            paymentMethod: combinePaymentMethod,
            payerName: row.playerName,
            playerName: row.playerName,
            tableAmount: row.snookerAmount,
            cafeAmount: row.cafeAmount,
            cafeItems,
            allPlayerNames,
            discount: getCheckoutRowDiscount(row),
          }),
        onUndo: () => {
          setRestoredPaymentDraft({
            billId: billSnapshot.id,
            paymentMethod: combinePaymentMethod,
            paymentSplits: [],
            payerName: row.playerName,
          });
          setSelectedBill(billSnapshot);
          setSelectedPlayerName(row.playerName);
        },
      });
      return scheduled;
    });

    if (scheduledRows.length === combineSelectedRows.length) {
      clearCombineSelection();
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
  const handleAddCafeToSelectedBill = (
    player: SessionPlayerBillingIdentity
  ) => {
    if (!selectedBill) return;

    const account = findPendingPlayerAccount({
      accounts: customerAccounts,
      sessionId: selectedBill.session.id,
      customerId: player.customerId,
      playerName: player.playerName,
    });

    if (!account) {
      toast.warning({
        title: "Cafe Bill Not Available",
        description:
          "The selected customer's open bill could not be found.",
      });
      return;
    }

    setSelectedBill(null);
    setSelectedPlayerName(undefined);
    setRestoredPaymentDraft(null);
    navigate(
      `/operator/cafe?customerBillId=${encodeURIComponent(account.id)}`
    );
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
  const openCheckoutRow = (row: CheckoutRow) => {
    if (row.type === "paid") {
      setSelectedSaleReceipt(row.sale);
      return;
    }

    if (row.type === "account") {
      navigate(`/operator/billing?customerBillId=${row.account.id}`);
      return;
    }

    if (row.type === "pending") {
      const account = findPendingPlayerAccount({
        accounts: customerAccounts,
        sessionId: row.bill.session.id,
        customerId: row.customerId,
        playerName: row.playerName,
      });

      if (account) {
        navigate(`/operator/billing?customerBillId=${account.id}`);
        return;
      }

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
    <PageShell width="wide" className="overflow-x-hidden" contentClassName="space-y-0">
      {" "}
      <div className="w-full">
        {" "}
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          {" "}
          <div>
            {" "}
            <Button
              variant="ghost"
              className="mb-3 gap-2"
              onClick={() => navigate("/operator/tables-rooms")}
            >
              {" "}
              <ArrowLeft className="h-4 w-4" /> Tables & Rooms{" "}
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
              <label className="grid min-w-[150px] gap-1 text-xs font-semibold text-slate-500">
                Status
                <select
                  className="h-10 rounded-md border bg-white px-3 text-sm font-normal text-slate-900"
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as ViewFilter)
                  }
                >
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="all">All</option>
                </select>
              </label>
              <label className="grid min-w-[170px] gap-1 text-xs font-semibold text-slate-500">
                Date
                <select
                  className="h-10 rounded-md border bg-white px-3 text-sm font-normal text-slate-900"
                  value={dateFilter}
                  onChange={(event) =>
                    setDateFilter(event.target.value as DateFilter)
                  }
                >
                  <option value="all">All Dates</option>
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="this-week">This Week</option>
                  <option value="this-month">This Month</option>
                  <option value="custom">Custom Range</option>
                </select>
              </label>
              <label className="grid min-w-[150px] gap-1 text-xs font-semibold text-slate-500">
                Bill Type
                <select
                  className="h-10 rounded-md border bg-white px-3 text-sm font-normal text-slate-900"
                  value={billTypeFilter}
                  onChange={(event) =>
                    setBillTypeFilter(event.target.value as BillTypeFilter)
                  }
                >
                  <option value="all">All Bills</option>
                  <option value="table">Table Bills</option>
                  <option value="cafe-only">Cafe Only</option>
                  <option value="accessories-only">Accessories Only</option>
                  <option value="mixed">Mixed Bills</option>
                </select>
              </label>
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
                  {paymentMethodOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
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
              <div className="flex flex-wrap items-center justify-end gap-2">
                {combineSelectionMode ? (
                  <>
                    <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-900">
                      <span className="font-semibold">
                        {combineSelectedRows.length} selected
                      </span>{" "}
                      - {formatCurrency(combineSelectedTotal)}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      disabled={combineSelectedRows.length < 2}
                      onClick={() => setCombineDialogOpen(true)}
                    >
                      Combine & Pay
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={clearCombineSelection}
                    >
                      Cancel Selection
                    </Button>
                  </>
                ) : statusFilter === "pending" || statusFilter === "all" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedBill(null);
                      setSelectedPlayerName(undefined);
                      setCombineSelectionMode(true);
                    }}
                  >
                    Combine Bills
                  </Button>
                ) : null}
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
            </div>
          </div>{" "}
          <div className="max-h-[calc(100vh-22rem)] min-h-[220px] w-full overflow-x-auto overflow-y-auto overscroll-x-contain pb-2">
            {" "}
            <table
              className={`table-fixed text-left text-sm ${
                statusFilter === "paid" || statusFilter === "cancelled"
                  ? "w-full min-w-[1080px]"
                  : "w-[1480px]"
              }`}
            >
              <colgroup>
                <col className="w-[50px]" />
                {combineSelectionMode && <col className="w-[56px]" />}
                <col className="w-[110px]" />
                <col className="w-[130px]" />
                <col
                  className={
                    statusFilter === "paid" || statusFilter === "cancelled"
                      ? "w-[190px]"
                      : "w-[250px]"
                  }
                />
                <col className="w-[110px]" />
                <col className="w-[95px]" />
                <col className="w-[105px]" />
                <col className="w-[125px]" />
                {statusFilter !== "paid" && <col className="w-[115px]" />}
                <col
                  className={
                    statusFilter === "paid" || statusFilter === "cancelled"
                      ? "w-[215px]"
                      : "w-[230px]"
                  }
                />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase text-slate-500 shadow-sm">
                <tr>
                  <th className="whitespace-nowrap px-3 py-2.5 text-center">
                    No.
                  </th>
                  {combineSelectionMode && (
                    <th className="whitespace-nowrap px-2 py-2.5 sm:px-3">
                      Select
                    </th>
                  )}
                  <th className="whitespace-nowrap px-3 py-2.5">
                    Started At
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5">
                    Ended At
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5">
                    Customer / Table
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-right">Table Charges</th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-right">Cafe</th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-right">Accessories</th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-right">Total</th>
                  {statusFilter !== "paid" && (
                    <th className="whitespace-nowrap px-3 py-2.5 text-center">Status</th>
                  )}
                  <th className="sticky right-0 z-20 whitespace-nowrap bg-slate-50 px-2 py-2.5 text-center dark:bg-slate-900">Action</th>
                </tr>
              </thead>
              <tbody>
                {checkoutRows.map((row, rowIndex) => {
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
                  const canCombineRow = isCombineSelectableRow(row);
                  const combineRowChecked =
                    canCombineRow &&
                    combineSelectedKeySet.has(getCombineRowKey(row));
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
                      className={`group h-[64px] cursor-pointer border-t transition focus:outline-none focus:ring-2 focus:ring-inset focus:ring-amber-300 ${
                        rowIsSelected
                          ? "bg-amber-50 ring-1 ring-inset ring-amber-200"
                          : "bg-white hover:bg-slate-50"
                      }`}
                    >
                      <td className="h-[64px] px-3 py-2 text-center align-middle font-semibold text-slate-500 tabular-nums">
                        {rowIndex + 1})
                      </td>
                      {combineSelectionMode && (
                        <td className="h-[64px] px-3 py-2 align-middle text-center">
                          {canCombineRow ? (
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-slate-300 text-slate-950"
                              checked={combineRowChecked}
                              onClick={(event) => event.stopPropagation()}
                              onChange={() => toggleCombineRow(row)}
                              aria-label={`Select ${customerPlayersLabel}`}
                            />
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                      )}
                      <td className="h-[64px] px-3 py-2 align-middle text-slate-700">
                        <span
                          className="block whitespace-nowrap font-medium text-slate-700 dark:text-slate-200"
                          title={startedAtTitle}
                        >
                          {startedAt.time || "-"}
                        </span>
                      </td>
                      <td className="h-[64px] px-3 py-2 align-middle text-slate-700">
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
                      <td className="h-[64px] overflow-hidden px-3 py-2 align-middle">
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
                      <td className="h-[64px] whitespace-nowrap px-3 py-2 text-right align-middle tabular-nums">
                        {formatAmountOrDash(getCheckoutRowTableAmount(row))}
                      </td>
                      <td className="h-[64px] whitespace-nowrap px-3 py-2 text-right align-middle tabular-nums">
                        {formatAmountOrDash(getCheckoutRowCafeAmount(row))}
                      </td>
                      <td className="h-[64px] whitespace-nowrap px-3 py-2 text-right align-middle tabular-nums">
                        {formatAmountOrDash(
                          getCheckoutRowAccessoryAmount(row),
                        )}
                      </td>
                      <td className="h-[64px] whitespace-nowrap px-3 py-2 text-right align-middle font-bold tabular-nums text-slate-950">
                        {formatCurrency(getCheckoutRowTotal(row))}
                      </td>
                      {statusFilter !== "paid" && (
                      <td className="h-[64px] px-3 py-2 text-center align-middle">
                        <div className="flex h-full flex-col items-center justify-center">
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
                        </div>
                      </td>
                      )}
                      <td
                        className={`sticky right-0 z-10 h-[64px] px-2 py-2 text-center align-middle ${
                          rowIsSelected
                            ? "bg-amber-50 dark:bg-amber-950"
                            : "bg-white group-hover:bg-slate-50 dark:bg-slate-950 dark:group-hover:bg-slate-800"
                        }`}
                      >
                        {row.type === "paid" ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              className="h-8 w-[100px] whitespace-nowrap px-2"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedSaleReceipt(row.sale);
                              }}
                            >
                              View Receipt
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 w-[78px] whitespace-nowrap px-2"
                              onClick={(event) => {
                                event.stopPropagation();
                                openEditSalePayment(row.sale);
                              }}
                            >
                              Edit Pay
                            </Button>
                            {canCancelBills && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 w-[72px] gap-1 whitespace-nowrap border-red-200 px-2 text-red-700 hover:bg-red-50"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleDeletePaidSale(row.sale);
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete
                              </Button>
                            )}
                          </div>
                        ) : row.type === "pending" || row.type === "account" ? (
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              size="sm"
                              className="h-8 w-[100px] whitespace-nowrap px-2"
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
                                  className="h-8 w-[100px] gap-1 whitespace-nowrap border-red-200 px-2 text-red-700 hover:bg-red-50"
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
                                className="h-8 w-[100px] gap-1 whitespace-nowrap border-red-200 px-2 text-red-700 hover:bg-red-50"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleCancelAccountBill(row.account);
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Delete Bill
                              </Button>
                            )}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
                {checkoutRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={
                        emptyColumnCount + 1 + (combineSelectionMode ? 1 : 0)
                      }
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
              label:
                contextMenu.row.type === "paid"
                  ? "View Receipt"
                  : contextMenu.row.type === "pending" &&
                      contextMenu.row.bill.status !== "cancelled"
                    ? "Collect Payment"
                    : "View Details",
              onSelect: () => openCheckoutRow(contextMenu.row),
            },
            ...(contextMenu.row.type === "paid"
              ? [{
                  id: "edit-payment" as const,
                  label: "Edit Payment Method",
                  onSelect: () =>
                    openEditSalePayment(
                      (contextMenu.row as Extract<CheckoutRow, { type: "paid" }>).sale,
                    ),
                }]
              : []),
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
      {combineDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  Combine Bills
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Pay selected bills together while keeping every bill separate.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setCombineDialogOpen(false)}
              >
                Close
              </Button>
            </div>
            <div className="mt-4 max-h-52 space-y-2 overflow-y-auto pr-1">
              {combineSelectedRows.map((row) => {
                const account = row.type === "pending" && row.customerId
                  ? customerAccountById.get(row.customerId)
                  : undefined;
                return (
                  <div
                    key={getCombineRowKey(row)}
                    className="flex items-center justify-between gap-3 rounded-lg border bg-slate-50 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-950">
                        {getCheckoutRowPlayersLabel(row, account)}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {getCheckoutRowTableLabel(row)} -{" "}
                        {getCheckoutRowBillLabel(row, account)}
                      </p>
                    </div>
                    <p className="whitespace-nowrap font-bold tabular-nums text-slate-950">
                      {formatCurrency(getCheckoutRowTotal(row))}
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 rounded-lg border bg-white p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-slate-600">
                  Combined Total
                </span>
                <span className="text-xl font-bold text-slate-950">
                  {formatCurrency(combineSelectedTotal)}
                </span>
              </div>
              <label className="mt-3 grid gap-1 text-sm font-medium text-slate-700">
                Payment Method
                <select
                  className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
                  value={combinePaymentMethod}
                  onChange={(event) =>
                    setCombinePaymentMethod(event.target.value as PaymentMethod)
                  }
                >
                  {paymentMethodOptions.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCombineDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={combineSelectedRows.length < 2}
                onClick={handleCombinePayment}
              >
                Combine & Pay
              </Button>
            </div>
          </div>
        </div>
      )}
      {selectedSaleReceipt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4"
          onClick={() => setSelectedSaleReceipt(null)}
        >
          <div
            className="flex max-h-[88vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-950">
                    Receipt {selectedSaleReceipt.staffBillNumber ?? selectedSaleReceipt.invoiceNumber}
                  </h2>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                    Paid
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {formatAppDateTime(getSalePaymentTime(selectedSaleReceipt))} -{" "}
                  {selectedSaleReceipt.tableName || "-"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openEditSalePayment(selectedSaleReceipt)}
                >
                  Edit Payment
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedSaleReceipt(null)}
                >
                  Close
                </Button>
              </div>
            </div>

            <div className="min-h-0 space-y-4 overflow-y-auto px-5 py-4">
              <section className="grid gap-3 rounded-lg border bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Bill Reference</p>
                  <p className="mt-1 font-semibold text-slate-950">
                    {selectedSaleReceipt.staffBillNumber ?? selectedSaleReceipt.invoiceNumber}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Customer</p>
                  <p className="mt-1 font-semibold text-slate-950">
                    {getSaleCustomerLabel(selectedSaleReceipt)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Table / Room</p>
                  <p className="mt-1 font-semibold text-slate-950">
                    {selectedSaleReceipt.tableName || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Type</p>
                  <p className="mt-1 font-semibold text-slate-950">
                    {getSaleTypeLabel(selectedSaleReceipt)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Started</p>
                  <p className="mt-1 font-semibold text-slate-950">
                    {formatAppDateTime(selectedSaleReceipt.startedAt)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Ended</p>
                  <p className="mt-1 font-semibold text-slate-950">
                    {formatAppDateTime(selectedSaleReceipt.endedAt)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Paid At</p>
                  <p className="mt-1 font-semibold text-slate-950">
                    {formatAppDateTime(getSalePaymentTime(selectedSaleReceipt))}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Operator</p>
                  <p className="mt-1 font-semibold text-slate-950">
                    {selectedSaleReceipt.paymentReceivedBy?.operatorName ?? "Not recorded"}
                  </p>
                </div>
              </section>

              {(() => {
                const summaryRows =
                  getReceiptSessionSummaryRows(selectedSaleReceipt);
                return summaryRows.length > 0 ? (
                  <section className="rounded-lg border p-4">
                    <h3 className="font-semibold text-slate-950">
                      Session Summary
                    </h3>
                    <div className="mt-3 divide-y rounded-lg border">
                      {summaryRows.map((row) => (
                        <div
                          key={row.label}
                          className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-3 py-2 text-sm"
                        >
                          <span className="font-medium text-slate-950">
                            {row.label}
                          </span>
                          <span className="text-right text-slate-500">
                            {row.detail}
                          </span>
                          <strong className="text-right">
                            {formatCurrency(row.amount)}
                          </strong>
                        </div>
                      ))}
                    </div>
                    {selectedSaleReceipt.tableChargeLines?.length ? (
                      <details className="mt-3 rounded-lg border bg-slate-50 px-3 py-2 text-sm">
                        <summary className="cursor-pointer font-semibold text-slate-700">
                          Session Details
                        </summary>
                        <div className="mt-2 space-y-2">
                          {selectedSaleReceipt.tableChargeLines.map((line, index) => (
                            <div
                              key={line.id}
                              className="flex items-start justify-between gap-3 rounded-md bg-white px-3 py-2"
                            >
                              <div>
                                <p className="font-medium text-slate-950">
                                  {getReceiptSessionDetailLabel(line, index)}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {formatAppDateTime(line.startedAt)}
                                  {line.endedAt ? ` - ${formatAppDateTime(line.endedAt)}` : ""}
                                </p>
                              </div>
                              <strong>{formatCurrency(line.amount)}</strong>
                            </div>
                          ))}
                        </div>
                      </details>
                    ) : null}
                  </section>
                ) : null;
              })()}

              {(selectedSaleReceipt.orderedItems ?? []).length > 0 && (
                <section>
                  <h3 className="mb-2 font-semibold text-slate-950">
                    Cafe / Accessories
                  </h3>
                  <div className="divide-y overflow-hidden rounded-lg border">
                    {(selectedSaleReceipt.orderedItems ?? []).map((item, index) => (
                      <div
                        key={`${item.menuItemId}-${index}`}
                        className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                      >
                        <div>
                          <p className="font-medium text-slate-950">
                            {item.name.replace(/^\[Accessory\]\s*/, "")}
                          </p>
                          <p className="text-xs text-slate-500">
                            {item.quantity} x {formatCurrency(item.price)}
                          </p>
                        </div>
                        <strong>{formatCurrency(item.subtotal)}</strong>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className="rounded-lg border p-4">
                <h3 className="font-semibold text-slate-950">Charges</h3>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Cafe Charges</span>
                    <strong>{formatCurrency(getSaleCafeReceiptAmount(selectedSaleReceipt))}</strong>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Accessories Charges</span>
                    <strong>{formatCurrency(getSaleAccessoryAmount(selectedSaleReceipt))}</strong>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Discount</span>
                    <strong>{formatCurrency(selectedSaleReceipt.discount)}</strong>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Advance Games Applied</span>
                    <strong>{selectedSaleReceipt.advanceGamesApplied ?? 0}</strong>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Payment Method</span>
                    <strong>
                      {getSalePaymentLabel(selectedSaleReceipt, paymentMethodLabels)}
                    </strong>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t pt-3 text-lg">
                  <span className="font-semibold">Grand Total</span>
                  <strong>{formatCurrency(selectedSaleReceipt.grandTotal)}</strong>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
      {salePaymentToEdit && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 px-4"
          onClick={() => setSalePaymentToEdit(null)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  Edit Payment Method
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {salePaymentToEdit.staffBillNumber ??
                    salePaymentToEdit.invoiceNumber}{" "}
                  - {formatCurrency(salePaymentToEdit.grandTotal)}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSalePaymentToEdit(null)}
              >
                Close
              </Button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-sm font-semibold text-slate-700">
                  Correct payment method
                </label>
                <select
                  className="mt-1 h-10 w-full rounded-lg border border-input bg-white px-3 text-sm"
                  value={correctedPaymentMethod}
                  onChange={(event) =>
                    setCorrectedPaymentMethod(
                      event.target.value as PaymentMethod,
                    )
                  }
                >
                  {paymentMethodOptions.map(
                    ({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </div>
              {salePaymentToEdit.paymentSplits?.length ? (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Saving one method will remove the previous split payment.
                </p>
              ) : null}
              <Button
                type="button"
                className="w-full"
                onClick={handleCorrectSalePaymentMethod}
              >
                Save Correction
              </Button>
            </div>
          </div>
        </div>
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
          initialPaymentMethod={
            restoredPaymentDraft?.billId === selectedBill.id
              ? restoredPaymentDraft.paymentMethod
              : undefined
          }
          initialPaymentSplits={
            restoredPaymentDraft?.billId === selectedBill.id
              ? restoredPaymentDraft.paymentSplits
              : undefined
          }
          initialPayerName={
            restoredPaymentDraft?.billId === selectedBill.id
              ? restoredPaymentDraft.payerName
              : undefined
          }
          initialDiscount={
            restoredPaymentDraft?.billId === selectedBill.id
              ? restoredPaymentDraft.discount
              : undefined
          }
          paidPlayerNames={selectedBill.paidPlayerNames}
          onClose={() => {
            setSelectedBill(null);
            setSelectedPlayerName(undefined);
            setRestoredPaymentDraft(null);
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
          onAddCafe={handleAddCafeToSelectedBill}
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
    </PageShell>
  );
}
export default CheckoutPage;
