import {
  ArrowLeft,
  Search,
  Trash2,
} from "lucide-react";
import {
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useBusinessDayStore } from "@/features/business-day/store/businessDayStore";
import { getWalkInDisplayName } from "@/features/sessions/utils/walkInLabel";

import { useSalesStore } from "../store/salesStore";
import {
  calculatePaymentTotals,
  calculateSalesTotals,
  filterSalesByRange,
} from "../utils/salesReports";
import type { PaymentMethod } from "@/types/session";

const paymentLabels: Record<
  PaymentMethod,
  string
> = {
  cash: "Cash",
  card: "Card",
  jazzcash: "JazzCash",
  easypaisa: "Easypaisa",
};

function getPaymentLabel(
  sale: ReturnType<
    typeof useSalesStore.getState
  >["sales"][number]
) {
  if (!sale.paymentSplits?.length) {
    return paymentLabels[sale.paymentMethod];
  }

  return sale.paymentSplits
    .map(
      (split) =>
        `${paymentLabels[split.method]} Rs. ${split.amount}`
    )
    .join(" + ");
}

type SortOrder = "newest" | "oldest";

function formatDate(value: string) {
  return new Date(value).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

type SalesHistorySale = ReturnType<
  typeof useSalesStore.getState
>["sales"][number];

function getSaleDisplayName(
  sale: SalesHistorySale,
  name?: string | null
) {
  return getWalkInDisplayName({
    name,
    tableId: sale.tableId,
    tableName: sale.tableName,
    time: sale.startedAt,
  });
}

function getSalePlayersLabel(sale: SalesHistorySale) {
  return sale.players
    .map((player) =>
      getSaleDisplayName(sale, player.name)
    )
    .join(", ");
}

function SalesHistoryPage() {
  const navigate = useNavigate();
  const sales = useSalesStore(
    (state) => state.sales
  );
  const deleteSale = useSalesStore(
    (state) => state.deleteSale
  );
  const businessDays =
    useBusinessDayStore(
      (state) => state.days
    );

  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] =
    useState<SortOrder>("newest");

  const handleDeleteSale = (
    sale: (typeof sales)[number]
  ) => {
    const confirmed = window.confirm(
      `Delete sale ${sale.invoiceNumber}? This is for removing mistaken test bills.`
    );

    if (!confirmed) return;

    deleteSale(sale.id);
  };

  const businessDayById = useMemo(
    () =>
      new Map(
        businessDays.map((day) => [
          day.id,
          day,
        ])
      ),
    [businessDays]
  );

  const getBusinessDayLabel = (
    businessDayId?: string
  ) => {
    if (!businessDayId) {
      return "No Business Day";
    }

    const day =
      businessDayById.get(businessDayId);

    if (!day) {
      return "No Business Day";
    }

    return `${day.dayName} - ${day.openedBy}`;
  };

  const filteredSales = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    return sales
      .filter((sale) => {
        if (!query) return true;

        const businessDayLabel =
          getBusinessDayLabel(
            sale.activeBusinessDayId
          ).toLowerCase();

        return (
          sale.invoiceNumber
            .toLowerCase()
            .includes(query) ||
          sale.tableName
            .toLowerCase()
            .includes(query) ||
          sale.players.some((player) =>
            player.name
              .toLowerCase()
              .includes(query)
          ) ||
          getSalePlayersLabel(sale)
            .toLowerCase()
            .includes(query) ||
          (sale.winnerName ?? "")
            .toLowerCase()
            .includes(query) ||
          (sale.loserName ?? "")
            .toLowerCase()
            .includes(query) ||
          (sale.payerName ?? "")
            .toLowerCase()
            .includes(query) ||
          getSaleDisplayName(
            sale,
            sale.payerName
          )
            .toLowerCase()
            .includes(query) ||
          getPaymentLabel(sale)
            .toLowerCase()
            .includes(query) ||
          businessDayLabel.includes(query)
        );
      })
      .sort((a, b) => {
        const first = new Date(
          a.createdAt
        ).getTime();
        const second = new Date(
          b.createdAt
        ).getTime();

        return sortOrder === "newest"
          ? second - first
          : first - second;
      });
  }, [
    sales,
    search,
    sortOrder,
    businessDayById,
  ]);

  const todayTotals = calculateSalesTotals(
    filterSalesByRange(sales, "today")
  );
  const monthTotals = calculateSalesTotals(
    filterSalesByRange(
      sales,
      "this-month"
    )
  );
  const paymentTotals =
    calculatePaymentTotals(filteredSales);

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Button
              variant="ghost"
              className="mb-3 gap-2"
              onClick={() => navigate("/admin")}
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Button>

            <h1 className="text-2xl font-bold text-slate-950">
              Sales History
            </h1>
            <p className="text-sm text-slate-500">
              Completed transactions, invoice history, and payment analytics.
            </p>
          </div>

          <div className="flex rounded-lg border bg-white p-1">
            <Button
              variant={
                sortOrder === "newest"
                  ? "default"
                  : "ghost"
              }
              onClick={() =>
                setSortOrder("newest")
              }
            >
              Newest
            </Button>
            <Button
              variant={
                sortOrder === "oldest"
                  ? "default"
                  : "ghost"
              }
              onClick={() =>
                setSortOrder("oldest")
              }
            >
              Oldest
            </Button>
          </div>
        </div>

        <section className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card className="p-4">
            <p className="text-sm text-slate-500">
              Today Revenue
            </p>
            <p className="mt-1 text-2xl font-bold">
              Rs. {todayTotals.revenue}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-slate-500">
              This Month Revenue
            </p>
            <p className="mt-1 text-2xl font-bold">
              Rs. {monthTotals.revenue}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-slate-500">
              This Month Sales
            </p>
            <p className="mt-1 text-2xl font-bold">
              {monthTotals.salesCount}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-slate-500">
              Average Sale
            </p>
            <p className="mt-1 text-2xl font-bold">
              Rs. {monthTotals.averageSale}
            </p>
          </Card>
        </section>

        <section className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-4">
          {Object.entries(paymentTotals).map(
            ([method, total]) => (
              <Card
                key={method}
                className="p-4"
              >
                <p className="text-sm capitalize text-slate-500">
                  {method}
                </p>
                <p className="mt-1 text-xl font-bold">
                  Rs. {total}
                </p>
              </Card>
            )
          )}
        </section>

        <Card className="overflow-hidden">
          <div className="flex items-center gap-3 border-b p-4">
            <Search className="h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search invoice, table, player, payer, payment method, business day..."
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">
                    Invoice
                  </th>
                  <th className="px-4 py-3">
                    Date
                  </th>
                  <th className="px-4 py-3">
                    Business Day
                  </th>
                  <th className="px-4 py-3">
                    Table
                  </th>
                  <th className="px-4 py-3">
                    Type
                  </th>
                  <th className="px-4 py-3">
                    Players
                  </th>
                  <th className="px-4 py-3">
                    Winner
                  </th>
                  <th className="px-4 py-3">
                    Loser
                  </th>
                  <th className="px-4 py-3">
                    Payer
                  </th>
                  <th className="px-4 py-3">
                    Player Breakdown
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
                    Discount
                  </th>
                  <th className="px-4 py-3">
                    Grand Total
                  </th>
                  <th className="px-4 py-3">
                    Payment
                  </th>
                  <th className="px-4 py-3 text-right">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredSales.map((sale) => (
                  <tr
                    key={sale.id}
                    className="border-t bg-white"
                  >
                    <td className="px-4 py-3 font-semibold">
                      {sale.invoiceNumber}
                    </td>
                    <td className="px-4 py-3">
                      {formatDate(
                        sale.createdAt
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {getBusinessDayLabel(
                        sale.activeBusinessDayId
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {sale.tableName}
                    </td>
                    <td className="px-4 py-3">
                      {sale.saleType ===
                        "cafe-only" ||
                      sale.saleType ===
                        "cafe_only"
                        ? "Cafe Only"
                        : sale.saleType ===
                            "customer_bill"
                          ? "Customer Bill"
                          : sale.saleType ===
                              "accessories"
                            ? "Accessories"
                          : "Table"}
                    </td>
                    <td className="px-4 py-3">
                      {getSalePlayersLabel(sale)}
                    </td>
                    <td className="px-4 py-3">
                      {sale.winnerName
                        ? getSaleDisplayName(
                            sale,
                            sale.winnerName
                          )
                        : "-"}
                    </td>
                    <td className="px-4 py-3">
                      {sale.loserName
                        ? getSaleDisplayName(
                            sale,
                            sale.loserName
                          )
                        : "-"}
                    </td>
                    <td className="px-4 py-3">
                      {sale.payerName
                        ? getSaleDisplayName(
                            sale,
                            sale.payerName
                          )
                        : "-"}
                    </td>
                    <td className="px-4 py-3">
                      {sale.playerBreakdown ? (
                        <div className="space-y-1">
                          {sale.playerBreakdown.map(
                            (player) => (
                              <div
                                key={
                                  player.playerName
                                }
                                className="whitespace-nowrap text-xs"
                              >
                                <span className="font-semibold">
                                  {
                                    getSaleDisplayName(
                                      sale,
                                      player.playerName
                                    )
                                  }
                                </span>
                                {": "}Rs.{" "}
                                {
                                  player.totalAmount
                                }
                              </div>
                            )
                          )}
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {sale.durationMinutes}m
                    </td>
                    <td className="px-4 py-3">
                      Rs. {sale.tableAmount}
                    </td>
                    <td className="px-4 py-3">
                      Rs. {sale.cafeAmount}
                    </td>
                    <td className="px-4 py-3">
                      Rs. {sale.discount}
                    </td>
                    <td className="px-4 py-3 font-bold">
                      Rs. {sale.grandTotal}
                    </td>
                    <td className="px-4 py-3">
                      {getPaymentLabel(sale)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1 border-red-200 text-red-700 hover:bg-red-50"
                        onClick={() =>
                          handleDeleteSale(sale)
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}

                {filteredSales.length === 0 && (
                  <tr>
                    <td
                      colSpan={17}
                      className="px-4 py-10 text-center text-slate-500"
                    >
                      No sales found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </main>
  );
}

export default SalesHistoryPage;
