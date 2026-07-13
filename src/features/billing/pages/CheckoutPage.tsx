import {
  ArrowLeft,
  ReceiptText,
  Search,
  Trash2,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { PaymentMethod } from "@/types/session";
import type { PaymentSplit } from "@/features/sales/types/sale";

import BillingDialog from "../components/BillingDialog";
import {
  useCheckoutStore,
  type PendingBill,
} from "../store/checkoutStore";
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
  getBillCustomerLabel,
  getBillPrimaryLabel,
  getBillTableLabel,
} from "@/features/customers/utils/billDisplay";

type StatusFilter =
  | "pending"
  | "paid"
  | "cancelled";
type ViewFilter = StatusFilter | "all";
type DateFilter =
  | "today"
  | "yesterday"
  | "this-week"
  | "this-month"
  | "custom";
type PaymentMethodFilter =
  | PaymentMethod
  | "all";
type TableFilter = number | "all";
const paymentMethodLabels: Record<
  PaymentMethod,
  string
> = {
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
    return paymentMethodLabels[
      sale.paymentMethod
    ];
  }

  return sale.paymentSplits
    .map(
      (split) =>
        `${paymentMethodLabels[split.method]} Rs. ${split.amount}`
    )
    .join(" + ");
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
  | {
      type: "account";
      account: CustomerAccount;
    }
  | {
      type: "paid";
      sale: Sale;
    };

function getAccountAccessoryAmount(
  account: CustomerAccount
) {
  return (
    account.accessoryCharges?.reduce(
      (total, charge) =>
        total + charge.subtotal,
      0
    ) ?? 0
  );
}

function getAccountCafeAmount(
  account: CustomerAccount
) {
  return account.cafeCharges
    .filter(
      (charge) =>
        !charge.name.startsWith(
          "[Accessory]"
        )
    )
    .reduce(
      (total, charge) =>
        total + charge.subtotal,
      0
    );
}

function formatTime(value: string) {
  return new Date(value).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getDateRange(
  filter: DateFilter,
  customStart: string,
  customEnd: string
) {
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
      start: customStart
        ? new Date(`${customStart}T00:00:00`)
        : start,
      end: customEnd
        ? new Date(`${customEnd}T23:59:59`)
        : end,
    };
  }

  return { start, end };
}

function isInDateRange(
  value: string,
  start: Date,
  end: Date
) {
  const time = new Date(value).getTime();

  return (
    time >= start.getTime() &&
    time <= end.getTime()
  );
}

function getPendingPlayerBillRows(
  bill: PendingBill
) {
  const players = Array.from(
    new Set(
      getSessionPlayers(bill.session).map(
        (player) => player.trim()
      )
    )
  );
  const paidPlayerNames =
    bill.paidPlayerNames ?? [];

  if (!bill.session.endTime) return [];

  const pricing = calculateGamePrice({
    sessionType: bill.session.sessionType,
    tableType: bill.tableType,
    startTime: new Date(
      bill.session.startTime
    ),
    endTime: new Date(
      bill.session.endTime
    ),
  });
  const payerName =
    bill.session.payerName ??
    bill.session.loserName ??
    players[0];
  const payerBreakdown =
    calculateDoubleGamePayerBreakdown({
      session: {
        ...bill.session,
        payerName,
      },
      tableAmount: pricing.gameAmount,
    });
  const getPlayerCustomerId = (
    playerName: string
  ) =>
    playerName === bill.session.player1
      ? bill.session.player1CustomerId
      : playerName === bill.session.player2
        ? bill.session.player2CustomerId
        : playerName === bill.session.player3
          ? bill.session.player3CustomerId
          : playerName === bill.session.player4
            ? bill.session.player4CustomerId
            : undefined;

  return players
    .filter(
      (playerName) =>
        !paidPlayerNames.includes(
          playerName
        )
    )
    .map((playerName) => {
      const cafeAmount =
        bill.session.cafeOrders
          .filter(
            (item) =>
              (item.playerName ??
                item.customerName ??
                "") === playerName
          )
          .reduce(
            (total, item) =>
              total + item.subtotal,
            0
          );
      const snookerAmount =
        payerBreakdown.find(
          (payer) =>
            payer.playerName ===
            playerName
        )?.tableAmountShare ?? 0;
      const total =
        snookerAmount + cafeAmount;

      return {
        type: "pending" as const,
        bill,
        playerName,
        customerId:
          getPlayerCustomerId(playerName),
        snookerAmount,
        cafeAmount,
        total,
      };
    })
    .filter((row) => row.total > 0);
}

function getRowTime(row: CheckoutRow) {
  if (row.type === "pending") {
    return row.bill.createdAt;
  }

  if (row.type === "account") {
    return (
      row.account.lastActivityAt ??
      row.account.openedAt
    );
  }

  return row.sale.createdAt;
}

function getCheckoutRowDisplayName(
  row: CheckoutRow,
  name?: string
) {
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
      tableName:
        getBillTableLabel(row.account),
      time:
        row.account.lastActivityAt ??
        row.account.openedAt,
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
  account?: CustomerAccount
) {
  if (row.type === "pending") {
    if (account) {
      if (isWalkInName(account.customerName)) {
        const note = account.customerNote?.trim();

        return note
          ? `Walk-in \u00b7 ${note}`
          : "Walk-in Customer";
      }

      return account.customerName;
    }

    return isWalkInName(row.playerName)
      ? "Walk-in Customer"
      : row.playerName;
  }

  if (row.type === "account") {
    return getBillCustomerLabel(row.account);
  }

  if (row.sale.sessionType === "double") {
    const teamA = row.sale.teamAPlayers?.filter(Boolean) ?? [];
    const teamB = row.sale.teamBPlayers?.filter(Boolean) ?? [];

    if (teamA.length || teamB.length) {
      return [teamA.join(", "), teamB.join(", ")]
        .filter(Boolean)
        .join(" vs ");
    }
  }

  return row.sale.players
    .map((player) =>
      isWalkInName(player.name)
        ? "Walk-in Customer"
        : player.name
    )
    .join(", ");
}

function getCheckoutRowBillLabel(
  row: CheckoutRow,
  account?: CustomerAccount
) {
  if (row.type === "pending") {
    if (row.bill.staffBillNumber) {
      return row.bill.staffBillNumber;
    }

    if (account) {
      if (account.staffBillNumber) {
        return account.staffBillNumber;
      }

      return isWalkInName(account.customerName)
        ? getCheckoutRowDisplayName(
            row,
            account.customerName
          )
        : account.customerToken;
    }

    return isWalkInName(row.playerName)
      ? getCheckoutRowDisplayName(row, row.playerName)
      : row.bill.id;
  }

  if (row.type === "account") {
    return getBillPrimaryLabel(row.account);
  }

  return row.sale.staffBillNumber ??
    row.sale.customerToken ??
    (isWalkInName(row.sale.payerName ?? row.sale.players[0]?.name)
      ? getCheckoutRowDisplayName(
          row,
          row.sale.payerName ?? row.sale.players[0]?.name
        )
      : row.sale.invoiceNumber);
}

function getCheckoutRowTypeLabel(row: CheckoutRow) {
  if (row.type === "pending") {
    if (row.bill.tableType === "private-room") {
      return "Private Room";
    }

    if (row.bill.session.sessionType === "single") {
      return "Single Game";
    }

    if (row.bill.session.sessionType === "double") {
      return "Double Game";
    }

    if (row.bill.session.sessionType === "time") {
      return "Table Booking";
    }

    return "Private Room";
  }

  if (row.type === "account") {
    if (
      row.account.totalGameAmount > 0
    ) {
      const firstGame =
        row.account.gameCharges[0];

      if (
        firstGame?.tableType ===
        "private-room"
      ) {
        return "Private Room";
      }

      if (
        firstGame?.sessionType ===
        "single"
      ) {
        return "Single Game";
      }

      if (
        firstGame?.sessionType ===
        "double"
      ) {
        return "Double Game";
      }

      return "Table Booking";
    }

    if (
      getAccountAccessoryAmount(
        row.account
      ) > 0 &&
      getAccountCafeAmount(row.account) === 0
    ) {
      return "Accessories Only";
    }

    return "Cafe Only";
  }

  const saleType =
    row.sale.saleType;

  if (
    saleType === "cafe-only" ||
    saleType === "cafe_only"
  ) {
    return "Cafe Only";
  }

  if (saleType === "customer_bill") {
    return "Customer Bill";
  }

  if (saleType === "accessories") {
    return "Accessories Only";
  }

  if (row.sale.sessionType === "single") {
    return "Single Game";
  }

  if (row.sale.sessionType === "double") {
    return "Double Game";
  }

  if (
    row.sale.sessionType === "private" ||
    /^private/i.test(row.sale.tableName) ||
    /^pr/i.test(row.sale.tableName)
  ) {
    return "Private Room";
  }

  return "Table Booking";
}

function getCheckoutRowAccessoryAmount(row: CheckoutRow) {
  if (row.type === "pending") {
    return 0;
  }

  if (row.type === "account") {
    return getAccountAccessoryAmount(
      row.account
    );
  }

  return row.sale.cafeCharges
    ?.filter((charge) =>
      charge.name.startsWith("[Accessory]")
    )
    .reduce(
      (total, charge) =>
        total + charge.subtotal,
      0
    ) ?? 0;
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
  const accessoryAmount =
    getCheckoutRowAccessoryAmount(row);

  if (row.type === "pending") {
    return row.cafeAmount;
  }

  if (row.type === "account") {
    return getAccountCafeAmount(
      row.account
    );
  }

  return Math.max(
        row.sale.cafeAmount - accessoryAmount,
        0
      );
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

  return Math.max(
    row.total - getCheckoutRowDiscount(row),
    0
  );
}

function combinePendingRows(
  rows: CheckoutRow[]
) {
  const pendingRows = new Map<
    string,
    Extract<CheckoutRow, { type: "pending" }>
  >();
  const combinedRows: CheckoutRow[] = [];

  rows.forEach((row) => {
    if (
      row.type === "paid" ||
      row.type === "account"
    ) {
      combinedRows.push(row);
      return;
    }

    const key = row.customerId
      ? `customer-${row.customerId}`
      : `${row.bill.id}-${row.playerName.trim().toLowerCase()}`;
    const existing = pendingRows.get(key);

    if (!existing) {
      pendingRows.set(key, row);
      combinedRows.push(row);
      return;
    }

    existing.snookerAmount +=
      row.snookerAmount;
    existing.cafeAmount += row.cafeAmount;
    existing.total += row.total;
  });

  return combinedRows;
}

function dedupeCheckoutRows(
  rows: CheckoutRow[]
) {
  const seen = new Set<string>();

  return rows.filter((row) => {
    const account =
      row.type === "account"
        ? row.account
        : undefined;
    const key =
      row.type === "account"
        ? `account-${row.account.id}`
        : row.type === "pending"
          ? `pending-${
              row.customerId ??
              row.bill.staffBillNumber ??
              row.bill.id
            }`
          : `paid-${row.sale.id}`;
    const billLabel =
      getCheckoutRowBillLabel(
        row,
        account
      );
    const stableKey =
      row.type === "paid"
        ? key
        : `open-${billLabel}`;

    if (seen.has(stableKey)) {
      return false;
    }

    seen.add(stableKey);
    return true;
  });
}

function isCheckoutTableSale(sale: Sale) {
  return (
    sale.saleType === undefined ||
    sale.saleType === "table"
  );
}

function CheckoutPage() {
  const navigate = useNavigate();
  const pendingBills = useCheckoutStore(
    (state) => state.pendingBills
  );
  const receivePendingBillPayment =
    useCheckoutStore(
      (state) =>
        state.receivePendingBillPayment
    );
  const receivePendingPlayerBillPayment =
    useCheckoutStore(
      (state) =>
        state.receivePendingPlayerBillPayment
    );
  const removePendingBill =
    useCheckoutStore(
      (state) => state.removePendingBill
    );
  const cancelPendingBill =
    useCheckoutStore(
      (state) => state.cancelPendingBill
    );
  const updatePendingBillDiscount =
    useCheckoutStore(
      (state) =>
        state.updatePendingBillDiscount
    );
  const sales = useSalesStore(
    (state) => state.sales
  );
  const deleteSale = useSalesStore(
    (state) => state.deleteSale
  );
  const activeBusinessDay =
    useBusinessDayStore((state) =>
      state.getActiveBusinessDay()
    );
  const customerAccounts =
    useCustomerAccountStore(
      (state) => state.accounts
    );

  const [selectedBill, setSelectedBill] =
    useState<PendingBill | null>(null);
  const [
    selectedPlayerName,
    setSelectedPlayerName,
  ] = useState<string | undefined>();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<ViewFilter>("pending");
  const [dateFilter, setDateFilter] =
    useState<DateFilter>("today");
  const [
    paymentMethodFilter,
    setPaymentMethodFilter,
  ] = useState<PaymentMethodFilter>("all");
  const [tableFilter, setTableFilter] =
    useState<TableFilter>("all");
  const [customStart, setCustomStart] =
    useState("");
  const [customEnd, setCustomEnd] =
    useState("");
  const [message, setMessage] =
    useState("");
  const [billToCancel, setBillToCancel] =
    useState<PendingBill | null>(null);
  const [cancelReason, setCancelReason] =
    useState("");
  const [cancelNote, setCancelNote] =
    useState("");
  const [cancelError, setCancelError] =
    useState("");

  const customerAccountById = useMemo(
    () =>
      new Map(
        customerAccounts.map((account) => [
          account.id,
          account,
        ])
      ),
    [customerAccounts]
  );

  useEffect(() => {
    pendingBills.forEach((bill) => {
      const alreadyPaid = sales.some(
        (sale) =>
          sale.sessionId === bill.session.id ||
          sale.sessionId === bill.id
      );

      if (alreadyPaid) {
        removePendingBill(bill.id);
      }
    });
  }, [
    pendingBills,
    removePendingBill,
    sales,
  ]);

  const unpaidBills = useMemo(
    () =>
      pendingBills.filter(
        (bill) =>
          !sales.some(
            (sale) =>
              sale.sessionId ===
                bill.session.id ||
              sale.sessionId === bill.id
          )
      ),
    [pendingBills, sales]
  );
  const activePendingBills = useMemo(
    () =>
      unpaidBills.filter(
        (bill) =>
          bill.status !== "cancelled"
      ),
    [unpaidBills]
  );
  const cancelledBills = useMemo(
    () =>
      unpaidBills.filter(
        (bill) =>
          bill.status === "cancelled"
      ),
    [unpaidBills]
  );
  const openCustomerAccountBills =
    useMemo(
      () =>
        customerAccounts.filter(
          (account) =>
            account.status === "active" &&
            account.paymentStatus ===
              "unpaid" &&
            account.grandTotal > 0
        ),
      [customerAccounts]
    );
  const displayPendingBills = useMemo(
    () =>
      activePendingBills.filter((bill) => {
        const billSessionId =
          bill.session.id;
        const billStaffNumber =
          bill.staffBillNumber;

        return !openCustomerAccountBills.some(
          (account) => {
            const accountSessionIds = [
              ...account.gameCharges.map(
                (charge) => charge.sessionId
              ),
              ...account.cafeCharges.map(
                (charge) => charge.sessionId
              ),
              ...(account.accessoryCharges ?? []).map(
                (charge) => charge.sessionId
              ),
            ].filter(Boolean);

            return (
              (billStaffNumber &&
                account.staffBillNumber ===
                  billStaffNumber) ||
              accountSessionIds.includes(
                billSessionId
              ) ||
              [
                bill.session.player1CustomerId,
                bill.session.player2CustomerId,
                bill.session.player3CustomerId,
                bill.session.player4CustomerId,
              ]
                .filter(
                  (id): id is string =>
                    Boolean(id)
                )
                .includes(account.id)
            );
          }
        );
      }),
    [
      activePendingBills,
      openCustomerAccountBills,
    ]
  );
  const activeCustomerAccounts =
    useMemo(() => {
      const pendingCustomerIds =
        new Set<string>();

      displayPendingBills.forEach((bill) => {
        [
          bill.session.player1CustomerId,
          bill.session.player2CustomerId,
          bill.session.player3CustomerId,
          bill.session.player4CustomerId,
        ]
          .filter(
            (id): id is string =>
              Boolean(id)
          )
          .forEach((id) =>
            pendingCustomerIds.add(id)
          );
      });

      return openCustomerAccountBills.filter(
        (account) =>
          !pendingCustomerIds.has(account.id)
      );
    }, [
      displayPendingBills,
      openCustomerAccountBills,
    ]);
  const checkoutSales = useMemo(
    () => sales.filter(isCheckoutTableSale),
    [sales]
  );

  const todaySales = useMemo(() => {
    const today = new Date();

    return checkoutSales.filter((sale) => {
      const createdAt = new Date(
        sale.createdAt
      );

      return (
        createdAt.toDateString() ===
        today.toDateString()
      );
    });
  }, [checkoutSales]);

  const pendingAmount = displayPendingBills.reduce(
    (total, bill) =>
      total +
      getRemainingPendingBillTotal(bill),
    0
  );
  const openCustomerAccountAmount =
    activeCustomerAccounts.reduce(
      (total, account) =>
        total + account.grandTotal,
      0
    );
  const openBillsCount =
    displayPendingBills.length +
    activeCustomerAccounts.length;
  const openAmount =
    pendingAmount +
    openCustomerAccountAmount;

  const totalReceivedToday =
    todaySales.reduce(
      (total, sale) =>
        total + sale.grandTotal,
      0
    );

  const rowsForTableOptions = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();
    const { start, end } = getDateRange(
      dateFilter,
      customStart,
      customEnd
    );

    const rows: CheckoutRow[] =
      statusFilter === "pending"
        ? [
            ...displayPendingBills.flatMap((bill) =>
              getPendingPlayerBillRows(bill)
            ),
            ...activeCustomerAccounts.map(
              (account) => ({
                type: "account" as const,
                account,
              })
            ),
          ]
        : statusFilter === "paid"
          ? checkoutSales.map((sale) => ({
              type: "paid",
              sale,
            }))
          : statusFilter === "cancelled"
            ? cancelledBills.flatMap((bill) =>
                getPendingPlayerBillRows(bill)
              )
          : [
              ...displayPendingBills.flatMap((bill) =>
                getPendingPlayerBillRows(bill)
              ),
              ...activeCustomerAccounts.map(
                (account) => ({
                  type: "account" as const,
                  account,
                })
              ),
              ...cancelledBills.flatMap((bill) =>
                getPendingPlayerBillRows(bill)
              ),
              ...checkoutSales.map((sale) => ({
                type: "paid" as const,
                sale,
              })),
            ];

    const tableFilteredRows = dedupeCheckoutRows(
      combinePendingRows(rows)
    ).filter(
      (row) => {
        if (
          !isInDateRange(
            getRowTime(row),
            start,
            end
          )
        ) {
          return false;
        }

        if (
          paymentMethodFilter !== "all" &&
          row.type === "paid" &&
          !(
              row.sale.paymentMethod ===
                paymentMethodFilter ||
              row.sale.paymentSplits?.some(
                (split) =>
                  split.method ===
                  paymentMethodFilter
              )
            )
        ) {
          return false;
        }

        return true;
      }
    );

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
            : row.sale.players.map(
                (player) => player.name
              );
        const account =
          row.type === "pending" && row.customerId
            ? customerAccountById.get(row.customerId)
            : row.type === "account"
              ? row.account
            : undefined;
        const displayPlayers =
          getCheckoutRowPlayersLabel(row, account);
        const billLabel =
          getCheckoutRowBillLabel(row, account);
        const payerName =
          row.type === "pending"
            ? row.bill.session.payerName
            : row.type === "account"
              ? row.account.customerName
            : row.sale.payerName;
        const displayPayer =
          getCheckoutRowDisplayName(
            row,
            payerName
          );
        const paymentMethod =
          row.type === "paid"
            ? getSalePaymentLabel(row.sale)
            : "";
        const accountCafeItems =
          row.type === "account"
            ? row.account.cafeCharges
                .map((charge) => charge.name)
                .join(" ")
            : "";

        const playerNames = players
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return (
          invoice.toLowerCase().includes(query) ||
          billLabel
            .toLowerCase()
            .includes(query) ||
          (account?.customerToken ?? "")
            .toLowerCase()
            .includes(query) ||
          (account?.customerName ?? "")
            .toLowerCase()
            .includes(query) ||
          (account?.customerNote ?? "")
            .toLowerCase()
            .includes(query) ||
          tableName
            .toLowerCase()
            .includes(query) ||
          playerNames.includes(query) ||
          displayPlayers
            .toLowerCase()
            .includes(query) ||
          (payerName ?? "")
            .toLowerCase()
            .includes(query) ||
          displayPayer
            .toLowerCase()
            .includes(query) ||
          paymentMethod
            .toLowerCase()
            .includes(query) ||
          accountCafeItems
            .toLowerCase()
            .includes(query) ||
          (row.type === "pending" &&
            (row.bill.cancelledReason ?? "")
              .toLowerCase()
              .includes(query)) ||
          (row.type === "pending" &&
            (row.bill.cancelledNote ?? "")
              .toLowerCase()
            .includes(query)
          )
        );
      })
      .sort((first, second) => {
        const firstTime = new Date(
          getRowTime(first)
        ).getTime();
        const secondTime = new Date(
          getRowTime(second)
        ).getTime();

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
  ]);

  const tableOptions = useMemo(() => {
    const options = new Map<number, string>();

    rowsForTableOptions.forEach((row) => {
      if (row.type === "pending") {
        options.set(
          row.bill.tableId,
          row.bill.tableName
        );
        return;
      }

      if (row.type === "account") {
        row.account.gameCharges.forEach(
          (charge) =>
            options.set(
              charge.tableId,
              charge.tableName
            )
        );
        return;
      }

      if (row.sale.tableId > 0) {
        options.set(
          row.sale.tableId,
          row.sale.tableName
        );
      }
    });

    return Array.from(options.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((first, second) =>
        first.id === second.id
          ? first.name.localeCompare(second.name)
          : first.id - second.id
      );
  }, [rowsForTableOptions]);

  const checkoutRows = useMemo(
    () =>
      rowsForTableOptions.filter((row) => {
        if (tableFilter === "all") {
          return true;
        }

        return (
          row.type === "pending"
            ? row.bill.tableId === tableFilter
            : row.type === "account"
              ? row.account.gameCharges.some(
                  (charge) =>
                    charge.tableId === tableFilter
                )
              : row.sale.tableId === tableFilter
        );
      }),
    [rowsForTableOptions, tableFilter]
  );
  const showPaymentColumn =
    statusFilter === "paid" ||
    statusFilter === "all";
  const showStatusColumn =
    statusFilter !== "paid";
  const showAccessoriesColumn =
    checkoutRows.some(
      (row) =>
        getCheckoutRowAccessoryAmount(row) > 0
    );
  const emptyColumnCount =
    9 +
    (showAccessoriesColumn ? 1 : 0) +
    (showStatusColumn ? 1 : 0) +
    (showPaymentColumn ? 1 : 0);

  const handleReceivePayment = (
    paymentMethod: PaymentMethod,
    payerName?: string,
    paymentSplits?: PaymentSplit[],
    discount?: number
  ) => {
    if (!selectedBill) return;
    if (selectedBill.status === "cancelled") {
      setMessage(
        "Cancelled bills cannot receive payment."
      );
      return;
    }
    if (!activeBusinessDay) {
      setMessage(
        "Please start the day before receiving payment."
      );
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
      setMessage(
        "Cancelled bills cannot receive payment."
      );
      return;
    }
    if (!activeBusinessDay) {
      setMessage(
        "Please start the day before receiving payment."
      );
      return;
    }

    receivePendingPlayerBillPayment({
      billId: selectedBill.id,
      ...input,
    });

    const paidPlayerNames =
      selectedBill.paidPlayerNames ?? [];
    const nextPaidPlayerNames =
      paidPlayerNames.includes(
        input.playerName
      )
        ? paidPlayerNames
        : [
            ...paidPlayerNames,
            input.playerName,
          ];
    const allBillsReceived =
      input.allPlayerNames.every((name) =>
        nextPaidPlayerNames.includes(name)
      );

    if (allBillsReceived) {
      setSelectedBill(null);
      setSelectedPlayerName(undefined);
    } else {
      setSelectedBill({
        ...selectedBill,
        paidPlayerNames:
          nextPaidPlayerNames,
      });
    }
  };

  const handleUpdateSelectedBillDiscount = (
    discount: number
  ) => {
    if (!selectedBill) return;

    updatePendingBillDiscount(
      selectedBill.id,
      discount
    );
    setSelectedBill({
      ...selectedBill,
      session: {
        ...selectedBill.session,
        discount,
      },
    });
  };

  const handleCancelPendingBill = (
    bill: PendingBill
  ) => {
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
      setCancelError(
        "Please select a cancellation reason."
      );
      return;
    }

    if (reason === "Other" && !note) {
      setCancelError(
        "Please enter a note for Other."
      );
      return;
    }

    cancelPendingBill({
      billId: billToCancel.id,
      reason,
      note,
    });
    useCustomerAccountStore
      .getState()
      .removeSessionCharges(
        billToCancel.session.id
      );

    if (selectedBill?.id === billToCancel.id) {
      setSelectedBill(null);
      setSelectedPlayerName(undefined);
    }

    setMessage(
      `Cancelled bill ${
        billToCancel.staffBillNumber ??
        billToCancel.id
      }.`
    );
    setBillToCancel(null);
  };

  const handleDeleteSale = (sale: Sale) => {
    const confirmed = window.confirm(
      `Delete paid bill ${sale.invoiceNumber}? This is for removing mistaken test bills.`
    );

    if (!confirmed) return;

    deleteSale(sale.id);
    setMessage(
      `Deleted paid bill ${sale.invoiceNumber}.`
    );
  };

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Button
              variant="ghost"
              className="mb-3 gap-2"
              onClick={() => navigate("/operator")}
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Button>

            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-slate-700 shadow-sm ring-1 ring-slate-200">
                <ReceiptText className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-950">
                  Customer Bills / Checkout
                </h1>
                <p className="text-sm text-slate-500">
                  Ended game bills waiting for payment.
                </p>
              </div>
            </div>
          </div>
        </div>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card className="p-4">
            <p className="text-sm text-slate-500">
              Open Bills
            </p>
            <p className="mt-1 text-2xl font-bold">
              {openBillsCount}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-slate-500">
              Open Amount
            </p>
            <p className="mt-1 text-2xl font-bold">
              Rs. {openAmount}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-slate-500">
              Paid Today
            </p>
            <p className="mt-1 text-2xl font-bold">
              {todaySales.length}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-slate-500">
              Received Today
            </p>
            <p className="mt-1 text-2xl font-bold">
              Rs. {totalReceivedToday}
            </p>
          </Card>
        </section>

        {message && (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {message}
          </p>
        )}

        <Card className="mt-5 overflow-hidden">
          <div className="grid gap-3 border-b p-4">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-slate-400" />
              <Input
                placeholder={
                  statusFilter === "pending"
                    ? "Search bill no, table, customer, player..."
                    : statusFilter === "paid"
                      ? "Search bill no, table, customer, payment method..."
                      : statusFilter === "cancelled"
                        ? "Search bill no, table, customer, cancellation reason..."
                      : "Search bill no, table, customer, player, payment method..."
                }
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex rounded-lg border bg-white p-1">
                {(["pending", "paid", "cancelled", "all"] as ViewFilter[]).map(
                  (value) => (
                    <Button
                      key={value}
                      variant={
                        statusFilter === value
                          ? "default"
                          : "ghost"
                      }
                      onClick={() =>
                        setStatusFilter(value)
                      }
                    >
                      {value === "all"
                        ? "All"
                        : value === "paid"
                          ? "Paid"
                          : value === "cancelled"
                            ? "Cancelled"
                          : "Pending"}
                    </Button>
                  )
                )}
              </div>

              <div className="flex flex-wrap rounded-lg border bg-white p-1">
                {(
                  [
                    ["today", "Today"],
                    ["yesterday", "Yesterday"],
                    ["this-week", "This Week"],
                    ["this-month", "This Month"],
                    ["custom", "Custom Range"],
                  ] as [DateFilter, string][]
                ).map(([value, label]) => (
                  <Button
                    key={value}
                    variant={
                      dateFilter === value
                        ? "default"
                        : "ghost"
                    }
                    onClick={() =>
                      setDateFilter(value)
                    }
                  >
                    {label}
                  </Button>
                ))}
              </div>

              <select
                className="h-10 rounded-md border bg-white px-3 text-sm"
                value={paymentMethodFilter}
                onChange={(event) =>
                  setPaymentMethodFilter(
                    event.target
                      .value as PaymentMethodFilter
                  )
                }
              >
                <option value="all">
                  All Payments
                </option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="jazzcash">
                  JazzCash
                </option>
                <option value="easypaisa">
                  Easypaisa
                </option>
              </select>

              <select
                className="h-10 rounded-md border bg-white px-3 text-sm"
                value={tableFilter}
                onChange={(event) =>
                  setTableFilter(
                    event.target.value === "all"
                      ? "all"
                      : Number(
                          event.target.value
                        )
                  )
                }
              >
                <option value="all">
                  All Tables
                </option>
                {tableOptions.map((table) => (
                  <option
                    key={table.id}
                    value={table.id}
                  >
                    {table.name}
                  </option>
                ))}
              </select>
            </div>

            {dateFilter === "custom" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  type="date"
                  value={customStart}
                  onChange={(event) =>
                    setCustomStart(
                      event.target.value
                    )
                  }
                />
                <Input
                  type="date"
                  value={customEnd}
                  onChange={(event) =>
                    setCustomEnd(
                      event.target.value
                    )
                  }
                />
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="min-w-44 whitespace-nowrap px-4 py-3">
                    Bill No
                  </th>
                  <th className="px-4 py-3">
                    {statusFilter === "paid"
                      ? "Paid Time"
                      : "Time"}
                  </th>
                  <th className="px-4 py-3">
                    Type
                  </th>
                  <th className="px-4 py-3">
                    Table
                  </th>
                  <th className="px-4 py-3">
                    Customer / Players
                  </th>
                  <th className="px-4 py-3">
                    Table Bill
                  </th>
                  <th className="px-4 py-3">
                    Cafe Bill
                  </th>
                  {showAccessoriesColumn && (
                    <th className="px-4 py-3">
                      Accessories Bill
                    </th>
                  )}
                  <th className="px-4 py-3">
                    Total
                  </th>
                  {showStatusColumn && (
                    <th className="px-4 py-3">
                      Status
                    </th>
                  )}
                  {showPaymentColumn && (
                    <th className="px-4 py-3">
                      Payment Method
                    </th>
                  )}
                  <th className="px-4 py-3 text-right">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {checkoutRows.map((row) => {
                  const account =
                    row.type === "account"
                      ? row.account
                      : row.type === "pending" &&
                    row.customerId
                      ? customerAccountById.get(
                          row.customerId
                        )
                      : undefined;

                  return (
                  <tr
                    key={
          row.type === "pending"
            ? `${row.bill.id}-${row.playerName}`
            : row.type === "account"
              ? `account-${row.account.id}`
            : row.sale.id
                    }
                    className="border-t bg-white"
                  >
                    <td className="min-w-44 whitespace-nowrap px-4 py-3 font-semibold">
                      {getCheckoutRowBillLabel(
                        row,
                        account
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {formatTime(
                        row.type === "pending"
                          ? row.bill.createdAt
                          : row.type === "account"
                            ? row.account.lastActivityAt ??
                              row.account.openedAt
                          : row.sale.paidAt ??
                            row.sale.createdAt
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {getCheckoutRowTypeLabel(row)}
                    </td>
                    <td className="px-4 py-3">
                      {row.type === "pending"
                        ? row.bill.tableName
                        : row.type === "account"
                          ? getBillTableLabel(row.account) || "-"
                        : row.sale.tableName}
                    </td>
                    <td className="px-4 py-3">
                      {getCheckoutRowPlayersLabel(
                        row,
                        account
                      )}
                    </td>
                    <td className="px-4 py-3">
                      Rs.{" "}
                      {getCheckoutRowTableAmount(
                        row
                      )}
                    </td>
                    <td className="px-4 py-3">
                      Rs.{" "}
                      {getCheckoutRowCafeAmount(
                        row
                      )}
                    </td>
                    {showAccessoriesColumn && (
                      <td className="px-4 py-3">
                        Rs.{" "}
                        {getCheckoutRowAccessoryAmount(
                          row
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3 font-bold">
                      Rs.{" "}
                      {getCheckoutRowTotal(row)}
                    </td>
                    {showStatusColumn && (
                      <td className="px-4 py-3">
                        <span
                          className={
                            row.type === "pending" &&
                            row.bill.status === "cancelled"
                              ? "rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-200"
                              : row.type === "pending" ||
                                row.type === "account"
                              ? "rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200"
                              : "rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200"
                          }
                        >
                          {row.type === "pending"
                            ? row.bill.status === "cancelled"
                              ? "Cancelled"
                              : "Pending"
                            : row.type === "account"
                              ? "Pending"
                            : "Paid"}
                        </span>
                      </td>
                    )}
                    {showPaymentColumn && (
                      <td className="px-4 py-3">
                        {row.type === "pending" ||
                        row.type === "account"
                          ? "-"
                          : getSalePaymentLabel(
                              row.sale
                            )}
                      </td>
                    )}
                    <td className="px-4 py-3 text-right">
                      {row.type === "pending" ||
                      row.type === "account" ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            variant={
                              row.type === "pending" &&
                              row.bill.status === "cancelled"
                                ? "outline"
                                : "default"
                            }
                            onClick={() => {
                              if (row.type === "account") {
                                navigate(
                                  `/operator/customer-bills?customerBillId=${row.account.id}`
                                );
                                return;
                              }

                                setSelectedBill(row.bill);
                                setSelectedPlayerName(
                                  row.playerName
                                );
                            }}
                          >
                            {row.type === "pending" &&
                            row.bill.status === "cancelled"
                              ? "View Details"
                              : "Open Bill"}
                          </Button>
                          {row.type === "pending" &&
                          row.bill.status !==
                            "cancelled" && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-1 border-red-200 text-red-700 hover:bg-red-50"
                              onClick={() =>
                                handleCancelPendingBill(
                                  row.bill
                                )
                              }
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Cancel Bill
                            </Button>
                          )}
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1 border-red-200 text-red-700 hover:bg-red-50"
                          onClick={() =>
                            handleDeleteSale(row.sale)
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </Button>
                      )}
                    </td>
                  </tr>
                  );
                })}

                {checkoutRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={emptyColumnCount}
                      className="px-4 py-10 text-center text-slate-500"
                    >
                      {statusFilter === "pending"
                        ? "No pending bills found."
                        : statusFilter === "paid"
                          ? "No paid bills found today."
                          : statusFilter === "cancelled"
                            ? "No cancelled bills found."
                            : "No bills found."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {selectedBill && (
        <BillingDialog
          open={!!selectedBill}
          session={selectedBill.session}
          tableType={selectedBill.tableType}
          tableName={selectedBill.tableName}
          billNumber={
            selectedBill.staffBillNumber ??
            selectedBill.id
          }
          status={
            selectedBill.status === "cancelled"
              ? "Cancelled"
              : "Pending"
          }
          playerName={selectedPlayerName}
          paidPlayerNames={
            selectedBill.paidPlayerNames
          }
          onClose={() => {
            setSelectedBill(null);
            setSelectedPlayerName(undefined);
          }}
          onUpdateDiscount={
            handleUpdateSelectedBillDiscount
          }
          canReceivePayment={
            !!activeBusinessDay &&
            selectedBill.status !== "cancelled"
          }
          readOnly={
            selectedBill.status === "cancelled"
          }
          cancelledAt={
            selectedBill.cancelledAt
          }
          cancelledReason={
            selectedBill.cancelledReason
          }
          cancelledNote={
            selectedBill.cancelledNote
          }
          onPaymentBlocked={() =>
            setMessage(
              "Please start the day and enter the operator name before receiving payment."
            )
          }
          onReceivePayment={
            handleReceivePayment
          }
          onReceivePlayerBill={
            handleReceivePlayerBill
          }
        />
      )}

      {billToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-bold text-slate-950">
              Cancel unpaid bill?
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to cancel this unpaid bill? It will stay in history with Cancelled status.
            </p>

            <div className="mt-4 space-y-3">
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Cancellation reason
                <select
                  className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                  value={cancelReason}
                  onChange={(event) => {
                    setCancelReason(
                      event.target.value
                    );
                    setCancelError("");
                  }}
                >
                  <option value="">
                    Select reason
                  </option>
                  {cancellationReasons.map(
                    (reason) => (
                      <option
                        key={reason}
                        value={reason}
                      >
                        {reason}
                      </option>
                    )
                  )}
                </select>
              </label>

              {cancelReason === "Other" && (
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  Note
                  <textarea
                    className="min-h-24 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                    placeholder="Write the reason"
                    value={cancelNote}
                    onChange={(event) => {
                      setCancelNote(
                        event.target.value
                      );
                      setCancelError("");
                    }}
                  />
                </label>
              )}

              {cancelError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200">
                  {cancelError}
                </p>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  setBillToCancel(null)
                }
              >
                Keep Bill
              </Button>
              <Button
                className="bg-red-700 hover:bg-red-800"
                disabled={
                  !cancelReason ||
                  (cancelReason === "Other" &&
                    !cancelNote.trim())
                }
                onClick={confirmCancelPendingBill}
              >
                Cancel Bill
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default CheckoutPage;
