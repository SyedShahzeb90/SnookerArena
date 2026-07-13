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
import { useCheckoutStore } from "@/features/billing/store/checkoutStore";
import { useExpensesStore } from "@/features/expenses/store/expensesStore";
import { useSalesStore } from "@/features/sales/store/salesStore";

import { useBusinessDayStore } from "../store/businessDayStore";
import { calculateBusinessDaySummary } from "../utils/businessDaySummary";

function money(value: number) {
  return `Rs. ${value}`;
}

function dateTime(value: string) {
  return new Date(value).toLocaleString(
    "en-PK",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  );
}

function BusinessDayCard() {
  const navigate = useNavigate();
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
  const message = useBusinessDayStore(
    (state) => state.message
  );

  const summary = useMemo(
    () =>
      activeDay
        ? calculateBusinessDaySummary({
            day: activeDay,
            sales,
            expenses,
            pendingBills,
          })
        : undefined,
    [activeDay, sales, expenses, pendingBills]
  );

  const [startOpen, setStartOpen] =
    useState(false);
  const [endOpen, setEndOpen] =
    useState(false);
  const [operatorName, setOperatorName] =
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
    setOperatorName("");
    setOpeningCash(
      prefill !== undefined ? String(prefill) : ""
    );
    setOpeningNotes("");
    setError("");
    setStartOpen(true);
  };

  const handleStart = () => {
    const parsedCash = Number(openingCash);

    if (!operatorName.trim()) {
      setError("Operator Name is required.");
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
      openedBy: operatorName.trim(),
      openingCash: parsedCash,
      openingNotes: openingNotes.trim(),
    });

    if (day) {
      setStartOpen(false);
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

    closeBusinessDay({
      actualCashCounted: parsedActual,
      cashLeftForStaff: parsedLeft,
      closedBy: closedBy.trim(),
      closingNotes: closingNotes.trim(),
      summary,
    });
    setEndOpen(false);
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
      <Card className="mb-5 border-emerald-100 bg-white p-5 shadow-sm">
        {!activeDay ? (
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-500">
                Business Day
              </p>
              <h2 className="mt-1 text-2xl font-bold text-slate-950">
                No active business day
              </h2>
              {message && (
                <p className="mt-2 text-sm font-medium text-emerald-700">
                  {message}
                </p>
              )}
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
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-emerald-700">
                  Business Day Active
                </p>
                <h2 className="mt-1 text-2xl font-bold text-slate-950">
                  Opened by {activeDay.openedBy}
                </h2>
                <p className="text-sm text-slate-500">
                  Started:{" "}
                  {dateTime(activeDay.startedAt)}
                </p>
              </div>

              <div className="flex gap-2">
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
                <Button
                  size="lg"
                  className="bg-red-700 hover:bg-red-800"
                  onClick={openEnd}
                >
                  End Day
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
              {[
                [
                  "Opening Cash",
                  money(activeDay.openingCash),
                ],
                [
                  "Today Received",
                  money(summary?.totalSales ?? 0),
                ],
                [
                  "Cash Sales",
                  money(summary?.cashSales ?? 0),
                ],
                [
                  "Expected Cash",
                  money(summary?.expectedCash ?? 0),
                ],
                [
                  "Pending Bills",
                  money(
                    summary?.pendingBillsAmount ??
                      0
                  ),
                ],
                [
                  "Expenses",
                  money(
                    summary?.totalExpenses ?? 0
                  ),
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-lg bg-slate-50 p-3"
                >
                  <p className="text-xs text-slate-500">
                    {label}
                  </p>
                  <p className="mt-1 font-bold text-slate-950">
                    {value}
                  </p>
                </div>
              ))}
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
          <div className="space-y-4">
            <div>
              <Label>Operator Name</Label>
              <Input
                value={operatorName}
                onChange={(event) =>
                  setOperatorName(
                    event.target.value
                  )
                }
              />
            </div>
            <div>
              <Label>Opening Cash</Label>
              <Input
                type="number"
                min="0"
                value={openingCash}
                onChange={(event) =>
                  setOpeningCash(
                    event.target.value
                  )
                }
              />
            </div>
            <div>
              <Label>Opening Notes</Label>
              <Textarea
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
              className="w-full"
              onClick={handleStart}
            >
              Start Day
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={endOpen}
        onOpenChange={setEndOpen}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              End Day / Cash Handover
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[75vh] space-y-4 overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
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
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-lg border p-3"
                >
                  <p className="text-xs text-slate-500">
                    {label}
                  </p>
                  <p className="font-bold">
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
              className="w-full bg-red-700 hover:bg-red-800"
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

export default BusinessDayCard;
