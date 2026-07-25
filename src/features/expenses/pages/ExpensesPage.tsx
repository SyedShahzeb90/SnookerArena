import {
  ArrowLeft,
  Pencil,
  Plus,
  Search,
  XCircle,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { useLocation } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import ExpenseDialog from "../components/ExpenseDialog";
import ExpenseSummaryCards from "../components/ExpenseSummaryCards";
import { useExpensesStore } from "../store/expensesStore";
import { useBusinessDayStore } from "@/features/business-day/store/businessDayStore";
import type { PaymentMethod } from "@/types/session";
import type {
  Expense,
  ExpenseCategory,
  ExpenseInput,
} from "../types/expense";
import { expenseCategories } from "../types/expense";
import {
  calculateFilteredExpenseTotal,
  formatCurrency,
  formatExpenseDate,
  formatExpenseTime,
  getExpenseDate,
  getExpenseStatus,
  getPaymentMethodLabel,
  isActiveExpense,
  normalizeExpenseCategory,
} from "../utils/expenseHelpers";
import { useAppDateTimeFormats } from "@/lib/dateTime";

type SortOrder =
  | "newest"
  | "oldest"
  | "highest"
  | "lowest"
  | "category";
type CategoryFilter = ExpenseCategory | "all";
type StatusFilter =
  | "active"
  | "cancelled"
  | "all";
type DateFilter =
  | "today"
  | "yesterday"
  | "this-week"
  | "this-month"
  | "all"
  | "custom";
type PaymentFilter = PaymentMethod | "all";

const defaultFilters = {
  search: "",
  category: "all" as CategoryFilter,
  payment: "all" as PaymentFilter,
  status: "active" as StatusFilter,
  date: "this-month" as DateFilter,
  sort: "newest" as SortOrder,
};

function getDateRange(
  filter: DateFilter,
  customStart: string,
  customEnd: string
) {
  if (filter === "all") return undefined;

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

function ExpensesPage() {
  useAppDateTimeFormats();
  const navigate = useNavigate();
  const location = useLocation();
  const dashboardPath =
    location.pathname.startsWith("/admin")
      ? "/admin"
      : "/operator";
  const expenses = useExpensesStore(
    (state) => state.expenses
  );
  const addExpense = useExpensesStore(
    (state) => state.addExpense
  );
  const updateExpense = useExpensesStore(
    (state) => state.updateExpense
  );
  const cancelExpense = useExpensesStore(
    (state) => state.cancelExpense
  );
  const activeBusinessDay =
    useBusinessDayStore((state) =>
      state.getActiveBusinessDay()
    );

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] =
    useState<CategoryFilter>(
      defaultFilters.category
    );
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>(
      defaultFilters.status
    );
  const [paymentFilter, setPaymentFilter] =
    useState<PaymentFilter>(
      defaultFilters.payment
    );
  const [dateFilter, setDateFilter] =
    useState<DateFilter>(defaultFilters.date);
  const [customStart, setCustomStart] =
    useState("");
  const [customEnd, setCustomEnd] =
    useState("");
  const [sortOrder, setSortOrder] =
    useState<SortOrder>(defaultFilters.sort);
  const [dialogOpen, setDialogOpen] =
    useState(false);
  const [editingExpense, setEditingExpense] =
    useState<Expense | null>(null);
  const [message, setMessage] =
    useState("");
  const messageTimeoutRef =
    useRef<number | undefined>(undefined);
  const [expenseToCancel, setExpenseToCancel] =
    useState<Expense | null>(null);
  const [cancelReason, setCancelReason] =
    useState("");
  const [isCancelling, setIsCancelling] =
    useState(false);
  useEffect(() => {
    if (messageTimeoutRef.current) {
      window.clearTimeout(
        messageTimeoutRef.current
      );
    }

    if (message) {
      messageTimeoutRef.current =
        window.setTimeout(
          () => setMessage(""),
          4000
        );
    }

    return () => {
      if (messageTimeoutRef.current) {
        window.clearTimeout(
          messageTimeoutRef.current
        );
      }
    };
  }, [message]);

  const filteredExpenses = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();
    const range = getDateRange(
      dateFilter,
      customStart,
      customEnd
    );

    return expenses
      .filter((expense) => {
        const status =
          getExpenseStatus(expense);
        const expenseDate =
          getExpenseDate(expense);
        const paymentMethod =
          expense.paymentMethod ?? "cash";
        const matchesSearch =
          !query ||
          (expense.note ?? "")
            .toLowerCase()
            .includes(query) ||
          normalizeExpenseCategory(
            expense.category
          )
            .toLowerCase()
            .includes(query) ||
          getPaymentMethodLabel(paymentMethod)
            .toLowerCase()
            .includes(query) ||
          String(expense.amount).includes(
            query
          ) ||
          (expense.cancellationReason ?? "")
            .toLowerCase()
            .includes(query);

        const matchesCategory =
          categoryFilter === "all" ||
          expense.category === categoryFilter;
        const matchesStatus =
          statusFilter === "all" ||
          status === statusFilter;
        const matchesPayment =
          paymentFilter === "all" ||
          paymentMethod === paymentFilter;
        const matchesDate =
          !range ||
          (expenseDate &&
            expenseDate.getTime() >=
              range.start.getTime() &&
            expenseDate.getTime() <=
              range.end.getTime());

        return (
          matchesSearch &&
          matchesCategory &&
          matchesStatus &&
          matchesPayment &&
          matchesDate
        );
      })
      .sort((first, second) => {
        if (sortOrder === "highest") {
          return second.amount - first.amount;
        }

        if (sortOrder === "lowest") {
          return first.amount - second.amount;
        }

        if (sortOrder === "category") {
          return normalizeExpenseCategory(
            first.category
          ).localeCompare(
            normalizeExpenseCategory(
              second.category
            )
          );
        }

        const firstTime =
          getExpenseDate(first)?.getTime() ?? 0;
        const secondTime =
          getExpenseDate(second)?.getTime() ?? 0;

        return sortOrder === "newest"
          ? secondTime - firstTime
          : firstTime - secondTime;
      });
  }, [
    expenses,
    search,
    categoryFilter,
    statusFilter,
    paymentFilter,
    dateFilter,
    customStart,
    customEnd,
    sortOrder,
  ]);

  const filteredTotal = useMemo(
    () =>
      calculateFilteredExpenseTotal(
        filteredExpenses,
        statusFilter === "cancelled"
      ),
    [filteredExpenses, statusFilter]
  );
  const totalRecords = expenses.filter(
    (expense) =>
      statusFilter === "all" ||
      getExpenseStatus(expense) === statusFilter
  ).length;
  const resultSummary =
    filteredExpenses.length === 0
      ? "No matching expenses"
      : filteredExpenses.length === totalRecords
        ? `Showing ${filteredExpenses.length} expense${
            filteredExpenses.length === 1
              ? ""
              : "s"
          }`
        : `Showing ${filteredExpenses.length} of ${totalRecords} expenses`;
  const isDefaultFilterState =
    search === defaultFilters.search &&
    categoryFilter === defaultFilters.category &&
    paymentFilter === defaultFilters.payment &&
    statusFilter === defaultFilters.status &&
    dateFilter === defaultFilters.date &&
    sortOrder === defaultFilters.sort &&
    !customStart &&
    !customEnd;
  const hasExpenses = expenses.length > 0;

  const handleAddClick = () => {
    if (!activeBusinessDay) {
      setMessage(
        "Please start the day before adding expense."
      );
      return;
    }

    setEditingExpense(null);
    setDialogOpen(true);
    setMessage("");
  };

  const handleSave = (
    input: ExpenseInput
  ) => {
    if (editingExpense) {
      updateExpense(
        editingExpense.id,
        input
      );
      setMessage(
        "Expense updated successfully."
      );
    } else {
      addExpense({
        ...input,
        activeBusinessDayId:
          activeBusinessDay?.id,
      });
      setMessage(
        "Expense saved successfully."
      );
    }

    setEditingExpense(null);
  };

  const clearFilters = () => {
    setSearch(defaultFilters.search);
    setCategoryFilter(defaultFilters.category);
    setPaymentFilter(defaultFilters.payment);
    setStatusFilter(defaultFilters.status);
    setDateFilter(defaultFilters.date);
    setSortOrder(defaultFilters.sort);
    setCustomStart("");
    setCustomEnd("");
  };

  const handleCancelClick = (
    expense: Expense
  ) => {
    if (!isActiveExpense(expense)) return;

    setExpenseToCancel(expense);
    setCancelReason("");
  };

  const confirmCancelExpense = () => {
    if (!expenseToCancel) return;
    if (!isActiveExpense(expenseToCancel)) {
      setExpenseToCancel(null);
      return;
    }

    setIsCancelling(true);
    cancelExpense(
      expenseToCancel.id,
      cancelReason
    );
    setIsCancelling(false);
    setMessage(
      "Expense cancelled successfully."
    );
    setExpenseToCancel(null);
  };

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Button
              variant="ghost"
              className="mb-3 gap-2"
              onClick={() =>
                navigate(dashboardPath)
              }
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Button>

            <h1 className="text-2xl font-bold text-slate-950">
              Expenses
            </h1>
            <p className="text-sm text-slate-500">
              Record daily costs and review monthly spending.
            </p>
          </div>

          <Button
            size="lg"
            className="gap-2 bg-red-700 hover:bg-red-800"
            onClick={handleAddClick}
          >
            <Plus className="h-4 w-4" />
            Add Expense
          </Button>
        </div>

        <ExpenseSummaryCards
          expenses={expenses}
        />

        {message && (
          <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {message}
          </p>
        )}

        <Card className="mt-5 overflow-hidden">
          <div className="grid gap-3 border-b p-4">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search category, note, payment, reference..."
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
              />
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_180px_180px_180px]">
            <select
              className="h-10 rounded-md border bg-white px-3 text-sm"
              value={categoryFilter}
              onChange={(event) =>
                setCategoryFilter(
                  event.target
                    .value as CategoryFilter
                )
              }
            >
              <option value="all">
                All Categories
              </option>
              {expenseCategories.map((category) => (
                <option
                  key={category}
                  value={category}
                >
                  {category}
                </option>
              ))}
            </select>

            <select
              className="h-10 rounded-md border bg-white px-3 text-sm"
              value={paymentFilter}
              onChange={(event) =>
                setPaymentFilter(
                  event.target
                    .value as PaymentFilter
                )
              }
            >
              <option value="all">
                All Payments
              </option>
              <option value="cash">Cash</option>
              <option value="jazzcash">
                JazzCash
              </option>
              <option value="easypaisa">
                EasyPaisa
              </option>
              <option value="card">Card</option>
            </select>

            <select
              className="h-10 rounded-md border bg-white px-3 text-sm"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target
                    .value as StatusFilter
                )
              }
            >
              <option value="active">
                Active
              </option>
              <option value="cancelled">
                Cancelled
              </option>
              <option value="all">
                All Statuses
              </option>
            </select>

            <select
              className="h-10 rounded-md border bg-white px-3 text-sm"
              value={sortOrder}
              onChange={(event) =>
                setSortOrder(
                  event.target.value as SortOrder
                )
              }
            >
              <option value="newest">
                Newest First
              </option>
              <option value="oldest">
                Oldest First
              </option>
              <option value="highest">
                Highest Amount
              </option>
              <option value="lowest">
                Lowest Amount
              </option>
              <option value="category">
                Category A-Z
              </option>
            </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  ["today", "Today"],
                  ["yesterday", "Yesterday"],
                  ["this-week", "This Week"],
                  ["this-month", "This Month"],
                  ["all", "All Dates"],
                  ["custom", "Custom Range"],
                ] as [DateFilter, string][]
              ).map(([value, label]) => (
                <Button
                  key={value}
                  type="button"
                  variant={
                    dateFilter === value
                      ? "default"
                      : "outline"
                  }
                  size="sm"
                  onClick={() =>
                    setDateFilter(value)
                  }
                >
                  {label}
                </Button>
              ))}
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

            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-medium text-slate-600">
                  {resultSummary}
                </span>
                <span className="font-semibold text-slate-800">
                  {statusFilter === "cancelled"
                    ? "Cancelled Records Total"
                    : categoryFilter === "all"
                      ? "Filtered Total"
                      : `${categoryFilter} Total`}
                  : {formatCurrency(filteredTotal)}
                </span>
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
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">
                    Date / Time
                  </th>
                  <th className="px-4 py-3">
                    Category
                  </th>
                  <th className="px-4 py-3">
                    Note
                  </th>
                  <th className="px-4 py-3 text-right">
                    Amount
                  </th>
                  <th className="px-4 py-3">
                    Payment
                  </th>
                  <th className="px-4 py-3">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredExpenses.map(
                  (expense) => {
                    const status =
                      getExpenseStatus(expense);
                    const isCancelled =
                      status === "cancelled";

                    return (
                    <tr
                      key={expense.id}
                      className={`border-t bg-white ${
                        isCancelled
                          ? "text-slate-400"
                          : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <span className="block whitespace-nowrap">
                          {formatExpenseDate(
                            expense
                          )}
                        </span>
                        {formatExpenseTime(
                          expense
                        ) && (
                          <span className="block whitespace-nowrap text-xs text-slate-500">
                            {formatExpenseTime(
                              expense
                            )}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                          {normalizeExpenseCategory(
                            expense.category
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {expense.note || "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-red-700">
                        {formatCurrency(
                          expense.amount
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {getPaymentMethodLabel(
                          expense.paymentMethod
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            isCancelled
                              ? "rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500 ring-1 ring-slate-200"
                              : "rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200"
                          }
                        >
                          {isCancelled
                            ? "Cancelled"
                            : "Active"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {isCancelled ? (
                            <Button
                              variant="outline"
                              onClick={() =>
                                setExpenseToCancel(
                                  expense
                                )
                              }
                            >
                              View Details
                            </Button>
                          ) : (
                            <>
                              <Button
                                variant="outline"
                                className="gap-2"
                                onClick={() => {
                                  setEditingExpense(
                                    expense
                                  );
                                  setDialogOpen(true);
                                  setMessage("");
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                                Edit
                              </Button>

                              <Button
                                variant="destructive"
                                className="gap-2"
                                onClick={() =>
                                  handleCancelClick(
                                    expense
                                  )
                                }
                              >
                                <XCircle className="h-4 w-4" />
                                Cancel
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  }
                )}

                {filteredExpenses.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-10 text-center text-slate-500"
                    >
                      <div className="mx-auto max-w-sm">
                        <p className="font-bold text-slate-700">
                          {hasExpenses
                            ? "No matching expenses"
                            : "No expenses recorded"}
                        </p>
                        <p className="mt-1 text-sm">
                          {hasExpenses
                            ? "Try changing the search or filters."
                            : "Record rent, utilities, maintenance, stock purchases, and other operating costs."}
                        </p>
                        <Button
                          className="mt-4"
                          onClick={
                            hasExpenses
                              ? clearFilters
                              : handleAddClick
                          }
                        >
                          {hasExpenses
                            ? "Clear Filters"
                            : "Add First Expense"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <ExpenseDialog
        open={dialogOpen}
        expense={editingExpense}
        onOpenChange={(open) => {
          setDialogOpen(open);

          if (!open) {
            setEditingExpense(null);
          }
        }}
        onSave={handleSave}
      />

      {expenseToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-bold text-slate-950">
              Cancel Expense
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              This expense will stop affecting expense totals and cash calculations, but the record will remain in history.
            </p>

            <div className="mt-4 space-y-2 rounded-lg bg-slate-50 p-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">
                  Category
                </span>
                <strong>
                  {normalizeExpenseCategory(
                    expenseToCancel.category
                  )}
                </strong>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">
                  Amount
                </span>
                <strong>
                  {formatCurrency(
                    expenseToCancel.amount
                  )}
                </strong>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">
                  Payment
                </span>
                <strong>
                  {getPaymentMethodLabel(
                    expenseToCancel.paymentMethod
                  )}
                </strong>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">
                  Date
                </span>
                <strong>
                  {formatExpenseDate(
                    expenseToCancel
                  )}{" "}
                  {formatExpenseTime(
                    expenseToCancel
                  )}
                </strong>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">
                  Note
                </span>
                <strong className="text-right">
                  {expenseToCancel.note || "—"}
                </strong>
              </div>
              {expenseToCancel.cancelledAt && (
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">
                    Cancelled
                  </span>
                  <strong>
                    {new Date(
                      expenseToCancel.cancelledAt
                    ).toLocaleString()}
                  </strong>
                </div>
              )}
              {expenseToCancel.cancellationReason && (
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">
                    Reason
                  </span>
                  <strong className="text-right">
                    {
                      expenseToCancel.cancellationReason
                    }
                  </strong>
                </div>
              )}
            </div>

            {isActiveExpense(expenseToCancel) && (
              <label className="mt-4 grid gap-1 text-sm font-medium text-slate-700">
                Cancellation reason
                <textarea
                  className="min-h-20 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                  value={cancelReason}
                  onChange={(event) =>
                    setCancelReason(
                      event.target.value
                    )
                  }
                  placeholder="Optional"
                />
              </label>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  setExpenseToCancel(null)
                }
              >
                {isActiveExpense(expenseToCancel)
                  ? "Keep Expense"
                  : "Close"}
              </Button>
              {isActiveExpense(expenseToCancel) && (
                <Button
                  className="bg-red-700 hover:bg-red-800"
                  disabled={isCancelling}
                  onClick={confirmCancelExpense}
                >
                  {isCancelling
                    ? "Cancelling..."
                    : "Cancel Expense"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default ExpensesPage;
