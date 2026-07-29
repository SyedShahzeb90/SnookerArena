import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { useCheckoutStore } from "@/features/billing/store/checkoutStore";
import { useExpensesStore } from "@/features/expenses/store/expensesStore";
import { useSalesStore } from "@/features/sales/store/salesStore";
import { useOutsidePurchaseStore } from "@/features/outside-purchases/store/outsidePurchaseStore";
import { useCafeStore } from "@/features/cafe/store/cafeStore";
import { useClubSettingsStore } from "@/features/settings/store/clubSettingsStore";
import { formatAppDateTime, useAppDateTimeFormats } from "@/lib/dateTime";

import { useBusinessDayStore } from "../store/businessDayStore";
import { calculateBusinessDaySummary } from "../utils/businessDaySummary";

function money(value: number) {
  return `Rs. ${Math.round(value).toLocaleString()}`;
}

function dateTime(value: string) {
  return formatAppDateTime(value);
}

function BusinessDayCard() {
  useAppDateTimeFormats();
  const navigate = useNavigate();
  const toast = useToast();
  const activeDay =
    useBusinessDayStore((state) =>
      state.getActiveBusinessDay()
    );
  const lastClosedDay =
    useBusinessDayStore((state) =>
      state.getLastClosedBusinessDay()
    );
  const startBusinessDay =
    useBusinessDayStore(
      (state) => state.startBusinessDay
    );
  const closeBusinessDay =
    useBusinessDayStore(
      (state) => state.closeBusinessDay
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
  const operators = useClubSettingsStore(
    (state) => state.settings.operators
  );
  const activeOperators = useMemo(
    () => operators.filter((operator) => operator.isActive),
    [operators]
  );

  const summary = useMemo(
    () =>
      activeDay
        ? calculateBusinessDaySummary({
            day: activeDay,
            sales,
            expenses,
            pendingBills,
            outsidePurchases,
            vendorRestockingRecords,
          })
        : undefined,
    [activeDay, sales, expenses, pendingBills, outsidePurchases, vendorRestockingRecords]
  );

  const [startOpen, setStartOpen] =
    useState(false);
  const [endOpen, setEndOpen] =
    useState(false);
  const [operatorId, setOperatorId] =
    useState("");
  const [openingCash, setOpeningCash] =
    useState("");
  const [openingNotes, setOpeningNotes] =
    useState("");
  const [actualCash, setActualCash] =
    useState("");
  const [cashLeft, setCashLeft] =
    useState("");
  const [closedBy, setClosedBy] =
    useState("");
  const [closingNotes, setClosingNotes] =
    useState("");
  const [error, setError] = useState("");

  const expectedCash =
    summary?.expectedCash ?? 0;
  const actualCashNumber =
    Number(actualCash || 0);
  const cashLeftNumber =
    Number(cashLeft || 0);
  const cashTakenHome =
    actualCashNumber - cashLeftNumber;
  const difference =
    actualCashNumber - expectedCash;
  const openStart = (prefill?: number) => {
    setOperatorId(activeOperators[0]?.id ?? "");
    setOpeningCash(
      prefill !== undefined ? String(prefill) : ""
    );
    setOpeningNotes("");
    setError("");
    setStartOpen(true);
  };

  const handleStart = () => {
    const parsedCash = Number(openingCash);
    const selectedOperator = activeOperators.find(
      (operator) => operator.id === operatorId
    );

    if (!selectedOperator) {
      setError("Select an active operator. Add one in Club Settings if needed.");
      return;
    }

    if (
      !openingCash.trim() ||
      Number.isNaN(parsedCash) ||
      parsedCash < 0
    ) {
      setError(
        "Opening Cash must be 0 or greater."
      );
      return;
    }

    const day = startBusinessDay({
      openedBy: selectedOperator.name,
      operatorId: selectedOperator.id,
      openingCash: parsedCash,
      openingNotes: openingNotes.trim(),
    });

    if (day) {
      setStartOpen(false);
      toast.info({
        title: "Business Day Started",
        description: `Operator: ${selectedOperator.name}`,
      });
      navigate("/operator/tables-rooms");
    } else {
      setError(
        "A business day is already active."
      );
    }
  };

  const handleEnd = () => {
    const parsedActual = Number(actualCash);
    const parsedLeft = cashLeft.trim()
      ? Number(cashLeft)
      : 0;

    if (
      !actualCash.trim() ||
      Number.isNaN(parsedActual)
    ) {
      setError("Cash Counted is required.");
      return;
    }

    if (
      Number.isNaN(parsedLeft) ||
      parsedLeft < 0
    ) {
      setError(
        "Cash Left for Staff must be 0 or greater."
      );
      return;
    }

    if (!closedBy.trim()) {
      setError("Closed By is required.");
      return;
    }

    if (parsedLeft > parsedActual) {
      setError(
        "Cash Left for Staff cannot be greater than Cash Counted."
      );
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to close this business day?"
    );

    if (!confirmed) return;

    const closedDay = closeBusinessDay({
      actualCashCounted: parsedActual,
      cashLeftForStaff: parsedLeft,
      closedBy: closedBy.trim(),
      closingNotes: closingNotes.trim(),
      summary,
    });
    setEndOpen(false);
    if (closedDay) {
      toast.success({
        title: "Business Day Closed",
        description: `Closed by ${closedBy.trim()}.`,
      });
      navigate("/operator/business-day");
    }
  };

  const openEnd = () => {
    setActualCash(
      String(summary?.expectedCash ?? "")
    );
    setCashLeft("0");
    setClosedBy(activeDay?.openedBy ?? "");
    setClosingNotes("");
    setError("");
    setEndOpen(true);
  };

  return (
    <>
      <Card
        className={`border-emerald-100 bg-white shadow-sm ${
          activeDay ? "p-4" : "p-5"
        }`}
      >
        {!activeDay ? (
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-500">
                Business Day
              </p>
              <h2 className="mt-1 text-2xl font-bold text-slate-950">
                No active business day
              </h2>
            </div>

            <div className="flex flex-wrap gap-2">
              {lastClosedDay?.cashLeftForStaff !==
                undefined && (
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() =>
                    openStart(
                      lastClosedDay.cashLeftForStaff
                    )
                  }
                >
                  Start New Day with{" "}
                  {money(
                    lastClosedDay.cashLeftForStaff
                  )}
                </Button>
              )}
              <Button
                size="lg"
                onClick={() => openStart()}
              >
                Start Day
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() =>
                  navigate(
                    "/operator/day-history"
                  )
                }
              >
                Day History
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]" />
                  <span>Business Day Active</span>
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">
                  Opened by {activeDay.openedBy}
                </h2>
                <p className="text-sm text-slate-500">
                  Started:{" "}
                  {dateTime(activeDay.startedAt)}
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="h-9 px-3"
                  onClick={() =>
                    navigate(
                      "/operator/day-history"
                    )
                  }
                >
                  Day History
                </Button>
                <Button
                  className="h-9 bg-red-700 px-4 !text-white hover:bg-red-800 dark:!bg-red-600 dark:hover:!bg-red-500"
                  onClick={openEnd}
                >
                  End Day
                </Button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="flex h-[144px] flex-col rounded-lg border border-emerald-100 bg-emerald-50/40 p-3.5 dark:!border-emerald-800 dark:!bg-emerald-950/55">
                <p className="text-xs font-semibold text-slate-500">
                  Today Received
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-950">
                  {money(summary?.totalSales ?? 0)}
                </p>
                <div className="mt-auto grid grid-cols-2 gap-3 pt-2 text-sm">
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500">
                      Cash
                    </p>
                    <p className="font-semibold tabular-nums text-emerald-700">
                      {money(summary?.cashSales ?? 0)}
                    </p>
                  </div>
                  <div className="min-w-0 text-right">
                    <p className="text-xs text-slate-500">
                      Digital
                    </p>
                    <p className="font-semibold tabular-nums text-slate-800">
                      {money(
                        (summary?.cardSales ?? 0) +
                          (summary?.jazzCashSales ?? 0) +
                          (summary?.easypaisaSales ?? 0)
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex h-[144px] flex-col rounded-lg border border-emerald-100 bg-emerald-50/40 p-3.5 dark:!border-emerald-800 dark:!bg-emerald-950/55">
                <p className="text-xs font-semibold text-slate-500">
                  Cafe Sales Today
                </p>
                <p className="mt-2 text-2xl font-bold text-emerald-700">
                  {money(summary?.cafeSales ?? 0)}
                </p>
                <p className="mt-auto pt-2 text-xs text-slate-500">
                  Paid cafe revenue
                </p>
              </div>

              <button
                type="button"
                className="flex h-[144px] cursor-pointer flex-col rounded-lg border border-amber-100 bg-amber-50/40 p-3.5 text-left transition hover:border-amber-300 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:!border-amber-800 dark:!bg-amber-950/55"
                onClick={() => navigate("/operator/customer-bills")}
                aria-label="Open customer bills"
              >
                <p className="text-xs font-semibold text-slate-500">
                  Pending Bills
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-950">
                  {money(summary?.pendingBillsAmount ?? 0)}
                </p>
                <p className="mt-auto pt-2 text-sm font-medium text-amber-700">
                  {summary?.pendingBillsCount ?? 0} open{" "}
                  {(summary?.pendingBillsCount ?? 0) === 1
                    ? "bill"
                    : "bills"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Awaiting payment
                </p>
              </button>

              <div className="flex h-[144px] flex-col rounded-lg border border-red-100 bg-red-50/40 p-3.5 dark:!border-red-800 dark:!bg-red-950/55">
                <p className="text-xs font-semibold text-slate-500">
                  Expenses
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-950">
                  {money(summary?.totalExpenses ?? 0)}
                </p>
                <div className="mt-auto pt-2">
                  {(summary?.totalExpenses ?? 0) > 0 ? (
                    <p className="text-sm font-medium text-red-700">
                      Recorded today
                    </p>
                  ) : (
                    <p className="text-sm text-slate-500">
                      No expenses
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      <Dialog
        open={startOpen}
        onOpenChange={setStartOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Day</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            autoComplete="off"
            onSubmit={(event) => {
              event.preventDefault();
              handleStart();
            }}
          >
            <div>
              <Label htmlFor="start-day-operator">Operator Name</Label>
              <select
                id="start-day-operator"
                name="start-day-operator"
                autoComplete="off"
                className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                value={operatorId}
                onChange={(event) => {
                  setOperatorId(event.target.value);
                  setError("");
                }}
              >
                <option value="">Select operator</option>
                {activeOperators.map((operator) => (
                  <option key={operator.id} value={operator.id}>
                    {operator.name}
                  </option>
                ))}
              </select>
              {activeOperators.length === 0 && (
                <p className="mt-1 text-xs text-amber-700">
                  No active operators. Add or enable an operator in Club Settings.
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="start-day-opening-cash">Opening Cash</Label>
              <Input
                id="start-day-opening-cash"
                name="start-day-opening-cash"
                type="number"
                min="0"
                autoComplete="off"
                value={openingCash}
                onChange={(event) =>
                  setOpeningCash(
                    event.target.value
                  )
                }
              />
            </div>
            <div>
              <Label htmlFor="start-day-opening-notes">Opening Notes</Label>
              <Textarea
                id="start-day-opening-notes"
                name="start-day-opening-notes"
                autoComplete="off"
                value={openingNotes}
                onChange={(event) =>
                  setOpeningNotes(
                    event.target.value
                  )
                }
              />
            </div>
            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {error}
              </p>
            )}
            <Button
              type="submit"
              className="w-full"
            >
              Start Day
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={endOpen}
        onOpenChange={setEndOpen}
      >
        <DialogContent className="flex max-h-[90vh] w-[min(94vw,760px)] !max-w-[760px] flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              End Day / Cash Handover
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 space-y-4 overflow-x-hidden overflow-y-auto pr-1 [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {[
                [
                  "Total Sales",
                  summary?.totalSales ?? 0,
                ],
                [
                  "Cash Sales",
                  summary?.cashSales ?? 0,
                ],
                [
                  "Expenses",
                  summary?.totalExpenses ?? 0,
                ],
                [
                  "Expected Cash",
                  summary?.expectedCash ?? 0,
                ],
                [
                  "Card Sales",
                  summary?.cardSales ?? 0,
                ],
                [
                  "JazzCash",
                  summary?.jazzCashSales ?? 0,
                ],
                [
                  "Easypaisa",
                  summary?.easypaisaSales ?? 0,
                ],
                [
                  "Net Profit",
                  summary?.netProfit ?? 0,
                ],
                [
                  "Customer Outside Purchases Paid Out",
                  summary?.outsidePurchasesPaidFromDrawer ?? 0,
                ],
                [
                  "Cash Reimbursements",
                  summary?.cashCustomerReimbursements ?? 0,
                ],
                [
                  "Digital Reimbursements",
                  summary?.digitalCustomerReimbursements ?? 0,
                ],
                [
                  "Outstanding Reimbursements",
                  summary?.outstandingCustomerReimbursements ?? 0,
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="min-w-0 rounded-lg border p-3"
                >
                  <p className="break-words text-xs leading-4 text-slate-500">
                    {label}
                  </p>
                  <p className="mt-1 whitespace-nowrap font-bold tabular-nums">
                    {money(Number(value))}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Cash Counted</Label>
                <Input
                  type="number"
                  value={actualCash}
                  onChange={(event) =>
                    setActualCash(
                      event.target.value
                    )
                  }
                />
              </div>
              <div>
                <Label>Closed By</Label>
                <Input
                  value={closedBy}
                  onChange={(event) =>
                    setClosedBy(
                      event.target.value
                    )
                  }
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">
                  Cash Taken Home
                </p>
                <p className="font-bold">
                  {money(
                    Number.isFinite(
                      cashTakenHome
                    )
                      ? cashTakenHome
                      : 0
                  )}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">
                  Difference
                </p>
                <p className="font-bold">
                  {money(difference)}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">
                  Result
                </p>
                <p className="font-bold">
                  {difference < 0
                    ? `Shortage ${money(
                        Math.abs(difference)
                      )}`
                    : difference > 0
                      ? `Extra Cash ${money(
                          difference
                        )}`
                      : "Cash Matched"}
                </p>
              </div>
            </div>

            <div>
              <Label>
                Cash Left for Staff
              </Label>
              <Input
                type="number"
                value={cashLeft}
                placeholder="0"
                onChange={(event) =>
                  setCashLeft(
                    event.target.value
                  )
                }
                className="h-12 text-lg font-semibold"
              />
              <p className="mt-1 text-xs text-slate-500">
                Enter the cash amount kept for staff. Use 0 if nothing is left.
              </p>
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {error}
              </p>
            )}

            <Button
              className="w-full bg-red-700 font-semibold text-white hover:bg-red-800 hover:text-white disabled:text-white"
              onClick={handleEnd}
            >
              Close Business Day
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function CashPositionSummaryCard() {
  const activeDay = useBusinessDayStore((state) =>
    state.getActiveBusinessDay()
  );
  const sales = useSalesStore((state) => state.sales);
  const expenses = useExpensesStore((state) => state.expenses);
  const pendingBills = useCheckoutStore((state) => state.pendingBills);
  const outsidePurchases = useOutsidePurchaseStore((state) => state.purchases);
  const vendorRestockingRecords = useCafeStore(
    (state) => state.vendorRestockingRecords
  );
  const summary = useMemo(
    () =>
      activeDay
        ? calculateBusinessDaySummary({
            day: activeDay,
            sales,
            expenses,
            pendingBills,
            outsidePurchases,
            vendorRestockingRecords,
          })
        : undefined,
    [
      activeDay,
      expenses,
      outsidePurchases,
      pendingBills,
      sales,
      vendorRestockingRecords,
    ]
  );
  const reimbursementBreakdown = [
    ["Cash", summary?.cashCustomerReimbursements ?? 0],
    ["Card", summary?.cardCustomerReimbursements ?? 0],
    ["JazzCash", summary?.jazzCashCustomerReimbursements ?? 0],
    ["Easypaisa", summary?.easypaisaCustomerReimbursements ?? 0],
  ].filter(([, amount]) => Number(amount) > 0);
  const totalReimbursed = reimbursementBreakdown.reduce(
    (total, [, amount]) => total + Number(amount),
    0
  );

  return (
    <>
      <Card className="flex min-h-[184px] flex-col rounded-lg border-blue-100 bg-blue-50/40 p-4 shadow-sm dark:!border-blue-800 dark:!bg-blue-950/55">
        <div>
          <p className="text-xs font-semibold text-slate-500">Cash Position</p>
          <p className="mt-1 text-sm text-slate-500">
            Physical drawer movement
          </p>
        </div>
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500">Opening Cash</span>
            <strong className="whitespace-nowrap tabular-nums text-slate-800">
              {money(activeDay?.openingCash ?? 0)}
            </strong>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500">Cash Sales</span>
            <strong className="whitespace-nowrap tabular-nums text-slate-800">
              {money(summary?.cashSales ?? 0)}
            </strong>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500">Outside Cash Paid</span>
            <strong className="whitespace-nowrap tabular-nums text-red-700">
              -{money(summary?.outsidePurchasesPaidFromDrawer ?? 0)}
            </strong>
          </div>
        </div>
        <div className="mt-auto flex items-center justify-between gap-3 rounded-md bg-blue-100/60 px-3 py-2 dark:!bg-blue-900/80">
          <span className="font-medium text-slate-600 dark:!text-blue-100">
            Expected Cash
          </span>
          <strong className="whitespace-nowrap text-xl text-blue-800 dark:!text-blue-200">
            {money(summary?.expectedCash ?? activeDay?.openingCash ?? 0)}
          </strong>
        </div>
      </Card>

      <Card className="flex min-h-[184px] flex-col rounded-lg border-emerald-100 bg-emerald-50/40 p-4 shadow-sm dark:!border-emerald-800 dark:!bg-emerald-950/55">
        <div>
          <p className="text-xs font-semibold text-slate-500">
            Customer Reimbursements
          </p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">
            {money(totalReimbursed)}
          </p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-1.5 text-xs">
          {[
            ["Cash", summary?.cashCustomerReimbursements ?? 0],
            ["Easypaisa", summary?.easypaisaCustomerReimbursements ?? 0],
            ["JazzCash", summary?.jazzCashCustomerReimbursements ?? 0],
            ["Card", summary?.cardCustomerReimbursements ?? 0],
          ].map(([method, amount]) => (
            <div
              key={String(method)}
              className="flex items-center justify-between gap-2"
            >
              <span className="text-slate-500">{method}</span>
              <strong className="whitespace-nowrap tabular-nums text-slate-800">
                {money(Number(amount))}
              </strong>
            </div>
          ))}
        </div>
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-emerald-100 pt-2 text-xs dark:border-emerald-800">
          <span className="text-slate-500">Still outstanding</span>
          <strong className="whitespace-nowrap tabular-nums text-amber-700">
            {money(summary?.outstandingCustomerReimbursements ?? 0)}
          </strong>
        </div>
      </Card>
    </>
  );
}

export default BusinessDayCard;
