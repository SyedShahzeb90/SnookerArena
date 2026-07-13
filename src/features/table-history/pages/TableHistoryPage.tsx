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

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  getWalkInDisplayName,
  isWalkInName,
} from "@/features/sessions/utils/walkInLabel";

import { useTableHistoryStore } from "../store/tableHistoryStore";
import type {
  TableHistoryPaymentStatus,
  TableHistoryRecord,
} from "../types/tableHistory";

type DateFilter =
  | "today"
  | "yesterday"
  | "this-week"
  | "this-month"
  | "custom";

function formatCurrency(amount: number) {
  return `Rs. ${amount}`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(
    "en-PK",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(
    "en-PK",
    {
      dateStyle: "medium",
    }
  );
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString(
    "en-PK",
    {
      hour: "numeric",
      minute: "2-digit",
    }
  );
}

function getRecordBillNo(record: TableHistoryRecord) {
  return (
    record.billNo ??
    record.displayToken ??
    record.customerToken ??
    record.staffBillNumber ??
    record.invoiceNumber ??
    getRecordDisplayName(
      record,
      record.payerName ?? record.players[0]
    )
  );
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

function getSimpleDisplayName(name?: string | null) {
  return isWalkInName(name)
    ? "Walk-in Customer"
    : name?.trim() ?? "";
}

function getRecordCustomerPlayersLabel(record: TableHistoryRecord) {
  if (record.sessionType === "double") {
    const teamA =
      record.teamAPlayers?.filter(Boolean) ?? [];
    const teamB =
      record.teamBPlayers?.filter(Boolean) ?? [];

    if (teamA.length || teamB.length) {
      return [teamA.join("/"), teamB.join("/")]
        .filter(Boolean)
        .join(" vs ");
    }
  }

  if (
    record.sessionType === "time" ||
    record.sessionType === "private"
  ) {
    return (
      getSimpleDisplayName(record.players[0]) ||
      "Walk-in Customer"
    );
  }

  const players = record.players
    .map(getSimpleDisplayName)
    .filter(Boolean);

  if (players.every((player) => player === "Walk-in Customer")) {
    return "Walk-in Customer";
  }

  return players.join(" vs ") || "Walk-in Customer";
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
    getRecordBillNo(record),
    record.tableName,
    record.sessionType,
    getRecordTypeLabel(record),
    record.payerName,
    getRecordDisplayName(record, record.payerName),
    record.winnerName,
    getRecordDisplayName(record, record.winnerName),
    record.loserName,
    getRecordDisplayName(record, record.loserName),
    record.cancelledReason,
    record.cancelledNote,
    ...record.players,
    getRecordPlayersLabel(record),
    getRecordCustomerPlayersLabel(record),
    ...record.cafeItems.map(
      (item) =>
        item.customerName ??
        item.playerName ??
        item.name
    ),
    ...record.cafeItems.map((item) =>
      getRecordDisplayName(
        record,
        item.customerName ??
          item.playerName
      )
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

function getRecordDisplayName(
  record: TableHistoryRecord,
  name?: string | null
) {
  return getWalkInDisplayName({
    name,
    tableId: record.tableId,
    tableName: record.tableName,
    tableType: record.tableType,
    time: record.startedAt,
  });
}

function getRecordPlayersLabel(
  record: TableHistoryRecord
) {
  return record.players
    .map((player) =>
      getRecordDisplayName(record, player)
    )
    .join(", ");
}

function paymentBadgeVariant(
  status: TableHistoryPaymentStatus
) {
  if (status === "paid") {
    return "default";
  }

  if (status === "cancelled") {
    return "destructive";
  }

  return "secondary";
}

function TableHistoryPage() {
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
  const [statusFilter, setStatusFilter] =
    useState("all");
  const [sessionTypeFilter, setSessionTypeFilter] =
    useState("all");
  const [search, setSearch] = useState("");
  const [selectedRecord, setSelectedRecord] =
    useState<TableHistoryRecord | null>(
      null
    );

  const filteredRecords = useMemo(() => {
    const { start, end } = getDateRange(
      dateFilter,
      customStart,
      customEnd
    );

    return records
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
        statusFilter === "all"
          ? true
          : record.paymentStatus ===
            statusFilter
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
    statusFilter,
    sessionTypeFilter,
    search,
  ]);

  const summary = useMemo(
    () =>
      filteredRecords.reduce(
        (totals, record) => {
          const countsForMoney =
            record.paymentStatus !==
            "cancelled";

          return {
            sessions: totals.sessions + 1,
            tableBill:
              totals.tableBill +
              (countsForMoney
                ? record.tableAmount
                : 0),
            cafeBill:
              totals.cafeBill +
              (countsForMoney
                ? record.cafeAmount
                : 0),
            grandTotal:
              totals.grandTotal +
              (countsForMoney
                ? record.grandTotal
                : 0),
          };
        },
        {
          sessions: 0,
          tableBill: 0,
          cafeBill: 0,
          grandTotal: 0,
        }
      ),
    [filteredRecords]
  );

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8">
      <div className="mx-auto max-w-7xl">
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
                Review ended sessions, bills, payments, and cafe items.
              </p>
            </div>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-4">
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
              Table Bill
            </p>
            <p className="mt-3 text-2xl font-bold text-slate-950">
              {formatCurrency(summary.tableBill)}
            </p>
          </Card>

          <Card className="p-5">
            <p className="text-sm text-slate-500">
              Cafe Bill
            </p>
            <p className="mt-3 text-2xl font-bold text-slate-950">
              {formatCurrency(summary.cafeBill)}
            </p>
          </Card>

          <Card className="p-5">
            <p className="text-sm text-slate-500">
              Grand Total
            </p>
            <p className="mt-3 text-2xl font-bold text-emerald-700">
              {formatCurrency(summary.grandTotal)}
            </p>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <div className="border-b p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
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
                    placeholder="Player, payer, winner, loser, cafe customer..."
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
                  Status
                </p>
                <Select
                  value={statusFilter}
                  onValueChange={(value) =>
                    setStatusFilter(value ?? "all")
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      All Status
                    </SelectItem>
                    <SelectItem value="pending">
                      Pending
                    </SelectItem>
                    <SelectItem value="paid">
                      Paid
                    </SelectItem>
                    <SelectItem value="cancelled">
                      Cancelled
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
            <table className="w-full min-w-[1040px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="min-w-36 whitespace-nowrap px-4 py-3">
                    Bill No
                  </th>
                  <th className="px-4 py-3">
                    Date / Time
                  </th>
                  <th className="px-4 py-3">
                    Table
                  </th>
                  <th className="px-4 py-3">
                    Type
                  </th>
                  <th className="px-4 py-3">
                    Customer / Players
                  </th>
                  <th className="px-4 py-3">
                    Duration
                  </th>
                  <th className="px-4 py-3">
                    Table Bill
                  </th>
                  <th className="px-4 py-3">
                    Cafe Bill
                  </th>
                  <th className="px-4 py-3">
                    Total
                  </th>
                  <th className="px-4 py-3">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredRecords.map((record) => (
                  <tr
                    key={record.id}
                    className="bg-white"
                  >
                    <td className="min-w-36 whitespace-nowrap px-4 py-3 font-semibold">
                      {getRecordBillNo(record)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="whitespace-nowrap">
                        <p>{formatDate(record.endedAt)}</p>
                        <p className="text-xs text-slate-500">
                          {formatTime(record.endedAt)}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {record.tableName}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {getRecordTypeLabel(record)}
                    </td>
                    <td
                      className="max-w-[260px] truncate px-4 py-3"
                      title={getRecordCustomerPlayersLabel(
                        record
                      )}
                    >
                      {getRecordCustomerPlayersLabel(
                        record
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {formatDuration(
                        record.durationMinutes
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {formatCurrency(
                        record.tableAmount
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {formatCurrency(
                        record.cafeAmount
                      )}
                    </td>
                    <td className="px-4 py-3 font-bold">
                      {formatCurrency(
                        record.grandTotal
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={paymentBadgeVariant(
                          record.paymentStatus
                        )}
                        className="capitalize"
                      >
                        {record.paymentStatus}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() =>
                          setSelectedRecord(
                            record
                          )
                        }
                      >
                        <Eye className="h-4 w-4" />
                        View Details
                      </Button>
                    </td>
                  </tr>
                ))}

                {filteredRecords.length === 0 && (
                  <tr>
                    <td
                      colSpan={11}
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
                <p className="text-sm text-slate-500">
                  Customer / Players:{" "}
                  {getRecordCustomerPlayersLabel(
                    selectedRecord
                  )}
                </p>
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

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-lg border p-4">
                <p className="text-sm font-semibold text-slate-950">
                  Session
                </p>
                <div className="mt-3 space-y-2 text-sm text-slate-600">
                  <p>
                    Bill No:{" "}
                    {getRecordBillNo(selectedRecord)}
                  </p>
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
                    Players / Teams:{" "}
                    {getRecordCustomerPlayersLabel(
                      selectedRecord
                    )}
                  </p>
                  <p>
                    Winner:{" "}
                    {selectedRecord.winnerName
                      ? getRecordDisplayName(
                          selectedRecord,
                          selectedRecord.winnerName
                        )
                      : "-"}
                  </p>
                  <p>
                    Loser:{" "}
                    {selectedRecord.loserName
                      ? getRecordDisplayName(
                          selectedRecord,
                          selectedRecord.loserName
                        )
                      : "-"}
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
                  <p>
                    Payer:{" "}
                    {selectedRecord.payerName
                      ? getRecordDisplayName(
                          selectedRecord,
                          selectedRecord.payerName
                        )
                      : "-"}
                  </p>
                  <p className="capitalize">
                    Status:{" "}
                    {selectedRecord.paymentStatus}
                  </p>
                  {selectedRecord.paymentStatus ===
                    "cancelled" && (
                    <>
                      <p>
                        Cancelled At:{" "}
                        {selectedRecord.cancelledAt
                          ? formatDateTime(
                              selectedRecord.cancelledAt
                            )
                          : "-"}
                      </p>
                      <p>
                        Cancelled Reason:{" "}
                        {selectedRecord.cancelledReason ??
                          "-"}
                      </p>
                      <p>
                        Cancelled Note:{" "}
                        {selectedRecord.cancelledNote ??
                          "-"}
                      </p>
                    </>
                  )}
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <p className="text-sm font-semibold text-slate-950">
                  Billing
                </p>
                <div className="mt-3 space-y-2 text-sm text-slate-600">
                  <p>
                    Table Bill:{" "}
                    {formatCurrency(
                      selectedRecord.tableAmount
                    )}
                  </p>
                  <p>
                    Cafe Bill:{" "}
                    {formatCurrency(
                      selectedRecord.cafeAmount
                    )}
                  </p>
                  <p>
                    Accessories Bill:{" "}
                    {formatCurrency(0)}
                  </p>
                  <p>
                    Discount:{" "}
                    {formatCurrency(
                      selectedRecord.discount
                    )}
                  </p>
                  <p className="font-bold text-slate-950">
                    Total:{" "}
                    {formatCurrency(
                      selectedRecord.grandTotal
                    )}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <p className="text-sm font-semibold text-slate-950">
                  Cafe Items
                </p>
                <div className="mt-3 space-y-2 text-sm text-slate-600">
                  {selectedRecord.cafeItems.length >
                  0 ? (
                    selectedRecord.cafeItems.map(
                      (item, index) => (
                        <div
                          key={`${item.itemId}-${index}`}
                          className="rounded-lg bg-slate-50 p-2"
                        >
                          <div className="flex justify-between gap-3 font-medium text-slate-950">
                            <span>{item.name}</span>
                            <span>
                              {formatCurrency(
                                item.subtotal
                              )}
                            </span>
                          </div>
                          <div className="mt-1 flex justify-between gap-3 text-xs text-slate-500">
                            <span>
                              {getRecordDisplayName(
                                selectedRecord,
                                item.playerName ??
                                  item.customerName
                              )}
                            </span>
                            <span>
                              {item.quantity} x{" "}
                              {formatCurrency(
                                item.price
                              )}
                            </span>
                          </div>
                        </div>
                      )
                    )
                  ) : (
                    <p>No cafe items.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-lg border p-4">
              <p className="text-sm font-semibold text-slate-950">
                Player Breakdown
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                {selectedRecord.playerBreakdown.map(
                  (player) => (
                    <div
                      key={player.playerName}
                      className="rounded-lg bg-slate-50 p-3 text-sm"
                    >
                      <div className="mb-2 flex justify-between font-semibold text-slate-950">
                        <span>
                          {getRecordDisplayName(
                            selectedRecord,
                            player.playerName
                          )}
                        </span>
                        <span>
                          {formatCurrency(
                            player.totalAmount
                          )}
                        </span>
                      </div>
                      <p>
                        Table:{" "}
                        {formatCurrency(
                          player.tableAmountShare
                        )}
                      </p>
                      <p>
                        Cafe:{" "}
                        {formatCurrency(
                          player.cafeAmount
                        )}
                      </p>
                    </div>
                  )
                )}
              </div>
            </div>
          </Card>
        )}
      </div>
    </main>
  );
}

export default TableHistoryPage;
