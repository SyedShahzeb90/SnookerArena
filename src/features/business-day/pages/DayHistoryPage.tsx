import {
  ArrowLeft,
  CalendarDays,
  Eye,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useCheckoutStore } from "@/features/billing/store/checkoutStore";
import { useExpensesStore } from "@/features/expenses/store/expensesStore";
import { useSalesStore } from "@/features/sales/store/salesStore";
import { useOutsidePurchaseStore } from "@/features/outside-purchases/store/outsidePurchaseStore";
import { useCafeStore } from "@/features/cafe/store/cafeStore";
import { formatAppDateTime, useAppDateTimeFormats } from "@/lib/dateTime";

import { useBusinessDayStore } from "../store/businessDayStore";
import { calculateBusinessDaySummary } from "../utils/businessDaySummary";
import {
  paymentMethodLabels,
  type BusinessDay,
} from "../types/businessDay";

type DateFilter =
  | "today"
  | "yesterday"
  | "this-week"
  | "this-month"
  | "custom";

function money(value: number) {
  return `Rs. ${value}`;
}

function formatDate(value?: string) {
  return formatAppDateTime(value);
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
  const end = endOfDay(now);

  if (filter === "yesterday") {
    const day = new Date(now);
    day.setDate(day.getDate() - 1);
    return {
      start: startOfDay(day),
      end: endOfDay(day),
    };
  }

  if (filter === "this-week") {
    const start = startOfDay(now);
    start.setDate(
      start.getDate() - start.getDay()
    );
    return { start, end };
  }

  if (filter === "this-month") {
    return {
      start: new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      ),
      end,
    };
  }

  if (filter === "custom") {
    return {
      start: customStart
        ? startOfDay(new Date(customStart))
        : new Date(0),
      end: customEnd
        ? endOfDay(new Date(customEnd))
        : end,
    };
  }

  return {
    start: startOfDay(now),
    end,
  };
}

function DayHistoryPage() {
  useAppDateTimeFormats();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin =
    location.pathname.startsWith("/admin");
  const dashboardPath = isAdmin
    ? "/admin"
    : "/operator/business-day";

  const days = useBusinessDayStore(
    (state) => state.days
  );
  const sales = useSalesStore(
    (state) => state.sales
  );
  const expenses = useExpensesStore(
    (state) => state.expenses
  );
  const pendingBills = useCheckoutStore(
    (state) => state.pendingBills
  );
  const outsidePurchases = useOutsidePurchaseStore(
    (state) => state.purchases
  );
  const vendorRestockingRecords = useCafeStore((state) => state.vendorRestockingRecords);

  const [dateFilter, setDateFilter] =
    useState<DateFilter>("this-month");
  const [customStart, setCustomStart] =
    useState("");
  const [customEnd, setCustomEnd] =
    useState("");
  const [statusFilter, setStatusFilter] =
    useState("all");
  const [search, setSearch] = useState("");
  const [selectedDay, setSelectedDay] =
    useState<BusinessDay | null>(null);

  const rows = useMemo(() => {
    const { start, end } = getDateRange(
      dateFilter,
      customStart,
      customEnd
    );
    const query = search
      .trim()
      .toLowerCase();

    return days
      .filter((day) => {
        const startedAt = new Date(
          day.startedAt
        );
        return (
          startedAt >= start && startedAt <= end
        );
      })
      .filter((day) =>
        statusFilter === "all"
          ? true
          : day.status === statusFilter
      )
      .filter((day) =>
        query
          ? `${day.openedBy} ${day.closedBy ?? ""} ${day.dayName}`
              .toLowerCase()
              .includes(query)
          : true
      )
      .sort(
        (a, b) =>
          new Date(b.startedAt).getTime() -
          new Date(a.startedAt).getTime()
      );
  }, [
    days,
    dateFilter,
    customStart,
    customEnd,
    statusFilter,
    search,
  ]);

  const detailPayments =
    selectedDay
      ? sales.filter(
          (sale) =>
            sale.activeBusinessDayId ===
            selectedDay.id
        )
      : [];
  const detailExpenses =
    selectedDay
      ? expenses.filter(
          (expense) =>
            expense.activeBusinessDayId ===
            selectedDay.id
        )
      : [];

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8">
      <div className="mx-auto max-w-7xl">
        <Button
          variant="ghost"
          className="mb-4 gap-2"
          onClick={() => navigate(dashboardPath)}
        >
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Button>

        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-slate-700 shadow-sm ring-1 ring-slate-200">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-950">
              Day History
            </h1>
            <p className="text-sm text-slate-500">
              Review business day sales, expenses, pending bills, and cash handover.
            </p>
          </div>
        </div>

        <Card className="overflow-hidden">
          <div className="space-y-3 border-b p-4">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search operator name"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
              />
            </div>

            <div className="flex flex-wrap gap-2">
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
                      : "outline"
                  }
                  onClick={() =>
                    setDateFilter(value)
                  }
                >
                  {label}
                </Button>
              ))}

              {["all", "active", "closed"].map(
                (status) => (
                  <Button
                    key={status}
                    variant={
                      statusFilter === status
                        ? "default"
                        : "outline"
                    }
                    onClick={() =>
                      setStatusFilter(status)
                    }
                    className="capitalize"
                  >
                    {status}
                  </Button>
                )
              )}
            </div>

            {dateFilter === "custom" && (
              <div className="grid gap-3 md:grid-cols-2">
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
            <table className="w-full min-w-[1300px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  {[
                    "Day",
                    "Started",
                    "Ended",
                    "Opened By",
                    "Closed By",
                    "Opening Cash",
                    "Total Sales",
                    "Table Sales",
                    "Cafe Sales",
                    "Expenses",
                    "Customer Outside Purchases",
                    "Cash Reimbursements",
                    "Digital Reimbursements",
                    "Outstanding Reimbursements",
                    "Net Profit",
                    "Expected Cash",
                    "Actual Cash",
                    "Left for Staff",
                    "Taken Home",
                    "Difference",
                    "Pending Bills",
                    "Status",
                    "Action",
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="px-4 py-3"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((day) => {
                  const summary =
                    day.status === "active"
                      ? calculateBusinessDaySummary({
                          day,
                          sales,
                          expenses,
                          pendingBills,
                          outsidePurchases,
                          vendorRestockingRecords,
                        })
                      : day;

                  return (
                    <tr
                      key={day.id}
                      className="bg-white"
                    >
                      <td className="px-4 py-3 font-semibold">
                        {day.dayName}
                      </td>
                      <td className="px-4 py-3">
                        {formatDate(day.startedAt)}
                      </td>
                      <td className="px-4 py-3">
                        {formatDate(day.endedAt)}
                      </td>
                      <td className="px-4 py-3">
                        {day.openedBy}
                      </td>
                      <td className="px-4 py-3">
                        {day.closedBy ?? "-"}
                      </td>
                      <td className="px-4 py-3">
                        {money(day.openingCash)}
                      </td>
                      <td className="px-4 py-3">
                        {money(summary.totalSales)}
                      </td>
                      <td className="px-4 py-3">
                        {money(summary.tableSales)}
                      </td>
                      <td className="px-4 py-3">
                        {money(summary.cafeSales)}
                      </td>
                      <td className="px-4 py-3">
                        {money(summary.totalExpenses)}
                      </td>
                      <td className="px-4 py-3">
                        {money(summary.outsidePurchasesPaidFromDrawer ?? 0)}
                      </td>
                      <td className="px-4 py-3">
                        {money(summary.cashCustomerReimbursements ?? 0)}
                      </td>
                      <td className="px-4 py-3">
                        {money(summary.digitalCustomerReimbursements ?? 0)}
                      </td>
                      <td className="px-4 py-3">
                        {money(summary.outstandingCustomerReimbursements ?? 0)}
                      </td>
                      <td className="px-4 py-3 font-bold">
                        {money(summary.netProfit)}
                      </td>
                      <td className="px-4 py-3">
                        {money(summary.expectedCash)}
                      </td>
                      <td className="px-4 py-3">
                        {day.actualCashCounted !==
                        undefined
                          ? money(
                              day.actualCashCounted
                            )
                          : "-"}
                      </td>
                      <td className="px-4 py-3">
                        {day.cashLeftForStaff !==
                        undefined
                          ? money(
                              day.cashLeftForStaff
                            )
                          : "-"}
                      </td>
                      <td className="px-4 py-3">
                        {day.cashTakenHome !==
                        undefined
                          ? money(
                              day.cashTakenHome
                            )
                          : "-"}
                      </td>
                      <td className="px-4 py-3">
                        {day.cashDifference !==
                        undefined
                          ? money(
                              day.cashDifference
                            )
                          : "-"}
                      </td>
                      <td className="px-4 py-3">
                        {summary.pendingBillsCount} /{" "}
                        {money(
                          summary.pendingBillsAmount
                        )}
                      </td>
                      <td className="px-4 py-3 capitalize">
                        {day.status}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() =>
                            setSelectedDay(day)
                          }
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </Button>
                      </td>
                    </tr>
                  );
                })}

                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={23}
                      className="px-4 py-10 text-center text-slate-500"
                    >
                      No day history found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {selectedDay && (
          <Card className="mt-5 p-5">
            <div className="mb-4 flex justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">
                  {selectedDay.dayName}
                </h2>
                <p className="text-sm text-slate-500">
                  Opened by {selectedDay.openedBy}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() =>
                  setSelectedDay(null)
                }
              >
                Close
              </Button>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <h3 className="mb-2 font-bold">
                  Payments
                </h3>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2">
                          Invoice
                        </th>
                        <th className="px-3 py-2">
                          Time
                        </th>
                        <th className="px-3 py-2">
                          Table/Customer
                        </th>
                        <th className="px-3 py-2">
                          Payment
                        </th>
                        <th className="px-3 py-2">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailPayments.map((sale) => (
                        <tr
                          key={sale.id}
                          className="border-t"
                        >
                          <td className="px-3 py-2">
                            {sale.invoiceNumber}
                          </td>
                          <td className="px-3 py-2">
                            {formatDate(
                              sale.paidAt ??
                                sale.createdAt
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {sale.tableName === "-"
                              ? sale.payerName
                              : sale.tableName}
                          </td>
                          <td className="px-3 py-2">
                            {
                              paymentMethodLabels[
                                sale.paymentMethod
                              ]
                            }
                          </td>
                          <td className="px-3 py-2 font-bold">
                            {money(
                              sale.grandTotal
                            )}
                          </td>
                        </tr>
                      ))}
                      {detailPayments.length ===
                        0 && (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-3 py-8 text-center text-slate-500"
                          >
                            No payments.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="mb-2 font-bold">
                  Expenses
                </h3>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2">
                          Time
                        </th>
                        <th className="px-3 py-2">
                          Category
                        </th>
                        <th className="px-3 py-2">
                          Payment
                        </th>
                        <th className="px-3 py-2">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailExpenses.map(
                        (expense) => (
                          <tr
                            key={expense.id}
                            className="border-t"
                          >
                            <td className="px-3 py-2">
                              {formatDate(
                                expense.expenseDate
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {expense.category}
                            </td>
                            <td className="px-3 py-2 capitalize">
                              {expense.paymentMethod ??
                                "cash"}
                            </td>
                            <td className="px-3 py-2 font-bold text-red-700">
                              {money(
                                expense.amount
                              )}
                            </td>
                          </tr>
                        )
                      )}
                      {detailExpenses.length ===
                        0 && (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-3 py-8 text-center text-slate-500"
                          >
                            No expenses.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-lg border bg-slate-50 p-4">
              <h3 className="font-bold">
                Pending Bills Now
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                {
                  pendingBills.filter(
                    (bill) =>
                      bill.status !== "cancelled"
                  ).length
                } pending bills are currently open. Pending bills are not counted as sales until payment is received.
              </p>
            </div>
          </Card>
        )}
      </div>
    </main>
  );
}

export default DayHistoryPage;
