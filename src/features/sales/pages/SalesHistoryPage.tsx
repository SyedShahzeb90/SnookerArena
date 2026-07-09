import {
  ArrowLeft,
  Search,
} from "lucide-react";
import {
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { useSalesStore } from "../store/salesStore";
import {
  calculatePaymentTotals,
  calculateSalesTotals,
  filterSalesByRange,
} from "../utils/salesReports";

type SortOrder = "newest" | "oldest";

function formatDate(value: string) {
  return new Date(value).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function SalesHistoryPage() {
  const navigate = useNavigate();
  const sales = useSalesStore(
    (state) => state.sales
  );

  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] =
    useState<SortOrder>("newest");

  const filteredSales = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    return sales
      .filter((sale) => {
        if (!query) return true;

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
          (sale.winnerName ?? "")
            .toLowerCase()
            .includes(query) ||
          (sale.loserName ?? "")
            .toLowerCase()
            .includes(query) ||
          (sale.payerName ?? "")
            .toLowerCase()
            .includes(query) ||
          sale.paymentMethod
            .toLowerCase()
            .includes(query)
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
  }, [sales, search, sortOrder]);

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
              onClick={() => navigate("/")}
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
              placeholder="Search invoice, table, player, winner, payer, payment method..."
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
                    Table
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
                      {sale.tableName}
                    </td>
                    <td className="px-4 py-3">
                      {sale.players
                        .map(
                          (player) =>
                            player.name
                        )
                        .join(", ")}
                    </td>
                    <td className="px-4 py-3">
                      {sale.winnerName ?? "-"}
                    </td>
                    <td className="px-4 py-3">
                      {sale.loserName ?? "-"}
                    </td>
                    <td className="px-4 py-3">
                      {sale.payerName ?? "-"}
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
                                    player.playerName
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
                    <td className="px-4 py-3 capitalize">
                      {sale.paymentMethod}
                    </td>
                  </tr>
                ))}

                {filteredSales.length === 0 && (
                  <tr>
                    <td
                      colSpan={14}
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
