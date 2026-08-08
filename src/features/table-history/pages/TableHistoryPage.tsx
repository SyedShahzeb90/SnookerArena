import {
  ArrowLeft,
  Eye,
  History,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/layout/page-layout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTableStore } from "@/store/tableStore";
import { useBusinessDayStore } from "@/features/business-day/store/businessDayStore";
import { paymentMethodLabels } from "@/features/business-day/types/businessDay";
import { useCheckoutStore } from "@/features/billing/store/checkoutStore";
import { useSalesStore } from "@/features/sales/store/salesStore";

import { useTableHistoryStore } from "../store/tableHistoryStore";
import type { TableHistoryRecord } from "../types/tableHistory";
import type { TableChargeLine } from "@/types/session";
import {
  compareChargeTimestamps,
  formatAppDate,
  formatAppDateTime,
  formatAppTime,
  formatChargeDuration,
  formatChargeTimeRange,
  useAppDateTimeFormats,
} from "@/lib/dateTime";
import { getBusinessDayWindow } from "@/features/business-day/utils/businessDayWindow";

type DateFilter =
  | "today"
  | "yesterday"
  | "this-week"
  | "this-month"
  | "custom";

type HistoryDisplayRow = {
  record: TableHistoryRecord;
  rowId: string;
  typeLabel: string;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
  tableAmount: number;
};

type DaySheetTable = {
  tableId: number;
  tableName: string;
  sessions: TableHistoryRecord[];
  validSessions: TableHistoryRecord[];
  revenue: number;
  firstStartedAt?: string;
  lastEndedAt?: string;
};

function formatCurrency(amount: number) {
  return `Rs. ${Math.round(amount).toLocaleString()}`;
}

function formatDateTime(value: string) {
  return formatAppDateTime(value);
}

function formatDate(value: string) {
  return formatAppDate(value);
}

function getDateFilterLabel(filter: DateFilter) {
  if (filter === "today") return "Today";
  if (filter === "yesterday") return "Yesterday";
  if (filter === "this-week") return "This Week";
  if (filter === "this-month") return "This Month";
  return "Custom Range";
}

function formatTime(value: string) {
  return formatAppTime(value);
}

function getRecordTypeLabel(record: TableHistoryRecord) {
  if (record.tableType === "private-room") {
    return "Private Room";
  }

  if (record.sessionType === "single") {
    return "Single Game";
  }

  if (record.sessionType === "double") {
    return "Double Game";
  }

  if (record.sessionType === "time") {
    return "Table Booking";
  }

  return "Private Room";
}

function getChargeLineTypeLabel(
  line?: TableChargeLine,
  fallback?: TableHistoryRecord
) {
  if (!line) {
    return fallback
      ? getRecordTypeLabel(fallback)
      : "Session";
  }

  if (line.type === "singleGame") {
    return line.isFinal
      ? `Single Game \u00B7 Final ${line.finalGames ?? 1}`
      : "Single Game";
  }

  if (line.type === "doubleGame") {
    return line.isFinal
      ? `Double Game \u00B7 Final ${line.finalGames ?? 1}`
      : "Double Game";
  }

  return fallback?.tableType === "private-room"
    ? "Private Room"
    : "Table Booking";
}

function getRecordChargeLines(
  record: TableHistoryRecord
) {
  return (record.tableChargeLines ?? []).filter(
    (line) => line.amount > 0
  );
}

function getChargeLineActivityCount(line: TableChargeLine) {
  if (line.type === "singleGame" || line.type === "doubleGame") {
    return Math.max(1, line.finalGames ?? 1);
  }

  return 1;
}

function getDisplayRows(
  record: TableHistoryRecord
): HistoryDisplayRow[] {
  const lines = getRecordChargeLines(record);
  const labelCounts = new Map<string, number>();

  lines.forEach((line) => {
    const label =
      line.type === "singleGame"
        ? "Single Game"
        : line.type === "doubleGame"
          ? "Double Game"
          : getChargeLineTypeLabel(line, record);
    labelCounts.set(
      label,
      (labelCounts.get(label) ?? 0) + getChargeLineActivityCount(line)
    );
  });

  const typeLabel = lines.length
    ? [...labelCounts.entries()]
        .map(([label, count]) =>
          count > 1 ? `${label} x${count}` : label
        )
        .join(", ")
    : getRecordTypeLabel(record);

  return [
    {
      record,
      rowId: record.id,
      typeLabel,
      startedAt: record.startedAt,
      endedAt: record.endedAt,
      durationMinutes: record.durationMinutes,
      tableAmount: record.tableAmount,
    },
  ];
}

function getRecordActivityCounts(
  record: TableHistoryRecord
) {
  const lines = getRecordChargeLines(record);

  if (lines.length > 0) {
    return {
      singleGames: lines.filter(
        (line) => line.type === "singleGame"
      ).reduce(
        (total, line) => total + getChargeLineActivityCount(line),
        0
      ),
      doubleGames: lines.filter(
        (line) => line.type === "doubleGame"
      ).reduce(
        (total, line) => total + getChargeLineActivityCount(line),
        0
      ),
      bookings: lines.filter(
        (line) => line.type === "tableBooking"
      ).length,
    };
  }

  return {
    singleGames: record.sessionType === "single" ? 1 : 0,
    doubleGames: record.sessionType === "double" ? 1 : 0,
    bookings:
      record.sessionType === "time" ||
      record.sessionType === "private"
        ? 1
        : 0,
  };
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) return `${mins} min`;

  return `${hours}h ${mins}m`;
}

function getDateRange(
  filter: DateFilter,
  customStart: string,
  customEnd: string
) {
  const now = new Date();
  const currentBusinessDay = getBusinessDayWindow(now);

  if (filter === "yesterday") {
    const yesterday = new Date(currentBusinessDay.start);
    yesterday.setDate(currentBusinessDay.start.getDate() - 1);

    return {
      ...getBusinessDayWindow(yesterday),
    };
  }

  if (filter === "this-week") {
    const start = new Date(currentBusinessDay.start);
    start.setDate(
      now.getDate() - now.getDay()
    );

    return { start, end: currentBusinessDay.end };
  }

  if (filter === "this-month") {
    return {
      start: new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
        6,
        0,
        0,
        0
      ),
      end: currentBusinessDay.end,
    };
  }

  if (filter === "custom") {
    return {
      start: customStart
        ? getBusinessDayWindow(new Date(customStart)).start
        : new Date(0),
      end: customEnd
        ? getBusinessDayWindow(new Date(customEnd)).end
        : currentBusinessDay.end,
    };
  }

  return currentBusinessDay;
}

function matchesSearch(
  record: TableHistoryRecord,
  query: string,
  extraValues: Array<string | undefined> = []
) {
  if (!query.trim()) return true;

  const search = query
    .trim()
    .toLowerCase();
  const values = [
    record.tableName,
    record.billNo,
    record.invoiceNumber,
    record.staffBillNumber,
    record.payerName,
    record.winnerName,
    record.loserName,
    ...record.players,
    ...extraValues,
    record.sessionType,
    getRecordTypeLabel(record),
    ...getRecordChargeLines(record).map((line) =>
      getChargeLineTypeLabel(line, record)
    ),
  ];

  return values
    .filter(Boolean)
    .some((value) =>
      String(value)
        .toLowerCase()
        .includes(search)
    );
}

function getRecordCustomer(record: TableHistoryRecord) {
  return (
    record.payerName ??
    record.winnerName ??
    record.loserName ??
    record.players[0] ??
    "-"
  );
}

function getDaySheetName(record: TableHistoryRecord) {
  const name =
    record.payerName ??
    record.winnerName ??
    record.loserName ??
    record.player1Name ??
    record.players[0];

  if (!name || /^walk-in customer(?:\s*\(\d+\))?$/i.test(name.trim())) {
    return "Walk-in";
  }

  return name;
}

function getDaySheetFrameLabel(record: TableHistoryRecord) {
  const counts = getRecordActivityCounts(record);
  const labels = [
    counts.singleGames > 0
      ? `Single${counts.singleGames > 1 ? ` x${counts.singleGames}` : ""}`
      : "",
    counts.doubleGames > 0
      ? `Double${counts.doubleGames > 1 ? ` x${counts.doubleGames}` : ""}`
      : "",
    counts.bookings > 0 ? "Booking" : "",
  ].filter(Boolean);

  return labels.join(" + ") || "Session";
}

function getRecordActivityTotal(record: TableHistoryRecord) {
  const counts = getRecordActivityCounts(record);
  return counts.singleGames + counts.doubleGames + counts.bookings;
}

function getRecordStatusClass(status: string) {
  if (status === "paid") return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  if (status === "pending") return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
  if (status === "cancelled") return "bg-red-50 text-red-700 ring-1 ring-red-200";
  return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
}

function formatStatusLabel(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function getPaymentBadgeClass(label: string) {
  const normalized = label.toLowerCase();

  if (normalized.includes("cash") && normalized.includes("+")) {
    return "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200";
  }

  if (normalized.includes("cash")) {
    return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  }

  if (
    normalized.includes("easypaisa") ||
    normalized.includes("jazzcash")
  ) {
    return "bg-sky-50 text-sky-700 ring-1 ring-sky-200";
  }

  if (normalized.includes("card")) {
    return "bg-violet-50 text-violet-700 ring-1 ring-violet-200";
  }

  if (normalized.includes("pending")) {
    return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
  }

  return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
}

function getCafeItems(record: TableHistoryRecord) {
  return record.cafeItems.filter(
    (item) => !item.name.startsWith("[Accessory]")
  );
}

function getAccessoryItems(record: TableHistoryRecord) {
  return record.cafeItems.filter((item) =>
    item.name.startsWith("[Accessory]")
  );
}

function TableHistoryPage() {
  useAppDateTimeFormats();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isAdmin =
    location.pathname.startsWith("/admin");

  const records = useTableHistoryStore(
    (state) => state.records
  );
  const tables = useTableStore(
    (state) => state.tables
  );
  const sales = useSalesStore(
    (state) => state.sales
  );
  const pendingBills = useCheckoutStore(
    (state) => state.pendingBills
  );
  const businessDays = useBusinessDayStore(
    (state) => state.days
  );

  const [tableFilter, setTableFilter] =
    useState(
      searchParams.get("tableId") ?? "all"
    );
  const [dateFilter, setDateFilter] =
    useState<DateFilter>("today");
  const [customStart, setCustomStart] =
    useState("");
  const [customEnd, setCustomEnd] =
    useState("");
  const [sessionTypeFilter, setSessionTypeFilter] =
    useState("all");
  const [operatorFilter, setOperatorFilter] =
    useState("all");
  const [businessDayFilter, setBusinessDayFilter] =
    useState("all");
  const [search, setSearch] = useState("");
  const [historyView, setHistoryView] = useState<
    "sessions" | "day-sheet" | "earnings"
  >(() =>
    searchParams.get("tableId")
      ? "earnings"
      : "sessions"
  );
  const [selectedRecord, setSelectedRecord] =
    useState<TableHistoryRecord | null>(
      null
    );
  const [selectedEarningsTableId, setSelectedEarningsTableId] =
    useState<number | null>(() => {
      const tableId = Number(
        searchParams.get("tableId")
      );

      return Number.isFinite(tableId) && tableId > 0
        ? tableId
        : null;
    });

  const saleById = useMemo(
    () => new Map(sales.map((sale) => [sale.id, sale])),
    [sales]
  );
  const saleBySessionId = useMemo(() => {
    const map = new Map<string, (typeof sales)[number]>();

    sales.forEach((sale) => {
      if (sale.paymentStatus !== "paid") return;
      if (sale.sessionId) {
        map.set(sale.sessionId, sale);
      }
      sale.gameCharges?.forEach((charge) => {
        if (charge.sessionId) {
          map.set(charge.sessionId, sale);
        }
      });
      sale.cafeCharges?.forEach((charge) => {
        if (charge.sessionId) {
          map.set(charge.sessionId, sale);
        }
      });
    });

    return map;
  }, [sales]);
  const pendingBillById = useMemo(
    () =>
      new Map(
        pendingBills.map((bill) => [bill.id, bill])
      ),
    [pendingBills]
  );
  const businessDayById = useMemo(
    () => new Map(businessDays.map((day) => [day.id, day])),
    [businessDays]
  );

  const getRecordSale = (record: TableHistoryRecord) =>
    record.saleId
      ? saleById.get(record.saleId) ?? saleBySessionId.get(record.sessionId)
      : saleBySessionId.get(record.sessionId);
  const getRecordPendingBill = (record: TableHistoryRecord) =>
    record.pendingBillId ? pendingBillById.get(record.pendingBillId) : undefined;
  const getRecordOperator = (record: TableHistoryRecord) =>
    getRecordSale(record)?.paymentReceivedBy?.operatorName ??
    getRecordSale(record)?.operatorAudit?.find(
      (event) => event.action === "payment_received"
    )?.operator.operatorName ??
    getRecordPendingBill(record)?.createdBy?.operatorName ??
    "Not recorded";
  const getRecordBusinessDayId = (record: TableHistoryRecord) =>
    getRecordSale(record)?.activeBusinessDayId ?? "none";
  const getRecordBusinessDayLabel = (record: TableHistoryRecord) => {
    const dayId = getRecordBusinessDayId(record);
    const day = dayId === "none" ? undefined : businessDayById.get(dayId);
    return day ? `${day.dayName} - ${day.openedBy}` : "No Business Day";
  };
  const getRecordPaymentLabel = (record: TableHistoryRecord) => {
    const sale = getRecordSale(record);
    if (!sale) return record.paymentStatus === "pending" ? "Pending" : "-";
    if (sale.paymentSplits?.length) {
      return sale.paymentSplits
        .map((split) => paymentMethodLabels[split.method])
        .join(" + ");
    }
    return paymentMethodLabels[sale.paymentMethod];
  };
  const getRecordAmountReceived = (record: TableHistoryRecord) => {
    const sale = getRecordSale(record);

    if (!sale) return record.paymentStatus === "paid" ? record.grandTotal : 0;

    if (sale.paymentSplits?.length) {
      return sale.paymentSplits.reduce(
        (total, split) => total + split.amount,
        0
      );
    }

    return sale.grandTotal;
  };
  const getRecordEffectiveStatus = (record: TableHistoryRecord) =>
    getRecordSale(record)?.paymentStatus ?? record.paymentStatus;

  const operatorOptions = useMemo(
    () =>
      Array.from(
        new Set(records.map((record) => getRecordOperator(record)))
      ).sort((a, b) => a.localeCompare(b)),
    [records, saleById, pendingBillById]
  );

  const filteredRecords = useMemo(() => {
    const { start, end } = getDateRange(
      dateFilter,
      customStart,
      customEnd
    );

    return records
      .filter(
        (record) =>
          record.paymentStatus !== "cancelled"
      )
      .filter((record) => {
        const endedAt = new Date(
          record.endedAt
        );

        return (
          endedAt >= start && endedAt <= end
        );
      })
      .filter((record) =>
        tableFilter === "all"
          ? true
          : record.tableId ===
            Number(tableFilter)
      )
      .filter((record) =>
        sessionTypeFilter === "all"
          ? true
          : record.sessionType ===
            sessionTypeFilter
      )
      .filter((record) =>
        operatorFilter === "all"
          ? true
          : getRecordOperator(record) === operatorFilter
      )
      .filter((record) =>
        businessDayFilter === "all"
          ? true
          : getRecordBusinessDayId(record) === businessDayFilter
      )
      .filter((record) =>
        matchesSearch(record, search, [
          getRecordOperator(record),
          getRecordBusinessDayLabel(record),
          getRecordPaymentLabel(record),
        ])
      )
      .sort(
        (a, b) =>
          new Date(b.endedAt).getTime() -
          new Date(a.endedAt).getTime()
      );
  }, [
    records,
    tableFilter,
    dateFilter,
    customStart,
    customEnd,
    sessionTypeFilter,
    operatorFilter,
    businessDayFilter,
    search,
    saleById,
    pendingBillById,
    businessDayById,
  ]);

  const summary = useMemo(
    () =>
      filteredRecords.reduce(
        (totals, record) => {
          const chargeLines =
            getRecordChargeLines(record);
          const activityCounts = getRecordActivityCounts(record);
          const singleGames = activityCounts.singleGames;
          const doubleGames = activityCounts.doubleGames;
          const bookingRows =
            chargeLines.length > 0
              ? chargeLines.filter(
                  (line) =>
                    line.type === "tableBooking"
                )
              : record.sessionType === "time" ||
                  record.sessionType === "private"
                ? [undefined]
                : [];

          return {
            sessions: totals.sessions + 1,
            singleGames:
              totals.singleGames + singleGames,
            doubleGames:
              totals.doubleGames + doubleGames,
            bookingSessions:
              totals.bookingSessions +
              bookingRows.length,
            bookingRevenue:
              totals.bookingRevenue +
              (chargeLines.length > 0
                  ? chargeLines
                      .filter(
                        (line) =>
                          line.type ===
                          "tableBooking"
                      )
                      .reduce(
                        (total, line) =>
                          total + line.amount,
                        0
                      )
                  : bookingRows.length
                    ? record.tableAmount
                    : 0),
            tableEarnings:
              totals.tableEarnings + record.tableAmount,
          };
        },
        {
          sessions: 0,
          singleGames: 0,
          doubleGames: 0,
          bookingSessions: 0,
          bookingRevenue: 0,
          tableEarnings: 0,
        }
      ),
    [filteredRecords]
  );
  const displayRows = useMemo(
    () => filteredRecords.flatMap(getDisplayRows),
    [filteredRecords]
  );
  const daySheetDateRange = getDateRange(
    dateFilter,
    customStart,
    customEnd
  );
  const daySheetFilteredRecords = records
    .filter((record) => {
      if (businessDayFilter !== "all") {
        return getRecordBusinessDayId(record) === businessDayFilter;
      }

      const endedAt = new Date(record.endedAt);
      return (
        endedAt >= daySheetDateRange.start &&
        endedAt <= daySheetDateRange.end
      );
    })
    .filter((record) =>
      tableFilter === "all"
        ? true
        : record.tableId === Number(tableFilter)
    )
    .filter((record) =>
      sessionTypeFilter === "all"
        ? true
        : record.sessionType === sessionTypeFilter
    )
    .filter((record) =>
      operatorFilter === "all"
        ? true
        : getRecordOperator(record) === operatorFilter
    );
  const daySheetTables = useMemo<DaySheetTable[]>(() => {
    const tableMap = new Map<number, DaySheetTable>();
    const visibleTables =
      tableFilter === "all"
        ? tables
        : tables.filter((table) => table.id === Number(tableFilter));

    visibleTables.forEach((table) => {
      tableMap.set(table.id, {
        tableId: table.id,
        tableName: table.name,
        sessions: [],
        validSessions: [],
        revenue: 0,
      });
    });

    daySheetFilteredRecords.forEach((record) => {
      if (tableFilter !== "all" && record.tableId !== Number(tableFilter)) {
        return;
      }

      const current =
        tableMap.get(record.tableId) ??
        {
          tableId: record.tableId,
          tableName: record.tableName,
          sessions: [],
          validSessions: [],
          revenue: 0,
        };

      current.sessions.push(record);
      if (getRecordEffectiveStatus(record) !== "cancelled") {
        current.validSessions.push(record);
      }
      if (
        getRecordEffectiveStatus(record) !== "pending" &&
        getRecordEffectiveStatus(record) !== "cancelled"
      ) {
        current.revenue += record.tableAmount;
      }
      tableMap.set(record.tableId, current);
    });

    return [...tableMap.values()]
      .map((table) => {
        const sessions = [...table.sessions].sort(
          (a, b) =>
            new Date(a.startedAt).getTime() -
            new Date(b.startedAt).getTime()
        );
        return {
          ...table,
          sessions,
          validSessions: sessions.filter(
            (record) =>
              getRecordEffectiveStatus(record) !== "cancelled"
          ),
          firstStartedAt: sessions[0]?.startedAt,
          lastEndedAt: sessions.at(-1)?.endedAt,
        };
      })
      .sort((a, b) => a.tableId - b.tableId);
  }, [daySheetFilteredRecords, tableFilter, tables]);
  const daySheetSummary = useMemo(() => {
    const mostUsedTable = [...daySheetTables].sort(
      (a, b) =>
        b.validSessions.reduce(
          (total, record) => total + getRecordActivityTotal(record),
          0
        ) -
          a.validSessions.reduce(
            (total, record) => total + getRecordActivityTotal(record),
            0
          ) ||
        b.revenue - a.revenue
    )[0];

    return {
      totalGames: daySheetTables.reduce(
        (total, table) =>
          total +
          table.validSessions.reduce(
            (tableTotal, record) =>
              tableTotal + getRecordActivityTotal(record),
            0
          ),
        0
      ),
      totalRevenue: daySheetTables.reduce(
        (total, table) => total + table.revenue,
        0
      ),
      mostUsedTable:
        mostUsedTable && mostUsedTable.validSessions.length > 0
          ? mostUsedTable.tableName
          : "-",
      selectedBusinessDay:
        businessDayFilter === "all"
          ? getDateFilterLabel(dateFilter)
          : businessDayFilter === "none"
            ? "No Business Day"
            : businessDayById.get(businessDayFilter)?.dayName ??
              "Selected Business Day",
    };
  }, [businessDayById, businessDayFilter, dateFilter, daySheetTables]);
  const tableEarnings = useMemo(() => {
    const earnings = new Map<
      number,
      {
        tableId: number;
        tableName: string;
        sessions: number;
        singleGames: number;
        doubleGames: number;
        bookings: number;
        amount: number;
      }
    >();

    filteredRecords.forEach((record) => {
      const current = earnings.get(record.tableId) ?? {
        tableId: record.tableId,
        tableName: record.tableName,
        sessions: 0,
        singleGames: 0,
        doubleGames: 0,
        bookings: 0,
        amount: 0,
      };
      const activityCounts = getRecordActivityCounts(record);

      current.sessions += 1;
      current.amount += record.tableAmount;
      current.singleGames += activityCounts.singleGames;
      current.doubleGames += activityCounts.doubleGames;
      current.bookings += activityCounts.bookings;
      earnings.set(record.tableId, current);
    });

    return [...earnings.values()].sort(
      (a, b) => b.amount - a.amount
    );
  }, [filteredRecords]);
  const selectedEarningsTable =
    selectedEarningsTableId === null
      ? undefined
      : tableEarnings.find(
          (item) =>
            item.tableId === selectedEarningsTableId
        );
  const selectedEarningsTableName =
    selectedEarningsTable?.tableName ??
    tables.find(
      (table) =>
        table.id === selectedEarningsTableId
    )?.name;
  const selectedTableRecords =
    selectedEarningsTableId === null
      ? []
      : filteredRecords.filter(
          (record) =>
            record.tableId === selectedEarningsTableId
        );
  const selectedTableTotal =
    selectedTableRecords.reduce(
      (total, record) => total + record.tableAmount,
      0
    );

  return (
    <PageShell contentClassName="space-y-0">
      <div>
        <button
          onClick={() =>
            navigate(isAdmin ? "/admin" : "/operator/tables-rooms")
          }
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          {isAdmin ? "Back to Admin Dashboard" : "Tables & Rooms"}
        </button>

        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-slate-700 shadow-sm ring-1 ring-slate-200">
              <History className="h-5 w-5" />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-slate-950">
                Table History
              </h1>
              <p className="text-sm text-slate-500">
                Track frames, bookings, and earnings for every table.
              </p>
            </div>
          </div>
        </div>

        <div className="mb-5 flex gap-2" role="tablist" aria-label="Table history views">
          <Button
            type="button"
            role="tab"
            aria-selected={historyView === "sessions"}
            variant={historyView === "sessions" ? "default" : "outline"}
            onClick={() => {
              setHistoryView("sessions");
              setSelectedRecord(null);
            }}
          >
            Session History
          </Button>
          <Button
            type="button"
            role="tab"
            aria-selected={historyView === "day-sheet"}
            variant={historyView === "day-sheet" ? "default" : "outline"}
            onClick={() => {
              setHistoryView("day-sheet");
              if (businessDayFilter === "all") {
                setBusinessDayFilter(
                  useBusinessDayStore.getState().getActiveBusinessDay()?.id ??
                    "all"
                );
              }
              setSelectedRecord(null);
            }}
          >
            Table Day Sheet
          </Button>
          <Button
            type="button"
            role="tab"
            aria-selected={historyView === "earnings"}
            variant={historyView === "earnings" ? "default" : "outline"}
            onClick={() => {
              setHistoryView("earnings");
              setSelectedRecord(null);
            }}
          >
            Earnings by Table
          </Button>
        </div>

        {historyView !== "day-sheet" && (
        <>
        <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="p-5">
            <p className="text-sm text-slate-500">
              Total Sessions
            </p>
            <p className="mt-3 text-2xl font-bold text-slate-950">
              {summary.sessions}
            </p>
          </Card>

          <Card className="p-5">
            <p className="text-sm text-slate-500">
              Table Earnings
            </p>
            <p className="mt-3 text-2xl font-bold text-slate-950">
              {formatCurrency(summary.tableEarnings)}
            </p>
          </Card>

          <Card className="p-5">
            <p className="text-sm text-slate-500">
              Top Earning Table
            </p>
            <p className="mt-3 text-2xl font-bold text-slate-950">
              {tableEarnings[0]?.tableName ?? "-"}
            </p>
            <p className="mt-1 text-sm font-bold text-emerald-700">
              {formatCurrency(tableEarnings[0]?.amount ?? 0)}
            </p>
          </Card>
        </div>

        <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card className="p-4">
            <p className="text-sm text-slate-500">
              Single Frames
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-950">
              {summary.singleGames}
            </p>
          </Card>

          <Card className="p-4">
            <p className="text-sm text-slate-500">
              Double Frames
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-950">
              {summary.doubleGames}
            </p>
          </Card>

          <Card className="p-4">
            <p className="text-sm text-slate-500">
              Booking Sessions
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-950">
              {summary.bookingSessions}
            </p>
          </Card>

          <Card className="p-4">
            <p className="text-sm text-slate-500">
              Booking Revenue
            </p>
            <p className="mt-2 text-2xl font-bold text-emerald-700">
              {formatCurrency(summary.bookingRevenue)}
            </p>
          </Card>
        </div>
        </>
        )}

        {historyView === "day-sheet" && (
          <div className="mx-auto max-w-7xl space-y-4">
            <Card className="p-4">
              <div className="grid items-end gap-3 md:grid-cols-2 xl:grid-cols-[1.35fr_1fr_0.85fr_0.95fr]">
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Business Day / Date
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
                      Business Day
                      <Select
                        value={businessDayFilter}
                        onValueChange={(value) =>
                          setBusinessDayFilter(value ?? "all")
                        }
                      >
                        <SelectTrigger className="h-10 bg-white text-sm font-normal normal-case">
                          <SelectValue placeholder="Business Day" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">By Date</SelectItem>
                          <SelectItem value="none">No Business Day</SelectItem>
                          {businessDays.map((day) => (
                            <SelectItem key={day.id} value={day.id}>
                              {day.dayName} - {day.openedBy}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>
                    <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
                      Date
                      <Select
                        value={dateFilter}
                        onValueChange={(value) =>
                          setDateFilter(value as DateFilter)
                        }
                      >
                        <SelectTrigger className="h-10 bg-white text-sm font-normal normal-case">
                          <SelectValue placeholder="Date" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="today">Today</SelectItem>
                          <SelectItem value="yesterday">Yesterday</SelectItem>
                          <SelectItem value="this-week">This Week</SelectItem>
                          <SelectItem value="this-month">This Month</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    </label>
                  </div>
                </div>

                <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
                  Operator
                  <Select
                    value={operatorFilter}
                    onValueChange={(value) =>
                      setOperatorFilter(value ?? "all")
                    }
                  >
                    <SelectTrigger className="h-10 bg-white text-sm font-normal normal-case">
                      <SelectValue placeholder="Operator" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Operators</SelectItem>
                      {operatorOptions.map((operator) => (
                        <SelectItem key={operator} value={operator}>
                          {operator}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>

                <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
                  Table
                  <Select
                    value={tableFilter}
                    onValueChange={(value) =>
                      setTableFilter(value ?? "all")
                    }
                  >
                    <SelectTrigger className="h-10 bg-white text-sm font-normal normal-case">
                      <SelectValue placeholder="Table" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Tables</SelectItem>
                      {tables.map((table) => (
                        <SelectItem key={table.id} value={String(table.id)}>
                          {table.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>

                <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
                  Session Type
                  <Select
                    value={sessionTypeFilter}
                    onValueChange={(value) =>
                      setSessionTypeFilter(value ?? "all")
                    }
                  >
                    <SelectTrigger className="h-10 bg-white text-sm font-normal normal-case">
                      <SelectValue placeholder="Session Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="single">Single</SelectItem>
                      <SelectItem value="double">Double</SelectItem>
                      <SelectItem value="time">Booking</SelectItem>
                      <SelectItem value="private">Private Booking</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
              </div>

              {businessDayFilter === "all" && dateFilter === "custom" && (
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
                    Start Date
                    <Input
                      className="h-10 bg-white text-sm font-normal normal-case"
                      type="date"
                      value={customStart}
                      onChange={(event) =>
                        setCustomStart(event.target.value)
                      }
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
                    End Date
                    <Input
                      className="h-10 bg-white text-sm font-normal normal-case"
                      type="date"
                      value={customEnd}
                      onChange={(event) =>
                        setCustomEnd(event.target.value)
                      }
                    />
                  </label>
                </div>
              )}
            </Card>

            <div className="grid overflow-hidden rounded-lg border border-slate-200 bg-white text-sm shadow-sm sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Total Games", daySheetSummary.totalGames],
                ["Total Table Revenue", formatCurrency(daySheetSummary.totalRevenue)],
                ["Most Used Table", daySheetSummary.mostUsedTable],
                ["Selected Business Day", daySheetSummary.selectedBusinessDay],
              ].map(([label, value], index) => (
                <div
                  key={label}
                  className={`px-4 py-3 ${
                    index > 0 ? "border-t lg:border-l lg:border-t-0" : ""
                  }`}
                >
                  <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {label}
                  </span>
                  <span className="mt-1 block truncate text-base font-extrabold tabular-nums text-slate-950">
                    {value}
                  </span>
                </div>
              ))}
            </div>

            {records.length === 0 ? (
              <Card className="p-8 text-center text-sm text-slate-500">
                No table history has been recorded yet.
              </Card>
            ) : daySheetTables.every((table) => table.sessions.length === 0) ? (
              <Card className="p-8 text-center">
                <p className="text-sm font-semibold text-slate-700">
                  No table sessions found for the selected filters.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    setOperatorFilter("all");
                    setTableFilter("all");
                    setSessionTypeFilter("all");
                  }}
                >
                  Clear Filters
                </Button>
              </Card>
            ) : (
              <div
                className={`overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm ${
                  tableFilter === "all" ? "" : "mx-auto max-w-[960px]"
                }`}
              >
                <div
                  className={`flex min-w-full items-start ${
                    tableFilter === "all" ? "gap-0" : "justify-center"
                  }`}
                >
                  {daySheetTables.map((table) => (
                    <section
                      key={table.tableId}
                      className={`shrink-0 border-r border-slate-200 last:border-r-0 ${
                        tableFilter === "all"
                          ? "w-[560px]"
                          : "w-full min-w-[760px] max-w-[960px]"
                      }`}
                      aria-label={`${table.tableName} day sheet register`}
                    >
                      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-3">
                        <h2 className="truncate text-xs font-extrabold uppercase tracking-wide text-slate-600">
                          {table.tableName}
                        </h2>
                        <p className="mt-1 text-2xl font-black leading-7 tabular-nums text-slate-950">
                          {table.validSessions.reduce(
                            (total, record) =>
                              total + getRecordActivityTotal(record),
                            0
                          )} Games
                        </p>
                        <p className="mt-0.5 text-base font-extrabold tabular-nums text-slate-900">
                          {formatCurrency(table.revenue)}
                        </p>
                        <p className="mt-0.5 whitespace-nowrap text-xs font-medium tabular-nums text-slate-500">
                          {table.firstStartedAt && table.lastEndedAt
                            ? `${formatTime(table.firstStartedAt)} - ${formatTime(table.lastEndedAt)}`
                            : "No sessions"}
                        </p>
                      </div>

                      <div className="max-h-[64vh] overflow-auto">
                        <table className="w-full table-fixed border-collapse text-left text-xs">
                          <colgroup>
                            <col className="w-[34%]" />
                            <col className="w-[18%]" />
                            <col className="w-[18%]" />
                            <col className="w-[14%]" />
                            <col className="w-[16%]" />
                          </colgroup>
                          <thead className="sticky top-0 z-10 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                            <tr>
                              <th scope="col" className="border-b border-slate-200 px-3 py-2 font-extrabold">Name</th>
                              <th scope="col" className="border-b border-slate-200 px-2 py-2 font-extrabold">Time In</th>
                              <th scope="col" className="border-b border-slate-200 px-2 py-2 font-extrabold">Time Out</th>
                              <th scope="col" className="border-b border-slate-200 px-2 py-2 font-extrabold">Frame</th>
                              <th scope="col" className="border-b border-slate-200 px-3 py-2 text-right font-extrabold">Rs.</th>
                            </tr>
                          </thead>
                          <tbody>
                            {table.sessions.map((record) => {
                              const displayName = getDaySheetName(record);
                              const selected = selectedRecord?.id === record.id;
                              const cancelled = record.paymentStatus === "cancelled";

                              return (
                                <tr
                                  key={record.id}
                                  tabIndex={0}
                                  onClick={() => setSelectedRecord(record)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter" || event.key === " ") {
                                      event.preventDefault();
                                      setSelectedRecord(record);
                                    }
                                  }}
                                  className={`cursor-pointer border-b border-slate-100 transition focus:outline-none focus:ring-2 focus:ring-inset focus:ring-slate-400 ${
                                    selected
                                      ? "bg-slate-100"
                                      : cancelled
                                        ? "bg-slate-50 text-slate-400 hover:bg-slate-100"
                                        : "bg-white hover:bg-slate-50"
                                  }`}
                                >
                                  <td className="truncate px-3 py-2 font-semibold text-slate-950" title={record.player1Name || displayName}>
                                    {displayName}
                                  </td>
                                  <td className="whitespace-nowrap px-2 py-2 font-medium tabular-nums text-slate-700">
                                    {formatTime(record.startedAt)}
                                  </td>
                                  <td className="whitespace-nowrap px-2 py-2 font-medium tabular-nums text-slate-700">
                                    {record.endedAt ? formatTime(record.endedAt) : "Open"}
                                  </td>
                                  <td className="whitespace-nowrap px-2 py-2 text-slate-700">
                                    <span className="inline-flex rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700">
                                      {getDaySheetFrameLabel(record)}
                                    </span>
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2 text-right font-extrabold tabular-nums text-slate-950">
                                    {formatCurrency(record.tableAmount)}
                                  </td>
                                </tr>
                              );
                            })}

                            {table.sessions.length === 0 && (
                              <tr>
                                <td colSpan={5} className="px-3 py-8 text-center text-xs text-slate-500">
                                  No sessions for this table.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {historyView === "earnings" && (
        <>
        <Card className="mb-5 overflow-hidden">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b p-4">
            <div>
              <h2 className="font-bold text-slate-950">
                Earnings by Table
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Select a table to open its earnings register.
              </p>
            </div>
            <label className="grid min-w-40 gap-1 text-xs font-semibold uppercase text-slate-500">
              Period
              <Select
                value={dateFilter}
                onValueChange={(value) =>
                  setDateFilter(value as DateFilter)
                }
              >
                <SelectTrigger className="bg-white font-normal normal-case">
                  <SelectValue placeholder="Period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="this-week">This Week</SelectItem>
                  <SelectItem value="this-month">This Month</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </label>
          </div>
          {dateFilter === "custom" && (
            <div className="grid gap-3 border-b bg-slate-50 p-4 md:grid-cols-2">
              <Input
                type="date"
                value={customStart}
                onChange={(event) =>
                  setCustomStart(event.target.value)
                }
              />
              <Input
                type="date"
                value={customEnd}
                onChange={(event) =>
                  setCustomEnd(event.target.value)
                }
              />
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Rank</th>
                  <th className="px-4 py-3">Table</th>
                  <th className="px-4 py-3 text-right">Sessions</th>
                  <th className="px-4 py-3 text-right">Single Frames</th>
                  <th className="px-4 py-3 text-right">Double Frames</th>
                  <th className="px-4 py-3 text-right">Bookings</th>
                  <th className="px-4 py-3 text-right">Earnings</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {tableEarnings.map((item, index) => (
                  <tr
                    key={item.tableId}
                    tabIndex={0}
                    onClick={() =>
                      setSelectedEarningsTableId(item.tableId)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        setSelectedEarningsTableId(item.tableId);
                      }
                    }}
                    className={`cursor-pointer transition focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-300 ${
                      selectedEarningsTableId === item.tableId
                        ? "bg-emerald-50"
                        : "bg-white hover:bg-slate-50"
                    }`}
                  >
                    <td className="px-4 py-3 font-bold">{index + 1}</td>
                    <td className="px-4 py-3 font-semibold">{item.tableName}</td>
                    <td className="px-4 py-3 text-right">{item.sessions}</td>
                    <td className="px-4 py-3 text-right">{item.singleGames}</td>
                    <td className="px-4 py-3 text-right">{item.doubleGames}</td>
                    <td className="px-4 py-3 text-right">{item.bookings}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-700">
                      {formatCurrency(item.amount)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant={
                          selectedEarningsTableId === item.tableId
                            ? "default"
                            : "outline"
                        }
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedEarningsTableId(item.tableId);
                        }}
                      >
                        View History
                      </Button>
                    </td>
                  </tr>
                ))}
                {tableEarnings.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                      No table earnings for this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {selectedEarningsTableId !== null && (
          <Card className="mb-5 overflow-hidden border-emerald-200">
            <div className="flex items-center justify-between gap-4 border-b bg-emerald-50 p-4">
              <div>
                <h2 className="font-bold text-slate-950">
                  {selectedEarningsTableName ?? `Table ${selectedEarningsTableId}`} Earnings History
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {selectedTableRecords.length} sessions{" \u00B7 "}{formatCurrency(selectedTableTotal)} earned
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setSelectedEarningsTableId(null)
                }
              >
                Close
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">No.</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Time In</th>
                    <th className="px-4 py-3">Time Out</th>
                    <th className="px-4 py-3">Session</th>
                    <th className="px-4 py-3 text-right">Single</th>
                    <th className="px-4 py-3 text-right">Double</th>
                    <th className="px-4 py-3 text-right">Bookings</th>
                    <th className="px-4 py-3 text-right">Earnings</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {selectedTableRecords.map((record, index) => {
                    const counts = getRecordActivityCounts(record);

                    return (
                      <tr key={record.id} className="bg-white">
                        <td className="px-4 py-3 font-bold">{index + 1}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{formatDate(record.endedAt)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{formatTime(record.startedAt)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{formatTime(record.endedAt)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {getDisplayRows(record)[0]?.typeLabel ?? getRecordTypeLabel(record)}
                        </td>
                        <td className="px-4 py-3 text-right">{counts.singleGames || "-"}</td>
                        <td className="px-4 py-3 text-right">{counts.doubleGames || "-"}</td>
                        <td className="px-4 py-3 text-right">{counts.bookings || "-"}</td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-700">
                          {formatCurrency(record.tableAmount)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedRecord(record)}
                          >
                            View Details
                          </Button>
                        </td>
                      </tr>
                    );
                  })}

                  {selectedTableRecords.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                        No history for this table with the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
                {selectedTableRecords.length > 0 && (
                  <tfoot className="border-t bg-slate-50 font-bold">
                    <tr>
                      <td colSpan={8} className="px-4 py-3 text-right">
                        Total Earnings
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-700">
                        {formatCurrency(selectedTableTotal)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Card>
        )}

        </>
        )}

        {historyView === "sessions" && (
        <Card className="overflow-hidden">
          <div className="border-b p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-6">
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Search
                </p>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={search}
                    onChange={(event) =>
                      setSearch(event.target.value)
                    }
                    placeholder="Search table, customer, invoice or operator..."
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Table
                </p>
                <Select
                  value={tableFilter}
                  onValueChange={(value) =>
                    setTableFilter(value ?? "all")
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Table" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      All Tables
                    </SelectItem>
                    {tables.map((table) => (
                      <SelectItem
                        key={table.id}
                        value={String(table.id)}
                      >
                        {table.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Date
                </p>
                <Select
                  value={dateFilter}
                  onValueChange={(value) =>
                    setDateFilter(
                      value as DateFilter
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Date" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">
                      Today
                    </SelectItem>
                    <SelectItem value="yesterday">
                      Yesterday
                    </SelectItem>
                    <SelectItem value="this-week">
                      This Week
                    </SelectItem>
                    <SelectItem value="this-month">
                      This Month
                    </SelectItem>
                    <SelectItem value="custom">
                      Custom Range
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Session Type
                </p>
                <Select
                  value={sessionTypeFilter}
                  onValueChange={
                    (value) =>
                      setSessionTypeFilter(
                        value ?? "all"
                      )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Session Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      All Types
                    </SelectItem>
                    <SelectItem value="single">
                      Single Game
                    </SelectItem>
                    <SelectItem value="double">
                      Double Game
                    </SelectItem>
                    <SelectItem value="time">
                      Time
                    </SelectItem>
                    <SelectItem value="private">
                      Private Booking
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Operator
                </p>
                <Select
                  value={operatorFilter}
                  onValueChange={(value) =>
                    setOperatorFilter(value ?? "all")
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Operator" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      All Operators
                    </SelectItem>
                    {operatorOptions.map((operator) => (
                      <SelectItem key={operator} value={operator}>
                        {operator}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Business Day
                </p>
                <Select
                  value={businessDayFilter}
                  onValueChange={(value) =>
                    setBusinessDayFilter(value ?? "all")
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Business Day" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      All Business Days
                    </SelectItem>
                    <SelectItem value="none">
                      No Business Day
                    </SelectItem>
                    {businessDays.map((day) => (
                      <SelectItem key={day.id} value={day.id}>
                        {day.dayName} - {day.openedBy}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {dateFilter === "custom" && (
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
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

          <div className="flex items-center justify-between border-b bg-white px-4 py-3 text-sm text-slate-600">
            <span>
              Showing{" "}
              <strong className="text-slate-950">
                {displayRows.length}
              </strong>{" "}
              sessions
            </span>
            <span className="text-xs text-slate-500">
              {filteredRecords.length} invoices after filters
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1240px] table-fixed text-left text-sm">
              <colgroup>
                <col className="w-[110px]" />
                <col className="w-[90px]" />
                <col className="w-[90px]" />
                <col className="w-[85px]" />
                <col className="w-[80px]" />
                <col className="w-[100px]" />
                <col className="w-[150px]" />
                <col className="w-[190px]" />
                <col className="w-[100px]" />
                <col className="w-[140px]" />
                <col className="w-[80px]" />
                <col className="w-[85px]" />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Start Time</th>
                  <th className="px-4 py-3">End Time</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">Table</th>
                  <th className="px-4 py-3">Operator</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Session Type</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {displayRows.map((row) => {
                  const paymentLabel = getRecordPaymentLabel(row.record);

                  return (
                  <tr
                    key={row.rowId}
                    className="bg-white transition-colors hover:bg-slate-50"
                  >
                    <td className="whitespace-nowrap px-4 py-3">
                      {formatDate(row.endedAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {formatTime(row.startedAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {formatTime(row.endedAt)}
                    </td>
                    <td className="px-4 py-3">
                      {formatDuration(row.durationMinutes)}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {row.record.tableName}
                    </td>
                    <td className="overflow-hidden px-4 py-3">
                      <span className="block truncate" title={getRecordOperator(row.record)}>
                        {getRecordOperator(row.record)}
                      </span>
                    </td>
                    <td className="overflow-hidden px-4 py-3">
                      <span className="block truncate" title={getRecordCustomer(row.record)}>
                        {getRecordCustomer(row.record)}
                      </span>
                    </td>
                    <td className="overflow-hidden px-4 py-3">
                      <span className="block truncate whitespace-nowrap" title={row.typeLabel}>
                        {row.typeLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-700">
                      {formatCurrency(row.tableAmount)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${getPaymentBadgeClass(paymentLabel)}`}>
                        {paymentLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${getRecordStatusClass(getRecordEffectiveStatus(row.record))}`}>
                        {formatStatusLabel(getRecordEffectiveStatus(row.record))}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        title="View details"
                        aria-label="View details"
                        onClick={() =>
                          setSelectedRecord(
                            row.record
                          )
                        }
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                  );
                })}

                {displayRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={12}
                      className="px-4 py-12 text-center text-slate-500"
                    >
                      {records.length === 0
                        ? "No table history has been recorded yet."
                        : "No table history matches the selected filters."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
        )}

        {selectedRecord && (
          <Card className="mt-5 p-5">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  {selectedRecord.tableName} -{" "}
                  {formatDateTime(
                    selectedRecord.endedAt
                  )}
                </h2>
              </div>

              <Button
                variant="outline"
                onClick={() =>
                  setSelectedRecord(null)
                }
              >
                Close
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-lg border p-4">
                <p className="text-sm font-semibold text-slate-950">
                  Session Information
                </p>
                <div className="mt-3 space-y-2 text-sm text-slate-600">
                  <p>
                    Date:{" "}
                    {formatDateTime(
                      selectedRecord.endedAt
                    )}
                  </p>
                  <p>
                    Table:{" "}
                    {selectedRecord.tableName}
                  </p>
                  <p>
                    Session Type:{" "}
                    {getRecordTypeLabel(
                      selectedRecord
                    )}
                  </p>
                  <p>
                    Operator: {getRecordOperator(selectedRecord)}
                  </p>
                  <p>
                    Customer: {getRecordCustomer(selectedRecord)}
                  </p>
                  <p>
                    Business Day: {getRecordBusinessDayLabel(selectedRecord)}
                  </p>
                  <p>
                    Time In:{" "}
                    {formatDateTime(
                      selectedRecord.startedAt
                    )}
                  </p>
                  <p>
                    Time Out:{" "}
                    {formatDateTime(
                      selectedRecord.endedAt
                    )}
                  </p>
                  <p>
                    Duration:{" "}
                    {formatDuration(
                      selectedRecord.durationMinutes
                    )}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <p className="text-sm font-semibold text-slate-950">
                  Billing Information
                </p>
                <div className="mt-3 space-y-2 text-sm text-slate-600">
                  <p>
                    Table Amount:{" "}
                    {formatCurrency(
                      selectedRecord.tableAmount
                    )}
                  </p>
                  <p>
                    Cafe Amount: {formatCurrency(selectedRecord.cafeAmount)}
                  </p>
                  <p>
                    Discount: {formatCurrency(selectedRecord.discount)}
                  </p>
                  <p>
                    Grand Total:{" "}
                    <strong className="text-emerald-700">
                      {formatCurrency(selectedRecord.grandTotal)}
                    </strong>
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-lg border p-4">
              <p className="text-sm font-semibold text-slate-950">
                Payment Information
              </p>
              <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-3">
                <p>
                  Payment:{" "}
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${getPaymentBadgeClass(getRecordPaymentLabel(selectedRecord))}`}>
                    {getRecordPaymentLabel(selectedRecord)}
                  </span>
                </p>
                <p>
                  Status:{" "}
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${getRecordStatusClass(getRecordEffectiveStatus(selectedRecord))}`}>
                    {formatStatusLabel(getRecordEffectiveStatus(selectedRecord))}
                  </span>
                </p>
                <p>Invoice: {selectedRecord.invoiceNumber ?? selectedRecord.staffBillNumber ?? selectedRecord.billNo ?? "-"}</p>
                <p>Amount Received: {formatCurrency(getRecordAmountReceived(selectedRecord))}</p>
                <p>Change Returned: {formatCurrency(Math.max(0, getRecordAmountReceived(selectedRecord) - selectedRecord.grandTotal))}</p>
                <p>Paid At: {selectedRecord.paidAt ? formatDateTime(selectedRecord.paidAt) : "-"}</p>
                <p>Notes: {selectedRecord.cancelledNote ?? selectedRecord.cancelledReason ?? "-"}</p>
              </div>
            </div>

            <div className="mt-4 rounded-lg border p-4">
              <p className="text-sm font-semibold text-slate-950">
                Games / Booking Charges
              </p>
              <div className="mt-3 space-y-3">
                {getRecordChargeLines(selectedRecord)
                  .slice()
                  .sort(compareChargeTimestamps)
                  .map((line, index) => (
                      <div
                        key={line.id}
                        className="rounded-lg bg-slate-50 p-3 text-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <strong className="text-slate-950">
                            {line.type === "tableBooking"
                              ? `Booking charge ${index + 1}`
                              : `Game ${index + 1}`} - {getChargeLineTypeLabel(line, selectedRecord)}
                          </strong>
                          <span className="text-slate-500">
                            {formatChargeTimeRange(line.startedAt, line.endedAt, selectedRecord.startedAt)} - {formatChargeDuration(line.startedAt, line.endedAt)}
                          </span>
                        </div>
                        <div className="mt-2 flex justify-between border-t pt-2 text-slate-600">
                          <span>
                            {line.loserName ? `${line.loserName} lost` : line.winnerName ? `${line.winnerName} won` : "—"}
                          </span>
                          <strong className="text-emerald-700">
                            {formatCurrency(line.amount)}
                          </strong>
                        </div>
                      </div>
                  ))}

                {getRecordChargeLines(selectedRecord).length === 0 && (
                  <p className="text-sm text-slate-500">
                    No frame breakdown is available for this older record.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border p-4">
                <p className="text-sm font-semibold text-slate-950">
                  Cafe Orders
                </p>
                <div className="mt-3 space-y-2">
                  {getCafeItems(selectedRecord).map((item, index) => (
                    <div key={`${item.itemId}-${index}`} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      <span>{item.name} x{item.quantity}</span>
                      <strong>{formatCurrency(item.subtotal)}</strong>
                    </div>
                  ))}
                  {getCafeItems(selectedRecord).length === 0 && (
                    <p className="text-sm text-slate-500">No cafe orders.</p>
                  )}
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <p className="text-sm font-semibold text-slate-950">
                  Accessories
                </p>
                <div className="mt-3 space-y-2">
                  {getAccessoryItems(selectedRecord).map((item, index) => (
                    <div key={`${item.itemId}-${index}`} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      <span>{item.name.replace("[Accessory]", "").trim()} x{item.quantity}</span>
                      <strong>{formatCurrency(item.subtotal)}</strong>
                    </div>
                  ))}
                  {getAccessoryItems(selectedRecord).length === 0 && (
                    <p className="text-sm text-slate-500">No accessories.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-lg border p-4">
              <p className="text-sm font-semibold text-slate-950">
                Timeline
              </p>
              <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                <p>Created: {formatDateTime(selectedRecord.createdAt)}</p>
                <p>Updated: {formatDateTime(selectedRecord.updatedAt)}</p>
                <p>Started: {formatDateTime(selectedRecord.startedAt)}</p>
                <p>Ended: {formatDateTime(selectedRecord.endedAt)}</p>
                <p>Paid: {selectedRecord.paidAt ? formatDateTime(selectedRecord.paidAt) : "-"}</p>
                <p>Cancelled: {selectedRecord.cancelledAt ? formatDateTime(selectedRecord.cancelledAt) : "-"}</p>
              </div>
            </div>

          </Card>
        )}
      </div>
    </PageShell>
  );
}

export default TableHistoryPage;
