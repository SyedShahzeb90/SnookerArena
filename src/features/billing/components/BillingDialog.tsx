import {
  useEffect,
  useState,
} from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type {
  CafeOrderItem,
  PaymentMethod,
  Session,
} from "@/types/session";
import type { PaymentSplit } from "@/features/sales/types/sale";
import type { Table } from "@/types/table";
import { getSessionPlayers } from "@/features/sessions/utils/sessionPlayers";

import BillingSummary from "./BillingSummary";
import PaymentMethodSelector from "./PaymentMethodSelector";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { calculateGamePrice } from "@/features/pricing/utils/calculateGamePrice";
import { calculateDoubleGamePayerBreakdown } from "@/features/sessions/utils/doubleGameBilling";
import { getWalkInDisplayName } from "@/features/sessions/utils/walkInLabel";

const emptyPaidPlayerNames: string[] = [];

interface Props {
  open: boolean;
  session: Session;
  tableType: Table["type"];
  tableName?: string;
  billNumber?: string;
  status?: string;
  onClose: () => void;
  onUpdateDiscount?: (discount: number) => void;
  canReceivePayment?: boolean;
  readOnly?: boolean;
  cancelledAt?: string;
  cancelledReason?: string;
  cancelledNote?: string;
  onPaymentBlocked?: () => void;
  paidPlayerNames?: string[];
  playerName?: string;
  onReceivePayment: (
    paymentMethod: PaymentMethod,
    payerName?: string,
    paymentSplits?: PaymentSplit[],
    discount?: number
  ) => void;
  onReceivePlayerBill?: (input: {
    paymentMethod: PaymentMethod;
    paymentSplits?: PaymentSplit[];
    payerName?: string;
    playerName: string;
    tableAmount: number;
    cafeAmount: number;
    cafeItems: CafeOrderItem[];
    allPlayerNames: string[];
    discount?: number;
  }) => void;
}

function BillingDialog({
  open,
  session,
  tableType,
  tableName,
  billNumber,
  status = "Pending",
  onClose,
  onUpdateDiscount,
  canReceivePayment = true,
  readOnly = false,
  cancelledAt,
  cancelledReason,
  cancelledNote,
  onPaymentBlocked,
  paidPlayerNames = emptyPaidPlayerNames,
  playerName,
  onReceivePayment,
  onReceivePlayerBill,
}: Props) {
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("cash");
  const [paymentSplits, setPaymentSplits] =
    useState<PaymentSplit[]>([]);
  const [paymentError, setPaymentError] =
    useState("");
  const [discountText, setDiscountText] =
    useState(String(session.discount ?? 0));
  const [appliedDiscount, setAppliedDiscount] =
    useState(session.discount ?? 0);
  const defaultPayer =
    session.player1?.trim() ||
    "Walk-in Customer";
  const players =
    getSessionPlayers(session);
  const [payerName, setPayerName] =
    useState(
      session.payerName ??
        session.loserName ??
        defaultPayer
    );
  const [paidPlayers, setPaidPlayers] =
    useState<string[]>(paidPlayerNames);

  useEffect(() => {
    setPayerName(
      session.payerName ??
        session.loserName ??
        defaultPayer
    );
    setPaidPlayers(paidPlayerNames);
    setPaymentSplits([]);
    setPaymentError("");
    setDiscountText(
      String(session.discount ?? 0)
    );
    setAppliedDiscount(
      session.discount ?? 0
    );
  }, [session, defaultPayer, paidPlayerNames]);

  const adjustedSession = {
    ...session,
    discount: appliedDiscount,
  };

  const pricing = session.endTime
    ? calculateGamePrice({
        sessionType:
        adjustedSession.sessionType,
        tableType,
        startTime: new Date(
          adjustedSession.startTime
        ),
        endTime: new Date(
          session.endTime
        ),
      })
    : undefined;

  const getItemPlayerName = (
    item: CafeOrderItem
  ) =>
    item.playerName ??
    item.customerName ??
    "";

  const playerBills = players.map(
    (playerName) => {
      const cafeItems =
        adjustedSession.cafeOrders.filter(
          (item) =>
            getItemPlayerName(item) ===
            playerName
        );
      const cafeAmount =
        cafeItems.reduce(
          (total, item) =>
            total + item.subtotal,
          0
        );
      const tableAmount =
        pricing
          ? calculateDoubleGamePayerBreakdown({
              session: {
                ...adjustedSession,
                payerName:
                  payerName || defaultPayer,
              },
              tableAmount:
                pricing.gameAmount,
            }).find(
              (payer) =>
                payer.playerName ===
                playerName
            )?.tableAmountShare ?? 0
          : 0;

      return {
        playerName,
        cafeItems,
        cafeAmount,
        tableAmount,
        total: cafeAmount + tableAmount,
      };
    }
  );
  const getPayableBillTotal = (
    bill: (typeof playerBills)[number]
  ) => {
    const shouldApplyDiscount =
      appliedDiscount > 0 &&
      (!payerName ||
        bill.playerName === payerName ||
        playerBills.length === 1);

    return Math.max(
      bill.total -
        (shouldApplyDiscount
          ? appliedDiscount
          : 0),
      0
    );
  };
  const payablePlayerBills =
    playerBills.filter(
      (bill) => bill.total > 0
    );
  const payablePlayerNames =
    payablePlayerBills.map(
      (bill) => bill.playerName
    );
  const visiblePlayerBills = playerName
    ? payablePlayerBills.filter(
        (bill) =>
          bill.playerName === playerName
      )
    : payablePlayerBills;
  const payableTotal = playerName
    ? visiblePlayerBills[0]
      ? getPayableBillTotal(
          visiblePlayerBills[0]
        )
      : 0
    : payablePlayerBills.reduce(
        (total, bill) =>
          total + getPayableBillTotal(bill),
        0
      );

  const getDisplayName = (name?: string) =>
    getWalkInDisplayName({
      name,
      tableId: session.tableId,
      tableName,
      tableType,
      time: session.startTime,
    });

  const updateDiscount = (value: string) => {
    const discount = Math.max(
      0,
      Number(value) || 0
    );

    setAppliedDiscount(discount);
    onUpdateDiscount?.(discount);
  };

  const getValidPaymentSplits = () => {
    if (paymentSplits.length === 0) {
      return undefined;
    }

    const cleaned = paymentSplits.filter(
      (split) => split.amount > 0
    );
    const splitTotal = cleaned.reduce(
      (total, split) => total + split.amount,
      0
    );

    if (splitTotal !== payableTotal) {
      alert(
        `Split payment total must be Rs. ${payableTotal}.`
      );
      return null;
    }

    return cleaned;
  };

  const handleReceivePlayerBill = (
    bill: (typeof playerBills)[number]
  ) => {
    if (!canReceivePayment) {
      setPaymentError(
        "Please start the day and enter the operator name before receiving payment."
      );
      onPaymentBlocked?.();
      return;
    }

    setPaymentError("");
    const validSplits = getValidPaymentSplits();
    if (validSplits === null) return;

    const playerName = bill.playerName;
    const nextPaidPlayers =
      paidPlayers.includes(playerName)
        ? paidPlayers
        : [...paidPlayers, playerName];

    setPaidPlayers(nextPaidPlayers);

    onReceivePlayerBill?.({
      paymentMethod,
      paymentSplits: validSplits,
      payerName: playerName,
      playerName,
      tableAmount: bill.tableAmount,
      cafeAmount: bill.cafeAmount,
      cafeItems: bill.cafeItems,
      allPlayerNames:
        payablePlayerNames,
      discount:
        getPayableBillTotal(bill) ===
        bill.total
          ? 0
          : appliedDiscount,
    });

    if (onReceivePlayerBill) {
      return;
    }

    const allBillsReceived =
      payablePlayerBills.every((bill) =>
        nextPaidPlayers.includes(
          bill.playerName
        )
      );

    if (allBillsReceived) {
      onReceivePayment(
        paymentMethod,
        payerName || defaultPayer,
        validSplits,
        appliedDiscount
      );
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onClose}
    >
      <DialogContent className="flex max-h-[90vh] w-[70vw] !max-w-[70vw] flex-col overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>
            Billing
          </DialogTitle>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto px-6 py-4 lg:grid-cols-[1.35fr_0.85fr]">
          <div className="min-w-0">
            <BillingSummary
              session={adjustedSession}
              tableType={tableType}
              tableName={tableName}
              billNumber={billNumber}
              status={status}
              payerName={payerName}
              playerName={playerName}
            />
            {readOnly &&
              (cancelledAt ||
                cancelledReason ||
                cancelledNote) && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                  <p className="font-semibold">
                    Cancellation
                  </p>
                  {cancelledAt && (
                    <p className="mt-2">
                      Cancelled At:{" "}
                      {new Date(
                        cancelledAt
                      ).toLocaleString([], {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  )}
                  {cancelledReason && (
                    <p>
                      Reason: {cancelledReason}
                    </p>
                  )}
                  {cancelledNote && (
                    <p>Note: {cancelledNote}</p>
                  )}
                </div>
              )}
          </div>

          {!readOnly && (
          <div className="min-w-0 space-y-4">
            {playerName ? (
              <div className="space-y-1 rounded-lg border p-4">
                <Label>Paying player</Label>
                <p className="font-semibold text-slate-950">
                  {getDisplayName(playerName)}
                </p>
              </div>
            ) : (
              <div className="space-y-2 rounded-lg border p-4">
                <Label>Who is paying?</Label>
                <Select
                  value={payerName || defaultPayer}
                  onValueChange={(value) => {
                    if (value) {
                      setPayerName(value);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose payer" />
                  </SelectTrigger>
                  <SelectContent>
                    {players.map((player) => (
                      <SelectItem
                        key={player}
                        value={player}
                      >
                        {getDisplayName(player)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Discount</Label>
              <Input
                type="number"
                min={0}
                value={discountText}
                onChange={(event) => {
                  const nextValue =
                    event.target.value;
                  setDiscountText(nextValue);
                  updateDiscount(nextValue);
                }}
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label>Payment Method</Label>
              <PaymentMethodSelector
                value={paymentMethod}
                onChange={
                  setPaymentMethod
                }
                totalAmount={payableTotal}
                splits={paymentSplits}
                onSplitsChange={
                  setPaymentSplits
                }
              />
            </div>
          </div>
          )}
        </div>

        {!readOnly && (
        <div className="space-y-3 border-t bg-white px-6 py-4 shadow-[0_-8px_20px_rgba(15,23,42,0.08)]">
          {paymentError && (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-red-200">
              {paymentError}
            </p>
          )}

          <div>
            <p className="font-semibold">
              Receive separate bills
            </p>
            <p className="text-sm text-slate-500">
              Receive each player's bill separately. The table will close after all bills are received.
            </p>
          </div>

          <div className="grid gap-3">
            {visiblePlayerBills.map((bill) => {
              const paid =
                paidPlayers.includes(
                  bill.playerName
                );

              return (
                <Button
                  key={bill.playerName}
                  className="h-auto min-h-16 justify-between gap-3 whitespace-normal rounded-lg px-4 py-3 text-left"
                  variant={
                    paid
                      ? "secondary"
                      : "default"
                  }
                  disabled={paid}
                  onClick={() =>
                    handleReceivePlayerBill(
                      bill
                    )
                  }
                >
                  <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold">
                      {paid
                        ? `${getDisplayName(
                            bill.playerName
                          )} bill received`
                        : `Receive ${getDisplayName(
                            bill.playerName
                          )} bill`}
                    </span>
                    <span className="text-xs font-normal opacity-80">
                      Snooker Rs. {bill.tableAmount} | Cafe Rs. {bill.cafeAmount}
                    </span>
                  </span>
                  <span className="shrink-0 text-base font-bold">
                    Rs. {getPayableBillTotal(bill)}
                  </span>
                </Button>
              );
            })}

            {visiblePlayerBills.length === 0 && (
              <p className="text-sm text-slate-500">
                No payable player bills.
              </p>
            )}
          </div>
        </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default BillingDialog;
