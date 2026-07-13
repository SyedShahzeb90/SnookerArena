import {
  ArrowLeft,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import {
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { useLocation } from "react-router-dom";

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

import ExpenseDialog from "../components/ExpenseDialog";
import ExpenseSummaryCards from "../components/ExpenseSummaryCards";
import { useExpensesStore } from "../store/expensesStore";
import { useBusinessDayStore } from "@/features/business-day/store/businessDayStore";
import type {
  Expense,
  ExpenseCategory,
  ExpenseInput,
} from "../types/expense";
import { expenseCategories } from "../types/expense";

type SortOrder = "newest" | "oldest";
type CategoryFilter = ExpenseCategory | "all";

function formatDate(value: string) {
  return new Date(value).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function ExpensesPage() {
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
  const deleteExpense = useExpensesStore(
    (state) => state.deleteExpense
  );
  const activeBusinessDay =
    useBusinessDayStore((state) =>
      state.getActiveBusinessDay()
    );

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] =
    useState<CategoryFilter>("all");
  const [sortOrder, setSortOrder] =
    useState<SortOrder>("newest");
  const [dialogOpen, setDialogOpen] =
    useState(false);
  const [editingExpense, setEditingExpense] =
    useState<Expense | null>(null);
  const [message, setMessage] =
    useState("");

  const filteredExpenses = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    return expenses
      .filter((expense) => {
        const matchesSearch =
          !query ||
          expense.note
            .toLowerCase()
            .includes(query) ||
          expense.category
            .toLowerCase()
            .includes(query);

        const matchesCategory =
          categoryFilter === "all" ||
          expense.category === categoryFilter;

        return (
          matchesSearch && matchesCategory
        );
      })
      .sort((first, second) => {
        const firstTime = new Date(
          first.expenseDate
        ).getTime();
        const secondTime = new Date(
          second.expenseDate
        ).getTime();

        return sortOrder === "newest"
          ? secondTime - firstTime
          : firstTime - secondTime;
      });
  }, [
    expenses,
    search,
    categoryFilter,
    sortOrder,
  ]);

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

  const handleDelete = (
    expense: Expense
  ) => {
    const confirmed = window.confirm(
      `Delete this ${expense.category} expense?`
    );

    if (!confirmed) return;

    deleteExpense(expense.id);
    setMessage(
      "Expense deleted successfully."
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
          <div className="grid gap-3 border-b p-4 md:grid-cols-[1fr_220px_180px]">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by note or category"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
              />
            </div>

            <Select
              value={categoryFilter}
              onValueChange={(value) =>
                setCategoryFilter(
                  value as CategoryFilter
                )
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  All Categories
                </SelectItem>
                {expenseCategories.map(
                  (category) => (
                    <SelectItem
                      key={category}
                      value={category}
                    >
                      {category}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>

            <Select
              value={sortOrder}
              onValueChange={(value) =>
                setSortOrder(
                  value as SortOrder
                )
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">
                  Newest First
                </SelectItem>
                <SelectItem value="oldest">
                  Oldest First
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">
                    Date/time
                  </th>
                  <th className="px-4 py-3">
                    Category
                  </th>
                  <th className="px-4 py-3">
                    Note
                  </th>
                  <th className="px-4 py-3">
                    Amount
                  </th>
                  <th className="px-4 py-3">
                    Payment
                  </th>
                  <th className="px-4 py-3 text-right">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredExpenses.map(
                  (expense) => (
                    <tr
                      key={expense.id}
                      className="border-t bg-white"
                    >
                      <td className="px-4 py-3">
                        {formatDate(
                          expense.expenseDate
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {expense.category}
                      </td>
                      <td className="px-4 py-3">
                        {expense.note || "-"}
                      </td>
                      <td className="px-4 py-3 font-bold text-red-700">
                        Rs. {expense.amount}
                      </td>
                      <td className="px-4 py-3 capitalize">
                        {expense.paymentMethod ??
                          "cash"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
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
                              handleDelete(
                                expense
                              )
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                )}

                {filteredExpenses.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-center text-slate-500"
                    >
                      No expenses found.
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
    </main>
  );
}

export default ExpensesPage;
