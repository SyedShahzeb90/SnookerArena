import {
  ArrowLeft,
  ReceiptText,
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
import type { PaymentMethod } from "@/types/session";

import BillingDialog from "../components/BillingDialog";
import {
  useCheckoutStore,
  type PendingBill,
} from "../store/checkoutStore";
import { useSalesStore } from "@/features/sales/store/salesStore";
import { calculateGamePrice } from "@/features/pricing/utils/calculateGamePrice";
import { calculateBill } from "@/features/pricing/utils/calculateBill";

type StatusFilter = "pending" | "paid";
type SortOrder = "newest" | "oldest";

function formatTime(value: string) {
  return new Date(value).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getBillTotal(bill: PendingBill) {
  if (!bill.session.endTime) return 0;

  const game = calculateGamePrice({
    sessionType: bill.session.sessionType,
    tableType: bill.tableType,
    startTime: new Date(
      bill.session.startTime
    ),
    endTime: new Date(
      bill.session.endTime
    ),
  });

  return calculateBill({
    gameAmount: game.gameAmount,
    cafeAmount: bill.session.cafeAmount,
    discount: bill.session.discount,
  }).total;
}

function CheckoutPage() {
  const navigate = useNavigate();
  const pendingBills = useCheckoutStore(
    (state) => state.pendingBills
  );
  const receivePendingBillPayment =
    useCheckoutStore(
      (state) =>
        state.receivePendingBillPayment
    );
  const sales = useSalesStore(
    (state) => state.sales
  );

  const [selectedBill, setSelectedBill] =
    useState<PendingBill | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("pending");
  const [sortOrder, setSortOrder] =
    useState<SortOrder>("newest");

  const todaySales = useMemo(() => {
    const today = new Date();

    return sales.filter((sale) => {
      const createdAt = new Date(
        sale.createdAt
      );

      return (
        createdAt.toDateString() ===
        today.toDateString()
      );
    });
  }, [sales]);

  const pendingAmount = pendingBills.reduce(
    (total, bill) =>
      total + getBillTotal(bill),
    0
  );

  const totalReceivedToday =
    todaySales.reduce(
      (total, sale) =>
        total + sale.grandTotal,
      0
    );

  const filteredBills = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    if (statusFilter === "paid") {
      return [];
    }

    return pendingBills
      .filter((bill) => {
        if (!query) return true;

        const players = [
          bill.session.player1,
          bill.session.player2,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return (
          bill.id
            .toLowerCase()
            .includes(query) ||
          bill.tableName
            .toLowerCase()
            .includes(query) ||
          players.includes(query) ||
          (bill.session.payerName ?? "")
            .toLowerCase()
            .includes(query)
        );
      })
      .sort((first, second) => {
        const firstTime = new Date(
          first.createdAt
        ).getTime();
        const secondTime = new Date(
          second.createdAt
        ).getTime();

        return sortOrder === "newest"
          ? secondTime - firstTime
          : firstTime - secondTime;
      });
  }, [
    pendingBills,
    search,
    statusFilter,
    sortOrder,
  ]);

  const handleReceivePayment = (
    paymentMethod: PaymentMethod,
    payerName?: string
  ) => {
    if (!selectedBill) return;

    receivePendingBillPayment({
      billId: selectedBill.id,
      paymentMethod,
      payerName,
    });

    setSelectedBill(null);
  };

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Button
              variant="ghost"
              className="mb-3 gap-2"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Button>

            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-slate-700 shadow-sm ring-1 ring-slate-200">
                <ReceiptText className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-950">
                  Billing / Checkout
                </h1>
                <p className="text-sm text-slate-500">
                  Ended game bills waiting for payment.
                </p>
              </div>
            </div>
          </div>
        </div>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card className="p-4">
            <p className="text-sm text-slate-500">
              Pending Bills
            </p>
            <p className="mt-1 text-2xl font-bold">
              {pendingBills.length}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-slate-500">
              Pending Amount
            </p>
            <p className="mt-1 text-2xl font-bold">
              Rs. {pendingAmount}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-slate-500">
              Paid Today
            </p>
            <p className="mt-1 text-2xl font-bold">
              {todaySales.length}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-slate-500">
              Total Received Today
            </p>
            <p className="mt-1 text-2xl font-bold">
              Rs. {totalReceivedToday}
            </p>
          </Card>
        </section>

        <Card className="mt-5 overflow-hidden">
          <div className="grid gap-3 border-b p-4 md:grid-cols-[1fr_auto_auto]">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search invoice, table, player, payer..."
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
              />
            </div>

            <div className="flex rounded-lg border bg-white p-1">
              <Button
                variant={
                  statusFilter === "pending"
                    ? "default"
                    : "ghost"
                }
                onClick={() =>
                  setStatusFilter("pending")
                }
              >
                Pending
              </Button>
              <Button
                variant={
                  statusFilter === "paid"
                    ? "default"
                    : "ghost"
                }
                onClick={() =>
                  setStatusFilter("paid")
                }
              >
                Paid
              </Button>
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

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">
                    Invoice
                  </th>
                  <th className="px-4 py-3">
                    Time
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
                    Payer
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

              <tbody>
                {filteredBills.map((bill) => (
                  <tr
                    key={bill.id}
                    className="border-t bg-white"
                  >
                    <td className="px-4 py-3 font-semibold">
                      {bill.id}
                    </td>
                    <td className="px-4 py-3">
                      {formatTime(
                        bill.createdAt
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {bill.tableName}
                    </td>
                    <td className="px-4 py-3">
                      {bill.session.player1}
                      {bill.session.player2
                        ? `, ${bill.session.player2}`
                        : ""}
                    </td>
                    <td className="px-4 py-3">
                      {bill.session.winnerName ??
                        "-"}
                    </td>
                    <td className="px-4 py-3">
                      {bill.session.payerName ??
                        "-"}
                    </td>
                    <td className="px-4 py-3">
                      Rs. {bill.session.cafeAmount}
                    </td>
                    <td className="px-4 py-3 font-bold">
                      Rs. {getBillTotal(bill)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                        Pending
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        onClick={() =>
                          setSelectedBill(bill)
                        }
                      >
                        Open Bill
                      </Button>
                    </td>
                  </tr>
                ))}

                {filteredBills.length === 0 && (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-4 py-10 text-center text-slate-500"
                    >
                      No pending bills found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {selectedBill && (
        <BillingDialog
          open={!!selectedBill}
          session={selectedBill.session}
          onClose={() => setSelectedBill(null)}
          onReceivePayment={
            handleReceivePayment
          }
        />
      )}
    </main>
  );
}

export default CheckoutPage;
