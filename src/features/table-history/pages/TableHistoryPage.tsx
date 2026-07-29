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

function formatCurrency(amount: number) {
  return `Rs. ${amount}`;
}

function formatDateTime(value: string) {
  return formatAppDateTime(value);
}

function formatDate(value: string) {
  return formatAppDate(value);
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

function getDisplayRows(
  record: TableHistoryRecord
): HistoryDisplayRow[] {
  const lines = getRecordChargeLines(record);
  const labelCounts = new Map<string, number>();

  lines.forEach((line) => {
    const label = getChargeLineTypeLabel(line, record);
    labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
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
      ).length,
      doubleGames: lines.filter(
        (line) => line.type === "doubleGame"
      ).length,
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

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function getDateRange(
  filter: DateFilter,
  customStart: string,
  customEnd: string
) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  if (filter === "yesterday") {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    return {
      start: startOfDay(yesterday),
      end: endOfDay(yesterday),
    };
  }

  if (filter === "this-week") {
    const start = startOfDay(now);
    start.setDate(
      now.getDate() - now.getDay()
    );

    return { start, end: todayEnd };
  }

  if (filter === "this-month") {
    return {
      start: new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      ),
      end: todayEnd,
    };
  }

  if (filter === "custom") {
    return {
      start: customStart
        ? startOfDay(new Date(customStart))
        : new Date(0),
      end: customEnd
        ? endOfDay(new Date(customEnd))
        : todayEnd,
    };
  }

  return {
    start: todayStart,
    end: todayEnd,
  };
}

function matchesSearch(
  record: TableHistoryRecord,
  query: string
) {
  if (!query.trim()) return true;

  const search = query
    .trim()
    .toLowerCase();
  const values = [
    record.tableName,
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
  const [search, setSearch] = useState("");
  const [historyView, setHistoryView] = useState<
    "sessions" | "earnings"
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
        matchesSearch(record, search)
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
    search,
  ]);

  const summary = useMemo(
    () =>
      filteredRecords.reduce(
        (totals, record) => {
          const chargeLines =
            getRecordChargeLines(record);
          const singleGames =
            chargeLines.length > 0
              ? chargeLines.filter(
                  (line) =>
                    line.type === "singleGame"
                ).length
              : record.sessionType === "single"
                ? 1
                : 0;
          const doubleGames =
            chargeLines.length > 0
              ? chargeLines.filter(
                  (line) =>
                    line.type === "doubleGame"
                ).length
              : record.sessionType === "double"
                ? 1
                : 0;
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
      const lines = getRecordChargeLines(record);

      current.sessions += 1;
      current.amount += record.tableAmount;
      current.singleGames += lines.length
        ? lines.filter((line) => line.type === "singleGame").length
        : record.sessionType === "single"
          ? 1
          : 0;
      current.doubleGames += lines.length
        ? lines.filter((line) => line.type === "doubleGame").length
        : record.sessionType === "double"
          ? 1
          : 0;
      current.bookings += lines.length
        ? lines.filter((line) => line.type === "tableBooking").length
        : record.sessionType === "time" || record.sessionType === "private"
          ? 1
          : 0;
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
            navigate(isAdmin ? "/admin" : "/operator")
          }
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Dashboard
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

        <div className="mb-5 flex gap-2">
          <Button
            type="button"
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
            variant={historyView === "earnings" ? "default" : "outline"}
            onClick={() => {
              setHistoryView("earnings");
              setSelectedRecord(null);
            }}
          >
            Earnings by Table
          </Button>
        </div>

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
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
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
                    placeholder="Search table or game type..."
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

          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="w-20 whitespace-nowrap px-4 py-3">
                    No.
                  </th>
                  <th className="px-4 py-3">
                    Date / Start - End
                  </th>
                  <th className="px-4 py-3">
                    Table
                  </th>
                  <th className="px-4 py-3">
                    Type
                  </th>
                  <th className="px-4 py-3">
                    Duration
                  </th>
                  <th className="px-4 py-3">
                    Table Earnings
                  </th>
                  <th className="px-4 py-3 text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {displayRows.map((row, index) => (
                  <tr
                    key={row.rowId}
                    className="bg-white"
                  >
                    <td className="w-20 whitespace-nowrap px-4 py-3 font-semibold">
                      {index + 1}
                    </td>
                    <td className="px-4 py-3">
                      <div className="whitespace-nowrap">
                        <p>{formatDate(row.endedAt)}</p>
                        <p className="text-xs text-slate-500">
                          {formatTime(row.startedAt)} -{" "}
                          {formatTime(row.endedAt)}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {row.record.tableName}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {row.typeLabel}
                    </td>
                    <td className="px-4 py-3">
                      {formatDuration(
                        row.durationMinutes
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {formatCurrency(
                        row.tableAmount
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() =>
                          setSelectedRecord(
                            row.record
                          )
                        }
                      >
                        <Eye className="h-4 w-4" />
                        View Details
                      </Button>
                    </td>
                  </tr>
                ))}

                {displayRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-12 text-center text-slate-500"
                    >
                      No table history found.
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
                  Session
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
                  Table Earnings
                </p>
                <div className="mt-3 space-y-2 text-sm text-slate-600">
                  <p>
                    Session Earnings:{" "}
                    {formatCurrency(
                      selectedRecord.tableAmount
                    )}
                  </p>
                </div>
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
                              : `Game ${index + 1}`} · {getChargeLineTypeLabel(line, selectedRecord)}
                          </strong>
                          <span className="text-slate-500">
                            {formatChargeTimeRange(line.startedAt, line.endedAt, selectedRecord.startedAt)} · {formatChargeDuration(line.startedAt, line.endedAt)}
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

          </Card>
        )}
      </div>
    </PageShell>
  );
}

export default TableHistoryPage;
