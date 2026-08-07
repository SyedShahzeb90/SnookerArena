import {
  ArrowLeft,
  Banknote,
  CalendarDays,
  CreditCard,
  Eye,
  ReceiptText,
  Search,
  Smartphone,
  Trash2,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/layout/page-layout";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { useBusinessDayStore } from "@/features/business-day/store/businessDayStore";
import { useCreditLedgerStore } from "@/features/credit-ledger/store/creditLedgerStore";
import { useTableHistoryStore } from "@/features/table-history/store/tableHistoryStore";
import type { TableHistoryRecord } from "@/features/table-history/types/tableHistory";
import type { CustomerAccount } from "@/features/customers/types/customerAccount";
import {
  formatDuplicateParticipantLabel,
  getHistoryChargeParticipantDisplayLabel,
  getHistoryParticipants,
  getStableParticipantDisplayLabel,
} from "@/features/customers/utils/participantDisplay";
import {
  formatAppDateTime,
  formatAppTime,
  formatChargeDuration,
  formatChargeTimeRange,
  useAppDateTimeFormats,
} from "@/lib/dateTime";
import type { PaymentMethod } from "@/types/session";
import {
  getPaymentMethodLabels,
  getPaymentMethodOptions,
  useClubSettingsStore,
} from "@/features/settings/store/clubSettingsStore";

import { useSalesStore } from "../store/salesStore";
import type { ReportRange, Sale } from "../types/sale";
import {
  calculatePaymentTotals,
  calculateSalesTotals,
  filterSalesByRange,
} from "../utils/salesReports";

type SortOrder = "newest" | "oldest";
type DateFilter = "all" | ReportRange;
type PaymentFilter = "all" | PaymentMethod | "split";
type SalesHistoryStatus =
  | "paid"
  | "pending"
  | "credit"
  | "cancelled"
  | "refunded"
  | "complimentary";
type StatusFilter = "all" | SalesHistoryStatus;
type InvoiceTypeFilter = "all" | "table" | "cafe" | "accessories" | "mixed";

const allOperatorsValue = "__all__";

function formatCurrency(value: number) {
  return `Rs. ${Math.round(value).toLocaleString()}`;
}

function isWalkInIdentifier(value?: string | null) {
  if (!value) return false;
  return (
    /walk[\s-]*in/i.test(value) ||
    /(?:^|[-\s])wi(?:[-\s]|$)/i.test(value)
  );
}

function cleanDisplayName(value?: string | null) {
  if (!value) return "";
  return isWalkInIdentifier(value) ? "Walk-in Customer" : value;
}

function getCustomerLabel(sale: Sale) {
  const preferred =
    sale.customerName ||
    sale.payerName ||
    sale.players[0]?.name ||
    sale.invoiceNumber;
  const cleanName =
    cleanDisplayName(preferred) || "Walk-in Customer";

  return getStableParticipantDisplayLabel({
    name: cleanName,
    customerId: sale.customerAccountId,
    sessionId: sale.sessionId,
    historyRecords: useTableHistoryStore.getState().records,
  });
}

function getLocationLabel(sale: Sale) {
  return sale.tableName || "Walk-in Sale";
}

function getPaymentMethods(sale: Sale) {
  if (sale.paymentSplits?.length) {
    return Array.from(
      new Set(sale.paymentSplits.map((split) => split.method))
    );
  }
  return [sale.paymentMethod];
}

function getAuditActionLabel(action: string) {
  const labels: Record<string, string> = {
    bill_created: "Bill created",
    payment_received: "Payment received",
    payment_method_corrected: "Payment method corrected",
    credit_issued: "Credit issued",
    credit_recovered: "Credit recovered",
    cancelled: "Cancelled",
    settled_by_advance: "Settled by advance games",
  };

  return labels[action] ?? action.replace(/_/g, " ");
}

function getCompactPaymentLabel(
  sale: Sale,
  paymentLabels: Record<PaymentMethod, string>
) {
  if (getSaleStatus(sale) === "cancelled") return "No payment";

  const methods = getPaymentMethods(sale);
  if (methods.length > 2) return "Split";
  return methods.map((method) => paymentLabels[method]).join(" + ");
}

function getFullPaymentLabel(
  sale: Sale,
  paymentLabels: Record<PaymentMethod, string>
) {
  if (getSaleStatus(sale) === "cancelled") {
    return "No payment - cancelled";
  }

  if (!sale.paymentSplits?.length) {
    return `${paymentLabels[sale.paymentMethod]} · ${formatCurrency(
      sale.grandTotal
    )}`;
  }
  return sale.paymentSplits
    .map(
      (split) =>
        `${paymentLabels[split.method]} · ${formatCurrency(split.amount)}`
    )
    .join(" + ");
}

function getOperatorLabel(sale: Sale) {
  return (
    sale.paymentReceivedBy?.operatorName ??
    sale.operatorAudit?.find((event) => event.action === "payment_received")
      ?.operator.operatorName ??
    "Not recorded"
  );
}

function getSaleTimestamp(sale: Sale) {
  return sale.paidAt || sale.createdAt;
}

function getSaleTypeLabel(sale: Sale) {
  if (sale.saleType === "cafe-only" || sale.saleType === "cafe_only") {
    return "Cafe Only";
  }
  if (sale.saleType === "customer_bill") return "Customer Bill";
  if (sale.saleType === "accessories") return "Accessories";
  if (sale.sessionType === "private") return "Private Room";
  if (sale.sessionType === "time") return "Table Booking";
  if (sale.sessionType === "double") return "Double Game";
  return "Single Game";
}

function getInvoiceType(sale: Sale): Exclude<InvoiceTypeFilter, "all"> {
  if (sale.saleType === "table") return "table";

  const hasTable = sale.tableAmount > 0;
  const hasCafe = getCanteenAmount(sale) > 0;
  const hasAccessories = getAccessoryAmount(sale) > 0;
  const sectionCount = [hasTable, hasCafe, hasAccessories].filter(Boolean).length;

  if (sectionCount > 1) return "mixed";
  if (hasAccessories || sale.saleType === "accessories") return "accessories";
  if (
    hasCafe ||
    sale.saleType === "cafe-only" ||
    sale.saleType === "cafe_only"
  ) {
    return "cafe";
  }
  return "table";
}

function getInvoiceTypeLabel(sale: Sale) {
  const labels: Record<Exclude<InvoiceTypeFilter, "all">, string> = {
    table: "🎱 Table",
    cafe: "☕ Cafe",
    accessories: "🛍 Accessories",
    mixed: "🔀 Mixed",
  };
  return labels[getInvoiceType(sale)];
}

function getAccessoryAmount(sale: Sale) {
  const amount = sale.orderedItems
    .filter((item) => item.name.startsWith("[Accessory]"))
    .reduce((total, item) => total + item.subtotal, 0);
  if (sale.saleType === "accessories") {
    return amount || sale.grandTotal;
  }
  return amount;
}

function getCanteenAmount(sale: Sale) {
  return sale.saleType === "accessories" ? 0 : sale.cafeAmount;
}

function getSessionDurationLabel(sale: Sale) {
  if (sale.tableAmount <= 0) return "-";
  if (sale.startedAt && sale.endedAt) {
    return formatChargeDuration(sale.startedAt, sale.endedAt);
  }
  return `${sale.durationMinutes ?? 0} min`;
}

function getPaymentBadgeClass(method: PaymentMethod | "split") {
  if (method === "cash") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300";
  }
  if (method === "card") {
    return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300";
  }
  if (method === "easypaisa") {
    return "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-300";
  }
  if (method === "jazzcash") {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300";
  }
  return "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300";
}

function getPaymentMethodIcon(method: PaymentMethod) {
  if (method === "cash") return "💵";
  if (method === "card") return "💳";
  return "📱";
}

function getPaymentBadgeMethod(sale: Sale): PaymentMethod | "split" {
  return sale.paymentSplits?.length ? "split" : sale.paymentMethod;
}

function getPaymentBadgeLabel(
  sale: Sale,
  paymentLabels: Record<PaymentMethod, string>
) {
  if (getSaleStatus(sale) === "cancelled") {
    return "No payment";
  }

  if (!sale.paymentSplits?.length) {
    return `${getPaymentMethodIcon(sale.paymentMethod)} ${
      paymentLabels[sale.paymentMethod]
    }`;
  }

  return sale.paymentSplits
    .map((split) => `${getPaymentMethodIcon(split.method)} ${paymentLabels[split.method]}`)
    .join(" + ");
}

function getSaleStatus(sale: Sale): SalesHistoryStatus {
  return (sale.paymentStatus as SalesHistoryStatus) ?? "paid";
}

function createCancelledSaleFromHistory(record: TableHistoryRecord): Sale {
  const invoiceNumber =
    record.invoiceNumber ??
    record.staffBillNumber ??
    record.billNo ??
    `CANCEL-${record.sessionId}`;

  return {
    id: `CANCELLED-HISTORY-${record.id}`,
    invoiceNumber,
    staffBillNumber: record.staffBillNumber,
    tableId: record.tableId,
    tableName: record.tableName,
    saleType: "table",
    sessionId: record.sessionId,
    players: record.players.map((name) => ({ name })),
    sessionType: record.sessionType,
    winnerName: record.winnerName,
    loserName: record.loserName,
    payerName: record.payerName,
    teamAPlayers: record.teamAPlayers,
    teamBPlayers: record.teamBPlayers,
    teamAOneNameEnough: record.teamAOneNameEnough,
    teamBOneNameEnough: record.teamBOneNameEnough,
    extraPlayers: record.extraPlayers,
    winningTeam: record.winningTeam,
    losingTeam: record.losingTeam,
    payerBreakdown: record.payerBreakdown,
    startedAt: record.startedAt,
    endedAt: record.endedAt,
    durationMinutes: record.durationMinutes,
    createdAt: record.cancelledAt ?? record.updatedAt ?? record.createdAt,
    tableAmount: 0,
    cafeAmount: 0,
    subtotal: 0,
    discount: 0,
    grandTotal: 0,
    originalTableAmount: record.originalTableAmount ?? record.tableAmount,
    originalGameCount: record.originalGameCount,
    advanceGamesApplied: record.advanceGamesApplied,
    advanceReduction: record.advanceReduction,
    settlementLabel: record.cancelledReason
      ? `Cancelled: ${record.cancelledReason}`
      : "Cancelled",
    paymentMethod: "cash",
    paymentStatus: "cancelled",
    orderedItems: record.cafeItems,
    playerBreakdown: record.playerBreakdown,
    customerName: record.player1Name,
    tableChargeLines: record.tableChargeLines,
    operatorAudit: record.cancelledAt
      ? [
          {
            id: `AUDIT-${record.id}-cancelled`,
            action: "cancelled",
            occurredAt: record.cancelledAt,
            note: [record.cancelledReason, record.cancelledNote]
              .filter(Boolean)
              .join(": "),
            operator: {
              operatorId: "unknown",
              operatorName: "Not recorded",
            },
          },
        ]
      : undefined,
  };
}

function getStatusBadgeClass(status: SalesHistoryStatus) {
  if (status === "paid") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300";
  }
  if (status === "pending") {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300";
  }
  if (status === "credit") {
    return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300";
  }
  if (status === "cancelled" || status === "refunded") {
    return "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300";
  }
  return "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300";
}

function getVisiblePlayers(sale: Sale) {
  const historyRecord = useTableHistoryStore
    .getState()
    .records.find((record) => record.sessionId === sale.sessionId);

  if (historyRecord) {
    const participants = getHistoryParticipants(historyRecord);
    if (participants.length) {
      return participants.map((participant) =>
        formatDuplicateParticipantLabel(participant, participants)
      );
    }
  }

  return Array.from(
    new Set(
      [
        ...sale.players.map((player) => player.name),
        ...(sale.teamAPlayers ?? []),
        ...(sale.teamBPlayers ?? []),
        ...(sale.extraPlayers ?? []),
      ]
        .map(cleanDisplayName)
        .filter(Boolean)
    )
  );
}

function getSettlementParticipantLabel(
  sale: Sale,
  role: "winner" | "loser" | "payer"
) {
  const historyRecords = useTableHistoryStore.getState().records;
  const historyRecord = historyRecords.find(
    (record) => record.sessionId === sale.sessionId
  );
  const name =
    role === "winner"
      ? sale.winnerName
      : role === "loser"
        ? sale.loserName
        : sale.payerName;
  const customerId =
    role === "winner"
      ? historyRecord?.winnerCustomerId
      : role === "loser"
        ? historyRecord?.loserCustomerId
        : historyRecord?.payerCustomerId;
  const cleanName = cleanDisplayName(name);

  if (!cleanName) return "—";

  return getStableParticipantDisplayLabel({
    name: cleanName,
    customerId,
    sessionId: sale.sessionId,
    historyRecords,
  });
}

function MetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <Card className="min-h-24 p-4">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-1 whitespace-nowrap text-xl font-bold text-slate-950 dark:text-slate-50">
        {value}
      </p>
      {helper && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {helper}
        </p>
      )}
    </Card>
  );
}

function SalesHistoryPage() {
  const clubSettings = useClubSettingsStore((state) => state.settings);
  const paymentLabels = useMemo(
    () => getPaymentMethodLabels(clubSettings),
    [clubSettings]
  );
  const paymentMethodOptions = useMemo(
    () => getPaymentMethodOptions(clubSettings),
    [clubSettings]
  );
  useAppDateTimeFormats();
  const navigate = useNavigate();
  const sales = useSalesStore((state) => state.sales);
  const deleteSale = useSalesStore((state) => state.deleteSale);
  const tableHistoryRecords = useTableHistoryStore((state) => state.records);
  const addCreditFromCustomerBill = useCreditLedgerStore(
    (state) => state.addCreditFromCustomerBill
  );
  const businessDays = useBusinessDayStore((state) => state.days);

  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [paymentFilter, setPaymentFilter] =
    useState<PaymentFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [operatorFilter, setOperatorFilter] = useState(allOperatorsValue);
  const [invoiceTypeFilter, setInvoiceTypeFilter] =
    useState<InvoiceTypeFilter>("all");
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  const businessDayById = useMemo(
    () => new Map(businessDays.map((day) => [day.id, day])),
    [businessDays]
  );

  const salesHistoryRows = useMemo(() => {
    const saleSessionIds = new Set(sales.map((sale) => sale.sessionId));
    const cancelledHistoryRows = tableHistoryRecords
      .filter(
        (record) =>
          record.paymentStatus === "cancelled" &&
          !saleSessionIds.has(record.sessionId)
      )
      .map(createCancelledSaleFromHistory);

    return [...sales, ...cancelledHistoryRows];
  }, [sales, tableHistoryRecords]);

  const getBusinessDayLabel = useCallback(
    (businessDayId?: string) => {
      const day = businessDayId
        ? businessDayById.get(businessDayId)
        : undefined;
      return day ? `${day.dayName} · ${day.openedBy}` : "No Business Day";
    },
    [businessDayById]
  );

  const operatorOptions = useMemo(
    () =>
      Array.from(new Set(salesHistoryRows.map(getOperatorLabel))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [salesHistoryRows]
  );

  const dateFilteredSales = useMemo(() => {
    if (dateFilter === "all") return salesHistoryRows;
    if (dateFilter !== "custom") {
      return filterSalesByRange(salesHistoryRows, dateFilter);
    }
    if (!customStart || !customEnd) return salesHistoryRows;
    return filterSalesByRange(
      salesHistoryRows,
      "custom",
      new Date(`${customStart}T00:00:00`),
      new Date(`${customEnd}T23:59:59.999`)
    );
  }, [salesHistoryRows, dateFilter, customStart, customEnd]);

  const filteredSales = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return dateFilteredSales
      .filter((sale) => {
        if (statusFilter !== "all" && sale.paymentStatus !== statusFilter) {
          return false;
        }
        if (paymentFilter === "split" && !sale.paymentSplits?.length) {
          return false;
        }
        if (
          paymentFilter !== "all" &&
          paymentFilter !== "split" &&
          !getPaymentMethods(sale).includes(paymentFilter)
        ) {
          return false;
        }
        if (
          operatorFilter !== allOperatorsValue &&
          getOperatorLabel(sale) !== operatorFilter
        ) {
          return false;
        }
        if (
          invoiceTypeFilter !== "all" &&
          getInvoiceType(sale) !== invoiceTypeFilter
        ) {
          return false;
        }
        if (!query) return true;

        const searchValues = [
          sale.invoiceNumber,
          sale.staffBillNumber,
          sale.tableName,
          sale.customerName,
          sale.customerNote,
          sale.customerToken,
          sale.payerName,
          sale.winnerName,
          sale.loserName,
          sale.settlementLabel,
          getSaleTypeLabel(sale),
          getInvoiceTypeLabel(sale),
          getCompactPaymentLabel(sale, paymentLabels),
          getOperatorLabel(sale),
          getBusinessDayLabel(sale.activeBusinessDayId),
          ...sale.players.map((player) => player.name),
          ...(sale.teamAPlayers ?? []),
          ...(sale.teamBPlayers ?? []),
          ...(sale.extraPlayers ?? []),
          ...sale.orderedItems.map((item) => item.name),
        ];
        return searchValues.some((value) =>
          (value ?? "").toLocaleLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        const first = new Date(getSaleTimestamp(a)).getTime();
        const second = new Date(getSaleTimestamp(b)).getTime();
        return sortOrder === "newest" ? second - first : first - second;
      });
  }, [
    dateFilteredSales,
    search,
    sortOrder,
    paymentFilter,
    statusFilter,
    operatorFilter,
    invoiceTypeFilter,
    getBusinessDayLabel,
    paymentLabels,
  ]);

  const filteredTotals = useMemo(
    () => calculateSalesTotals(filteredSales),
    [filteredSales]
  );
  const paymentTotals = useMemo(
    () => calculatePaymentTotals(filteredSales),
    [filteredSales]
  );
  const hasActiveFilters =
    Boolean(search) ||
    dateFilter !== "all" ||
    paymentFilter !== "all" ||
    statusFilter !== "all" ||
    operatorFilter !== allOperatorsValue ||
    invoiceTypeFilter !== "all";

  const clearFilters = () => {
    setSearch("");
    setDateFilter("all");
    setCustomStart("");
    setCustomEnd("");
    setPaymentFilter("all");
    setStatusFilter("all");
    setOperatorFilter(allOperatorsValue);
    setInvoiceTypeFilter("all");
  };

  const handleDeleteSale = (sale: Sale) => {
    const confirmed = window.confirm(
      `Delete sale ${sale.invoiceNumber}? This is for removing mistaken test bills.`
    );
    if (!confirmed) return;
    deleteSale(sale.id);
    if (selectedSale?.id === sale.id) setSelectedSale(null);
  };

  const handleMoveSaleToCredit = (sale: Sale) => {
    const confirmed = window.confirm(
      `Move ${sale.invoiceNumber} for ${getCustomerLabel(sale)} (${formatCurrency(sale.grandTotal)}) to Credit Ledger? This removes it from paid sales.`
    );
    if (!confirmed) return;

    const now = new Date().toISOString();
    const creditAccount: CustomerAccount = {
      id: sale.customerAccountId ?? `SALE-CREDIT-${sale.id}`,
      customerToken: sale.customerToken ?? sale.invoiceNumber,
      staffBillNumber: sale.staffBillNumber,
      customerName: getCustomerLabel(sale),
      customerNote: sale.customerNote,
      status: "active",
      openedAt: sale.startedAt ?? sale.createdAt,
      createdAt: sale.createdAt,
      updatedAt: now,
      gameCharges: sale.gameCharges ?? [],
      cafeCharges: sale.cafeCharges ?? [],
      accessoryCharges: [],
      totalGameAmount: sale.tableAmount,
      totalCafeAmount: getCanteenAmount(sale),
      totalAccessoryAmount: getAccessoryAmount(sale),
      discount: sale.discount,
      grandTotal: sale.grandTotal,
      paymentStatus: "unpaid",
      activeBusinessDayId: sale.activeBusinessDayId,
      lastTableName: sale.tableName,
      lastActivityAt: sale.endedAt ?? sale.createdAt,
    };

    const entry = addCreditFromCustomerBill({
      account: creditAccount,
      originalBillNumber: sale.staffBillNumber ?? sale.invoiceNumber,
      tableName: sale.tableName,
      tableTotal: sale.tableAmount,
      cafeTotal: getCanteenAmount(sale),
      accessoryTotal: getAccessoryAmount(sale),
      discount: sale.discount,
      finalAmount: sale.grandTotal,
      creditNote: `Moved from paid sale ${sale.invoiceNumber}`,
      businessDayId: sale.activeBusinessDayId,
    });

    if (!entry) {
      window.alert("This sale is already in the Credit Ledger.");
      return;
    }

    deleteSale(sale.id);
    if (selectedSale?.id === sale.id) setSelectedSale(null);
  };

  return (
    <PageShell width="wide" contentClassName="space-y-0">
      <div>
        <Button
          variant="ghost"
          className="mb-3 gap-2"
          onClick={() => navigate("/admin")}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Admin Dashboard
        </Button>

        <div className="mb-5">
          <h1 className="text-2xl font-bold text-slate-950 dark:text-slate-50">
            Sales History
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Review completed POS transactions and payment records.
          </p>
        </div>

        <section className="mb-5">
          <p className="mb-2 text-xs font-semibold uppercase text-slate-500">
            Summary in current view
          </p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
            <MetricCard
              label="Invoices"
              value={filteredTotals.salesCount.toLocaleString()}
            />
            <MetricCard
              label="Total Revenue"
              value={formatCurrency(filteredTotals.revenue)}
            />
            <MetricCard
              label={paymentLabels.cash}
              value={formatCurrency(paymentTotals.cash)}
            />
            <MetricCard
              label={paymentLabels.easypaisa}
              value={formatCurrency(paymentTotals.easypaisa)}
            />
            <MetricCard
              label={paymentLabels.jazzcash}
              value={formatCurrency(paymentTotals.jazzcash)}
            />
            <MetricCard
              label={paymentLabels.card}
              value={formatCurrency(paymentTotals.card)}
            />
          </div>
        </section>

        <Card className="overflow-hidden">
          <div className="space-y-3 border-b p-4">
            <div className="flex items-center gap-3">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <Input
                placeholder="Search invoice #, customer, operator, table or item..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-wrap rounded-lg border bg-white p-1 dark:bg-slate-900">
                {(
                  [
                    ["all", "All"],
                    ["today", "Today"],
                    ["yesterday", "Yesterday"],
                    ["this-week", "This Week"],
                    ["this-month", "This Month"],
                    ["custom", "Custom"],
                  ] as const
                ).map(([value, label]) => (
                  <Button
                    key={value}
                    size="sm"
                    variant={dateFilter === value ? "default" : "ghost"}
                    onClick={() => setDateFilter(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>

              {dateFilter === "custom" && (
                <>
                  <Input
                    type="date"
                    aria-label="Start date"
                    className="w-auto"
                    value={customStart}
                    onChange={(event) => setCustomStart(event.target.value)}
                  />
                  <Input
                    type="date"
                    aria-label="End date"
                    className="w-auto"
                    value={customEnd}
                    onChange={(event) => setCustomEnd(event.target.value)}
                  />
                </>
              )}

              <label className="grid gap-1 text-xs font-medium text-slate-500">
                Payment
                <select
                  className="h-9 rounded-md border bg-background px-3 text-sm text-foreground"
                  value={paymentFilter}
                  onChange={(event) =>
                    setPaymentFilter(event.target.value as PaymentFilter)
                  }
                >
                  <option value="all">All Payments</option>
                  {paymentMethodOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                  <option value="split">Split</option>
                </select>
              </label>

              <label className="grid gap-1 text-xs font-medium text-slate-500">
                Status
                <select
                  className="h-9 rounded-md border bg-background px-3 text-sm text-foreground"
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as StatusFilter)
                  }
                >
                  <option value="all">All Statuses</option>
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                  <option value="credit">Credit</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="refunded">Refunded</option>
                  <option value="complimentary">Complimentary</option>
                </select>
              </label>

              <label className="grid gap-1 text-xs font-medium text-slate-500">
                Operator
                <select
                  className="h-9 rounded-md border bg-background px-3 text-sm text-foreground"
                  value={operatorFilter}
                  onChange={(event) => setOperatorFilter(event.target.value)}
                >
                  <option value={allOperatorsValue}>All Operators</option>
                  {operatorOptions.map((operator) => (
                    <option key={operator} value={operator}>
                      {operator}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-xs font-medium text-slate-500">
                Invoice Type
                <select
                  className="h-9 rounded-md border bg-background px-3 text-sm text-foreground"
                  value={invoiceTypeFilter}
                  onChange={(event) =>
                    setInvoiceTypeFilter(event.target.value as InvoiceTypeFilter)
                  }
                >
                  <option value="all">All Types</option>
                  <option value="table">Table</option>
                  <option value="cafe">Cafe</option>
                  <option value="accessories">Accessories</option>
                  <option value="mixed">Mixed</option>
                </select>
              </label>

              <div className="flex rounded-lg border bg-white p-1 dark:bg-slate-900">
                <Button
                  size="sm"
                  variant={sortOrder === "newest" ? "default" : "ghost"}
                  onClick={() => setSortOrder("newest")}
                >
                  Newest
                </Button>
                <Button
                  size="sm"
                  variant={sortOrder === "oldest" ? "default" : "ghost"}
                  onClick={() => setSortOrder("oldest")}
                >
                  Oldest
                </Button>
              </div>

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear Filters
                </Button>
              )}
            </div>
          </div>

          <div className="border-b bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600 dark:bg-slate-900 dark:text-slate-300">
            Showing {filteredSales.length.toLocaleString()}
            {filteredSales.length === salesHistoryRows.length
              ? ""
              : ` of ${salesHistoryRows.length.toLocaleString()}`}{" "}
            invoices
          </div>

          {filteredSales.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] table-fixed text-left text-sm">
                <colgroup>
                  <col className="w-[8%]" />
                  <col className="w-[14%]" />
                  <col className="w-[16%]" />
                  <col className="w-[13%]" />
                  <col className="w-[10%]" />
                  <col className="w-[10%]" />
                  <col className="w-[12%]" />
                  <col className="w-[8%]" />
                  <col className="w-[9%]" />
                </colgroup>
                <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-3">Time</th>
                    <th className="px-3 py-3">Table / Room</th>
                    <th className="px-3 py-3">Customer</th>
                    <th className="px-3 py-3">Operator</th>
                    <th className="px-3 py-3">Type</th>
                    <th className="px-3 py-3 text-right">Total</th>
                    <th className="px-3 py-3">Payment</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.map((sale) => {
                    const timestamp = getSaleTimestamp(sale);
                    const customer = getCustomerLabel(sale);
                    return (
                      <tr
                        key={sale.id}
                        tabIndex={0}
                        className="cursor-pointer border-t bg-white transition-colors hover:bg-slate-50 focus:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-400 dark:bg-slate-950 dark:hover:bg-slate-900 dark:focus:bg-slate-900"
                        onClick={() => setSelectedSale(sale)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedSale(sale);
                          }
                        }}
                      >
                        <td
                          className="whitespace-nowrap px-3 py-3"
                          title={formatAppDateTime(timestamp)}
                        >
                          {formatAppTime(timestamp)}
                        </td>
                        <td
                          className="truncate px-3 py-3 font-bold text-slate-950 dark:text-slate-100"
                          title={getLocationLabel(sale)}
                        >
                          {getLocationLabel(sale)}
                        </td>
                        <td className="px-3 py-3">
                          <div className="truncate font-semibold" title={customer}>
                            {customer}
                          </div>
                          {getVisiblePlayers(sale).length > 1 && (
                            <div
                              className="truncate text-xs text-slate-500"
                              title={getVisiblePlayers(sale).join(", ")}
                            >
                              {getVisiblePlayers(sale).join(", ")}
                            </div>
                          )}
                        </td>
                        <td
                          className="truncate px-3 py-3"
                          title={getOperatorLabel(sale)}
                        >
                          {getOperatorLabel(sale)}
                        </td>
                        <td className="px-3 py-3">
                          <Badge variant="outline">
                            {getInvoiceTypeLabel(sale)}
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right font-bold">
                          {formatCurrency(sale.grandTotal)}
                        </td>
                        <td
                          className="truncate px-3 py-3"
                          title={getFullPaymentLabel(sale, paymentLabels)}
                        >
                          <Badge className={getSaleStatus(sale) === "cancelled" ? getStatusBadgeClass("cancelled") : getPaymentBadgeClass(getPaymentBadgeMethod(sale))}>
                            {getPaymentBadgeLabel(sale, paymentLabels)}
                          </Badge>
                        </td>
                        <td className="px-3 py-3">
                          <Badge className={getStatusBadgeClass(getSaleStatus(sale))}>
                            {getSaleStatus(sale)}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <Button
                            type="button"
                            size="sm"
                            className="gap-1"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedSale(sale);
                            }}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View Details
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4">
              <EmptyState
                icon={ReceiptText}
                title={
                  salesHistoryRows.length === 0
                    ? "No Sales History Yet"
                    : "No Matching Transactions"
                }
                description={
                  salesHistoryRows.length === 0
                    ? "Completed transactions will appear here after payments are received."
                    : "No transactions match the selected search and filters."
                }
                actionLabel={salesHistoryRows.length > 0 ? "Clear Filters" : undefined}
                onAction={salesHistoryRows.length > 0 ? clearFilters : undefined}
                compact
              />
            </div>
          )}
        </Card>
      </div>

      <Dialog
        open={Boolean(selectedSale)}
        onOpenChange={(open) => {
          if (!open) setSelectedSale(null);
        }}
      >
        {selectedSale && (
          <DialogContent className="max-h-[88vh] overflow-hidden sm:max-w-4xl">
            <DialogHeader className="pr-10">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle className="text-lg">
                  Transaction {selectedSale.invoiceNumber}
                </DialogTitle>
                <Badge className={getStatusBadgeClass(getSaleStatus(selectedSale))}>
                  {getSaleStatus(selectedSale)}
                </Badge>
              </div>
              <DialogDescription>
                {formatAppDateTime(getSaleTimestamp(selectedSale))} ·{" "}
                {getLocationLabel(selectedSale)}
              </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
              <section className="grid gap-3 rounded-lg border bg-slate-50 p-4 dark:bg-slate-900 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs uppercase text-slate-500">Invoice Number</p>
                  <p className="mt-1 font-semibold">
                    {selectedSale.invoiceNumber}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500">Created At</p>
                  <p className="mt-1 font-semibold">
                    {formatAppDateTime(selectedSale.createdAt)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500">Customer</p>
                  <p className="mt-1 font-semibold">
                    {getCustomerLabel(selectedSale)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500">Table</p>
                  <p className="mt-1 font-semibold">
                    {getLocationLabel(selectedSale)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500">Type</p>
                  <p className="mt-1 font-semibold">
                    {getInvoiceTypeLabel(selectedSale)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500">Business Day</p>
                  <p className="mt-1 font-semibold">
                    {getBusinessDayLabel(selectedSale.activeBusinessDayId)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500">
                    Operator
                  </p>
                  <p className="mt-1 font-semibold">
                    {getOperatorLabel(selectedSale)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500">Started</p>
                  <p className="mt-1 font-semibold">
                    {selectedSale.startedAt
                      ? formatAppDateTime(selectedSale.startedAt)
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500">Ended</p>
                  <p className="mt-1 font-semibold">
                    {selectedSale.endedAt
                      ? formatAppDateTime(selectedSale.endedAt)
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500">Duration</p>
                  <p className="mt-1 font-semibold">
                    {getSessionDurationLabel(selectedSale)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500">Payment</p>
                  <p className="mt-1 font-semibold">
                    {getFullPaymentLabel(selectedSale, paymentLabels)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500">Status</p>
                  <p className="mt-1 font-semibold capitalize">
                    {selectedSale.paymentStatus}
                  </p>
                </div>
              </section>

              <section>
                <h3 className="mb-2 font-semibold">Operator activity</h3>
                {selectedSale.operatorAudit?.length ? (
                  <div className="divide-y overflow-hidden rounded-lg border">
                    {[...selectedSale.operatorAudit]
                      .sort(
                        (a, b) =>
                          new Date(a.occurredAt).getTime() -
                          new Date(b.occurredAt).getTime(),
                      )
                      .map((event) => (
                        <div
                          key={event.id}
                          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2 text-sm"
                        >
                          <div>
                            <span className="font-medium">
                              {getAuditActionLabel(event.action)}
                            </span>
                            <span className="text-slate-500"> by </span>
                            <span>{event.operator.operatorName}</span>
                            {event.note ? (
                              <p className="mt-0.5 text-xs text-slate-500">
                                {event.note}
                              </p>
                            ) : null}
                          </div>
                          <span className="text-xs text-slate-500">
                            {formatAppDateTime(event.occurredAt)}
                          </span>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed px-3 py-2 text-sm text-slate-500">
                    Operator activity was not recorded for this legacy transaction.
                  </p>
                )}
              </section>

              {getVisiblePlayers(selectedSale).length > 0 && (
                <section>
                  <h3 className="mb-2 font-semibold">Players and settlement</h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg border p-3">
                      <p className="text-xs uppercase text-slate-500">Players</p>
                      <p className="mt-1 font-medium">
                        {getVisiblePlayers(selectedSale).join(", ")}
                      </p>
                    </div>
                    <div className="rounded-lg border p-3 text-sm">
                      <p>
                        <span className="text-slate-500">Winner:</span>{" "}
                        {getSettlementParticipantLabel(selectedSale, "winner")}
                      </p>
                      <p>
                        <span className="text-slate-500">Loser:</span>{" "}
                        {getSettlementParticipantLabel(selectedSale, "loser")}
                      </p>
                      <p>
                        <span className="text-slate-500">Payer:</span>{" "}
                        {getSettlementParticipantLabel(selectedSale, "payer")}
                      </p>
                    </div>
                  </div>
                </section>
              )}

              {selectedSale.tableChargeLines?.length ? (
                <section>
                  <h3 className="mb-2 font-semibold">Games and table charges</h3>
                  <div className="space-y-2">
                    {[...selectedSale.tableChargeLines]
                      .sort(
                        (a, b) =>
                          new Date(a.startedAt).getTime() -
                          new Date(b.startedAt).getTime()
                      )
                      .map((line, index) => (
                        <div
                          key={line.id}
                          className="flex items-start justify-between gap-3 rounded-lg border p-3"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold">
                              {line.type === "tableBooking"
                                ? "Time Charge"
                                : `Game ${index + 1} · ${
                                    line.type === "doubleGame"
                                      ? "Double Game"
                                      : "Single Game"
                                  }`}
                              {line.isFinal && ` · Final ${line.finalGames ?? 1}`}
                            </p>
                            <p className="text-xs text-slate-500">
                              {formatChargeTimeRange(
                                line.startedAt,
                                line.endedAt
                              )}{" "}
                              ·{" "}
                              {line.endedAt
                                ? formatChargeDuration(
                                    line.startedAt,
                                    line.endedAt
                                  )
                                : line.durationMinutes !== undefined
                                  ? `${line.durationMinutes} min`
                                  : "—"}
                            </p>
                            {(line.winnerName || line.loserName) && (
                              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                                Winner:{" "}
                                {getHistoryChargeParticipantDisplayLabel({
                                  name: cleanDisplayName(line.winnerName),
                                  role: "winner",
                                  chargeId: line.id,
                                  sessionId: line.sessionId,
                                  historyRecords: useTableHistoryStore.getState().records,
                                }) || "—"} ·
                                Loser: {getHistoryChargeParticipantDisplayLabel({
                                  name: cleanDisplayName(line.loserName),
                                  role: "loser",
                                  chargeId: line.id,
                                  sessionId: line.sessionId,
                                  historyRecords: useTableHistoryStore.getState().records,
                                }) || "—"}
                              </p>
                            )}
                          </div>
                          <span className="shrink-0 font-bold">
                            {formatCurrency(line.amount)}
                          </span>
                        </div>
                      ))}
                  </div>
                </section>
              ) : null}

              {selectedSale.orderedItems.length > 0 && (
                <section>
                  <h3 className="mb-2 font-semibold">
                    Cafe and accessories
                  </h3>
                  <div className="divide-y rounded-lg border">
                    {selectedSale.orderedItems.map((item, index) => (
                      <div
                        key={item.lineId || `${item.menuItemId}-${index}`}
                        className="flex items-center justify-between gap-3 px-3 py-2"
                      >
                        <div>
                          <p className="font-medium">
                            {item.name.replace(/^\[Accessory\]\s*/, "")}
                          </p>
                          <p className="text-xs text-slate-500">
                            {item.quantity} × {formatCurrency(item.price)}
                          </p>
                        </div>
                        <span className="whitespace-nowrap font-semibold">
                          {formatCurrency(item.subtotal)}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className="rounded-lg border p-4">
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <div className="flex justify-between gap-3">
                    <span>Table charges</span>
                    <strong>{formatCurrency(selectedSale.tableAmount)}</strong>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>Cafe</span>
                    <strong>{formatCurrency(getCanteenAmount(selectedSale))}</strong>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>Accessories</span>
                    <strong>{formatCurrency(getAccessoryAmount(selectedSale))}</strong>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>Discount</span>
                    <strong>{formatCurrency(selectedSale.discount)}</strong>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>Taxes</span>
                    <strong>{formatCurrency(0)}</strong>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>Advance games applied</span>
                    <strong>{selectedSale.advanceGamesApplied ?? 0}</strong>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>Advance reduction</span>
                    <strong>
                      {formatCurrency(selectedSale.advanceReduction ?? 0)}
                    </strong>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>Amount received</span>
                    <strong>{formatCurrency(selectedSale.grandTotal)}</strong>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>Change returned</span>
                    <strong>{formatCurrency(0)}</strong>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t pt-3 text-lg">
                  <span className="font-semibold">Grand Total</span>
                  <strong>{formatCurrency(selectedSale.grandTotal)}</strong>
                </div>
              </section>

              {selectedSale.customerNote && (
                <section className="rounded-lg border p-3">
                  <p className="text-xs uppercase text-slate-500">Note</p>
                  <p className="mt-1">{selectedSale.customerNote}</p>
                </section>
              )}
            </div>

            <DialogFooter className="items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => window.print()}
                >
                  <ReceiptText className="h-4 w-4" />
                  Print Invoice
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2 border-amber-200 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                  onClick={() => handleMoveSaleToCredit(selectedSale)}
                >
                  <CreditCard className="h-4 w-4" />
                  Move to Credit
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2 border-red-200 text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                  onClick={() => handleDeleteSale(selectedSale)}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Transaction
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {formatAppDateTime(getSaleTimestamp(selectedSale))}
                </span>
                <span className="inline-flex items-center gap-1">
                  {getPaymentMethods(selectedSale).includes("cash") ? (
                    <Banknote className="h-3.5 w-3.5" />
                  ) : getPaymentMethods(selectedSale).includes("card") ? (
                    <CreditCard className="h-3.5 w-3.5" />
                  ) : (
                    <Smartphone className="h-3.5 w-3.5" />
                  )}
                  {getCompactPaymentLabel(selectedSale, paymentLabels)}
                </span>
              </div>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </PageShell>
  );
}

export default SalesHistoryPage;
