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
import type { PendingBill } from "@/features/billing/store/checkoutStore";
import { useCheckoutStore } from "@/features/billing/store/checkoutStore";
import { useExpensesStore } from "@/features/expenses/store/expensesStore";
import type { Sale } from "@/features/sales/types/sale";
import { useSalesStore } from "@/features/sales/store/salesStore";
import { useOutsidePurchaseStore } from "@/features/outside-purchases/store/outsidePurchaseStore";
import { useCafeStore } from "@/features/cafe/store/cafeStore";
import { useStaffPayrollStore } from "@/features/staff-payroll/store/staffPayrollStore";
import { formatAppDateTime, useAppDateTimeFormats } from "@/lib/dateTime";

import { useBusinessDayStore } from "../store/businessDayStore";
import {
  calculateBusinessDaySummary,
  getRemainingPendingBillTotal,
} from "../utils/businessDaySummary";
import {
  paymentMethodLabels,
  type BusinessDay,
  type BusinessDaySummary,
} from "../types/businessDay";

type DateFilter =
  | "today"
  | "yesterday"
  | "this-week"
  | "this-month"
  | "custom";

function money(value: number) {
  return `Rs. ${Math.round(value).toLocaleString()}`;
}

function formatDate(value?: string) {
  return formatAppDateTime(value);
}

function getDigitalSales(day: BusinessDaySummary) {
  return (
    day.cardSales +
    day.jazzCashSales +
    day.easypaisaSales
  );
}

function getDaySummaryStatus(day: BusinessDay) {
  return day.status === "active"
    ? "In progress"
    : "Closed";
}

function getDurationLabel(start?: string | Date, end?: string | Date) {
  if (!start || !end) return "-";
  const minutes = Math.max(
    0,
    Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000)
  );
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}

function getDifferenceClass(value?: number) {
  if (value === undefined) return "text-slate-700";
  if (value === 0) return "text-emerald-700";
  if (value > 0) return "text-blue-700";
  return "text-red-700";
}

function getPaymentLabel(sale: Sale) {
  if (sale.paymentSplits?.length) {
    return sale.paymentSplits
      .map((split) => paymentMethodLabels[split.method])
      .join(" + ");
  }
  return paymentMethodLabels[sale.paymentMethod];
}

function getPaymentBadgeClass(method: string) {
  if (method.includes("Cash")) return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  if (method.includes("Card")) return "bg-blue-50 text-blue-700 ring-1 ring-blue-200";
  if (method.includes("Easypaisa")) return "bg-teal-50 text-teal-700 ring-1 ring-teal-200";
  if (method.includes("JazzCash")) return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
  return "bg-violet-50 text-violet-700 ring-1 ring-violet-200";
}

function getSaleOperator(sale: Sale) {
  return (
    sale.paymentReceivedBy?.operatorName ??
    sale.operatorAudit?.find((event) => event.action === "payment_received")
      ?.operator.operatorName ??
    "Not recorded"
  );
}

function statusBadgeClass(status: string) {
  if (status === "paid") return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  if (status === "pending") return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
  if (status === "cancelled" || status === "refunded") return "bg-red-50 text-red-700 ring-1 ring-red-200";
  if (status === "credit") return "bg-blue-50 text-blue-700 ring-1 ring-blue-200";
  return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
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
    : "/operator/tables-rooms";

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
  const salaryAdvances = useStaffPayrollStore((state) => state.salaryAdvances);
  const salaryPayments = useStaffPayrollStore((state) => state.salaryPayments);

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
  const [selectedPayment, setSelectedPayment] =
    useState<Sale | null>(null);
  const [selectedPendingBill, setSelectedPendingBill] =
    useState<PendingBill | null>(null);

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

  const detailPayments = useMemo(
    () =>
      selectedDay
        ? sales.filter(
            (sale) =>
              sale.activeBusinessDayId ===
              selectedDay.id
          )
        : [],
    [sales, selectedDay]
  );
  const detailExpenses = useMemo(
    () =>
      selectedDay
        ? expenses.filter(
            (expense) =>
              expense.activeBusinessDayId ===
              selectedDay.id
          )
        : [],
    [expenses, selectedDay]
  );
  const currentPendingBills = useMemo(
    () =>
      pendingBills.filter(
        (bill) => bill.status !== "cancelled"
      ),
    [pendingBills]
  );
  const selectedDaySummary =
    selectedDay?.status === "active"
      ? calculateBusinessDaySummary({
          day: selectedDay,
          sales,
          expenses,
          pendingBills,
          outsidePurchases,
          vendorRestockingRecords,
          salaryAdvances,
          salaryPayments,
        })
      : selectedDay;
  const selectedAccessoryRevenue = detailPayments.reduce(
    (total, sale) =>
      total +
      sale.orderedItems
        .filter((item) => item.name.startsWith("[Accessory]"))
        .reduce((itemTotal, item) => itemTotal + item.subtotal, 0),
    0
  );
  const selectedMixedPayments = detailPayments.filter(
    (sale) => sale.paymentSplits?.length
  ).length;

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8">
      <div className="mx-auto max-w-7xl">
        <Button
          variant="ghost"
          className="mb-4 gap-2"
          onClick={() => navigate(dashboardPath)}
        >
          <ArrowLeft className="h-4 w-4" />
          {isAdmin ? "Back to Admin Dashboard" : "Tables & Rooms"}
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

          <div className="overflow-hidden">
            <table className="w-full table-fixed text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  {[
                    "Day",
                    "Open Time",
                    "Close Time",
                    "Operator",
                    "Total Sales",
                    "Cash",
                    "Digital",
                    "Expenses",
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
                          salaryAdvances,
                          salaryPayments,
                        })
                      : day;

                  return (
                    <tr
                      key={day.id}
                      className={`bg-white transition-colors hover:bg-slate-50 ${
                        selectedDay?.id === day.id
                          ? "bg-slate-50 ring-1 ring-inset ring-slate-300"
                          : ""
                      }`}
                    >
                      <td className="px-4 py-4 align-top">
                        <p className="font-bold text-slate-950">
                          {day.dayName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatDate(day.startedAt)}
                        </p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <p className="font-medium text-slate-950">
                          {formatDate(day.startedAt)}
                        </p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <p className="text-xs text-slate-500">
                          {day.endedAt
                            ? formatDate(day.endedAt)
                            : "Still open"}
                        </p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <p className="font-semibold text-slate-950">
                          {day.openedBy}
                        </p>
                        <p className="text-xs text-slate-500">
                          Closed by {day.closedBy ?? "-"}
                        </p>
                      </td>
                      <td className="px-4 py-4 align-top font-bold text-emerald-700">
                        {money(summary.totalSales)}
                      </td>
                      <td className="px-4 py-4 align-top">
                        {money(summary.cashSales)}
                      </td>
                      <td className="px-4 py-4 align-top">
                        {money(getDigitalSales(summary))}
                      </td>
                      <td className="px-4 py-4 align-top text-red-700">
                        {money(summary.totalExpenses)}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <p className="font-medium">
                          {summary.pendingBillsCount}
                        </p>
                        <p className="text-xs text-slate-500">
                          {money(summary.pendingBillsAmount)}
                        </p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          day.status === "active"
                            ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                            : "bg-slate-100 text-slate-700 ring-1 ring-slate-200"
                        }`}>
                          {getDaySummaryStatus(day)}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() =>
                            setSelectedDay(day)
                          }
                        >
                          <Eye className="h-4 w-4" />
                          Details
                        </Button>
                      </td>
                    </tr>
                  );
                })}

                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={11}
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

        {selectedDay && selectedDaySummary && (
          <Card className="mt-5 p-5">
            <div className="mb-5 flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-bold">
                  {selectedDay.dayName}
                </h2>
                <p className="text-sm text-slate-500">
                  Opened by {selectedDay.openedBy} on {formatDate(selectedDay.startedAt)}
                  {selectedDay.endedAt ? ` · Closed ${formatDate(selectedDay.endedAt)}` : " · Still open"}
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

            <div className="mb-5 grid gap-3 md:grid-cols-4">
              {[
                ["Total Sales", money(selectedDaySummary.totalSales), "text-emerald-700"],
                ["Cash Sales", money(selectedDaySummary.cashSales), "text-emerald-700"],
                ["Digital Sales", money(getDigitalSales(selectedDaySummary)), "text-blue-700"],
                [
                  "Net Profit",
                  money(selectedDaySummary.netProfit),
                  selectedDaySummary.netProfit >= 0 ? "text-emerald-700" : "text-red-700",
                ],
              ].map(([label, value, color]) => (
                <div key={label} className="rounded-lg border bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase text-slate-500">
                    {label}
                  </p>
                  <p className={`mt-2 text-xl font-bold ${color}`}>
                    {value}
                  </p>
                </div>
              ))}
            </div>

            <div className="mb-5 grid gap-4 lg:grid-cols-3">
              <div className="rounded-lg border p-4">
                <h3 className="mb-3 font-bold">Sales Breakdown</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>Table Revenue</span><strong>{money(selectedDaySummary.tableSales)}</strong></div>
                  <div className="flex justify-between"><span>Cafe Revenue</span><strong>{money(selectedDaySummary.cafeSales)}</strong></div>
                  <div className="flex justify-between"><span>Accessories Revenue</span><strong>{money(selectedAccessoryRevenue)}</strong></div>
                  <div className="flex justify-between"><span>Completed Payments</span><strong>{selectedDaySummary.completedPaymentsCount}</strong></div>
                  <div className="flex justify-between"><span>Pending Bills</span><strong>{selectedDaySummary.pendingBillsCount} / {money(selectedDaySummary.pendingBillsAmount)}</strong></div>
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <h3 className="mb-3 font-bold">Payment Methods</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>Cash</span><strong>{money(selectedDaySummary.cashSales)}</strong></div>
                  <div className="flex justify-between"><span>Easypaisa</span><strong>{money(selectedDaySummary.easypaisaSales)}</strong></div>
                  <div className="flex justify-between"><span>JazzCash</span><strong>{money(selectedDaySummary.jazzCashSales)}</strong></div>
                  <div className="flex justify-between"><span>Card</span><strong>{money(selectedDaySummary.cardSales)}</strong></div>
                  <div className="flex justify-between"><span>Mixed Payments</span><strong>{selectedMixedPayments}</strong></div>
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <h3 className="mb-3 font-bold">Cash Handover</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>Opening Cash</span><strong>{money(selectedDay.openingCash)}</strong></div>
                  <div className="flex justify-between"><span>Cash Sales</span><strong>{money(selectedDaySummary.cashSales)}</strong></div>
                  <div className="flex justify-between"><span>Expected Cash</span><strong>{money(selectedDaySummary.expectedCash)}</strong></div>
                  <div className="flex justify-between"><span>Actual Cash</span><strong>{selectedDay.actualCashCounted !== undefined ? money(selectedDay.actualCashCounted) : "-"}</strong></div>
                  <div className="flex justify-between"><span>Left for Staff</span><strong>{selectedDay.cashLeftForStaff !== undefined ? money(selectedDay.cashLeftForStaff) : "-"}</strong></div>
                  <div className="flex justify-between"><span>Taken Home</span><strong>{selectedDay.cashTakenHome !== undefined ? money(selectedDay.cashTakenHome) : "-"}</strong></div>
                  <div className="flex justify-between"><span>Difference</span><strong className={getDifferenceClass(selectedDay.cashDifference)}>{selectedDay.cashDifference !== undefined ? money(selectedDay.cashDifference) : "-"}</strong></div>
                </div>
              </div>
            </div>

            <div className="mb-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border p-4">
                <h3 className="mb-3 font-bold">Expenses & Purchases</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>Expenses</span><strong className="text-red-700">{money(selectedDaySummary.totalExpenses)}</strong></div>
                  <div className="flex justify-between"><span>Payroll</span><strong>{money(selectedDaySummary.payrollExpensesTotal ?? 0)}</strong></div>
                  <div className="flex justify-between"><span>Inventory Purchases</span><strong>{money(selectedDaySummary.inventoryPurchasesTotal ?? 0)}</strong></div>
                  <div className="flex justify-between"><span>Outside Purchases</span><strong>{money(selectedDaySummary.outsidePurchasesPaidFromDrawer ?? 0)}</strong></div>
                  <div className="flex justify-between"><span>Vendor Restocking</span><strong>{money(selectedDaySummary.inventoryPurchasesTotal ?? 0)}</strong></div>
                  <div className="flex justify-between"><span>Cafe Purchases</span><strong>{money(0)}</strong></div>
                  <div className="flex justify-between"><span>Accessories Purchases</span><strong>{money(0)}</strong></div>
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <h3 className="mb-3 font-bold">Customer Refunds</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>Cash</span><strong>{money(selectedDaySummary.cashCustomerReimbursements ?? 0)}</strong></div>
                  <div className="flex justify-between"><span>Card</span><strong>{money(selectedDaySummary.cardCustomerReimbursements ?? 0)}</strong></div>
                  <div className="flex justify-between"><span>JazzCash</span><strong>{money(selectedDaySummary.jazzCashCustomerReimbursements ?? 0)}</strong></div>
                  <div className="flex justify-between"><span>Easypaisa</span><strong>{money(selectedDaySummary.easypaisaCustomerReimbursements ?? 0)}</strong></div>
                  <div className="flex justify-between"><span>Outstanding</span><strong>{money(selectedDaySummary.outstandingCustomerReimbursements ?? 0)}</strong></div>
                </div>
              </div>
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
                        <th className="px-3 py-2">Invoice</th>
                        <th className="px-3 py-2">Time</th>
                        <th className="px-3 py-2">Operator</th>
                        <th className="px-3 py-2">Customer / Table</th>
                        <th className="px-3 py-2">Payment Method</th>
                        <th className="px-3 py-2">Total</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">View</th>
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
                            {getSaleOperator(sale)}
                          </td>
                          <td className="px-3 py-2">
                            {sale.tableName === "-"
                              ? sale.payerName
                              : sale.tableName}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${getPaymentBadgeClass(getPaymentLabel(sale))}`}>
                              {getPaymentLabel(sale)}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-bold">
                            {money(
                              sale.grandTotal
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(sale.paymentStatus)}`}>
                              {sale.paymentStatus}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedPayment(sale)}
                            >
                              View
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {detailPayments.length ===
                        0 && (
                        <tr>
                          <td
                            colSpan={8}
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
                        <th className="px-3 py-2">Time</th>
                        <th className="px-3 py-2">Category</th>
                        <th className="px-3 py-2">Description</th>
                        <th className="px-3 py-2">Payment Method</th>
                        <th className="px-3 py-2">Amount</th>
                        <th className="px-3 py-2">Operator</th>
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
                            <td className="px-3 py-2">
                              {expense.note || "-"}
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
                            <td className="px-3 py-2">
                              {expense.createdByOperator?.operatorName ??
                                expense.createdByName ??
                                "-"}
                            </td>
                          </tr>
                        )
                      )}
                      {detailExpenses.length ===
                        0 && (
                        <tr>
                          <td
                            colSpan={6}
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
              <div className="mt-3 overflow-x-auto rounded-lg border bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Invoice</th>
                      <th className="px-3 py-2">Table</th>
                      <th className="px-3 py-2">Operator</th>
                      <th className="px-3 py-2">Amount</th>
                      <th className="px-3 py-2">Duration</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentPendingBills.map((bill) => (
                      <tr
                        key={bill.id}
                        className="cursor-pointer border-t hover:bg-slate-50"
                        onClick={() => setSelectedPendingBill(bill)}
                      >
                        <td className="px-3 py-2 font-mono">
                          {bill.staffBillNumber ?? bill.id}
                        </td>
                        <td className="px-3 py-2">{bill.tableName}</td>
                        <td className="px-3 py-2">
                          {bill.createdBy?.operatorName ?? "-"}
                        </td>
                        <td className="px-3 py-2 font-bold">
                          {money(getRemainingPendingBillTotal(bill))}
                        </td>
                        <td className="px-3 py-2">
                          {getDurationLabel(
                            bill.session.startTime,
                            bill.session.endTime
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(bill.status)}`}>
                            {bill.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {currentPendingBills.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                          No pending bills.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        )}

        {selectedPayment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
            <Card className="w-full max-w-2xl p-5">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold">Invoice Details</h2>
                  <p className="text-sm text-slate-500">
                    {selectedPayment.invoiceNumber} · {formatDate(selectedPayment.createdAt)}
                  </p>
                </div>
                <Button variant="outline" onClick={() => setSelectedPayment(null)}>
                  Close
                </Button>
              </div>
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-lg border p-3"><span className="text-slate-500">Operator</span><p className="font-semibold">{getSaleOperator(selectedPayment)}</p></div>
                <div className="rounded-lg border p-3"><span className="text-slate-500">Customer / Table</span><p className="font-semibold">{selectedPayment.tableName === "-" ? selectedPayment.payerName : selectedPayment.tableName}</p></div>
                <div className="rounded-lg border p-3"><span className="text-slate-500">Payment</span><p className="font-semibold">{getPaymentLabel(selectedPayment)}</p></div>
                <div className="rounded-lg border p-3"><span className="text-slate-500">Total</span><p className="font-semibold">{money(selectedPayment.grandTotal)}</p></div>
                <div className="rounded-lg border p-3"><span className="text-slate-500">Status</span><p className="font-semibold capitalize">{selectedPayment.paymentStatus}</p></div>
                <div className="rounded-lg border p-3"><span className="text-slate-500">Business Day</span><p className="font-semibold">{selectedDay?.dayName ?? "-"}</p></div>
              </div>
            </Card>
          </div>
        )}

        {selectedPendingBill && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
            <Card className="w-full max-w-xl p-5">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold">Pending Bill Details</h2>
                  <p className="text-sm text-slate-500">
                    {selectedPendingBill.staffBillNumber ?? selectedPendingBill.id}
                  </p>
                </div>
                <Button variant="outline" onClick={() => setSelectedPendingBill(null)}>
                  Close
                </Button>
              </div>
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-lg border p-3"><span className="text-slate-500">Table</span><p className="font-semibold">{selectedPendingBill.tableName}</p></div>
                <div className="rounded-lg border p-3"><span className="text-slate-500">Operator</span><p className="font-semibold">{selectedPendingBill.createdBy?.operatorName ?? "-"}</p></div>
                <div className="rounded-lg border p-3"><span className="text-slate-500">Amount</span><p className="font-semibold">{money(getRemainingPendingBillTotal(selectedPendingBill))}</p></div>
                <div className="rounded-lg border p-3"><span className="text-slate-500">Duration</span><p className="font-semibold">{getDurationLabel(selectedPendingBill.session.startTime, selectedPendingBill.session.endTime)}</p></div>
                <div className="rounded-lg border p-3"><span className="text-slate-500">Status</span><p className="font-semibold capitalize">{selectedPendingBill.status}</p></div>
                <div className="rounded-lg border p-3"><span className="text-slate-500">Created</span><p className="font-semibold">{formatDate(selectedPendingBill.createdAt)}</p></div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </main>
  );
}

export default DayHistoryPage;
