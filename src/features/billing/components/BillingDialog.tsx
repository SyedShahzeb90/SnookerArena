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
import { calculateGamePrice } from "@/features/pricing/utils/calculateGamePrice";

interface Props {
  open: boolean;
  session: Session;
  onClose: () => void;
  onReceivePayment: (
    paymentMethod: PaymentMethod,
    payerName?: string
  ) => void;
}

function BillingDialog({
  open,
  session,
  onClose,
  onReceivePayment,
}: Props) {
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("cash");
  const defaultPayer =
    session.player1?.trim() ||
    "Walk-in Customer";
  const players = [
    session.player1?.trim() ||
      defaultPayer,
    session.player2?.trim(),
  ].filter(Boolean) as string[];
  const [payerName, setPayerName] =
    useState(
      session.payerName ??
        session.loserName ??
        defaultPayer
    );
  const [paidPlayers, setPaidPlayers] =
    useState<string[]>([]);

  useEffect(() => {
    setPayerName(
      session.payerName ??
        session.loserName ??
        defaultPayer
    );
    setPaidPlayers([]);
  }, [session, defaultPayer]);

  const pricing = session.endTime
    ? calculateGamePrice({
        sessionType:
          session.sessionType,
        tableType: "table",
        startTime: new Date(
          session.startTime
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
        session.cafeOrders.filter(
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
        (payerName || defaultPayer) ===
        playerName
          ? pricing?.gameAmount ?? 0
          : 0;

      return {
        playerName,
        cafeAmount,
        tableAmount,
        total: cafeAmount + tableAmount,
      };
    }
  );

  const handleReceivePlayerBill = (
    playerName: string
  ) => {
    const nextPaidPlayers =
      paidPlayers.includes(playerName)
        ? paidPlayers
        : [...paidPlayers, playerName];

    setPaidPlayers(nextPaidPlayers);

    const allBillsReceived =
      playerBills.every((bill) =>
        nextPaidPlayers.includes(
          bill.playerName
        )
      );

    if (allBillsReceived) {
      onReceivePayment(
        paymentMethod,
        payerName || defaultPayer
      );
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onClose}
    >
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>
            Billing
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <BillingSummary
            session={session}
            payerName={payerName}
          />

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
                    {player}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-slate-500">
              The loser is selected by default. Change this only if someone else is paying.
            </p>
          </div>

          <PaymentMethodSelector
            value={paymentMethod}
            onChange={
              setPaymentMethod
            }
          />
        </div>

        <div className="space-y-3 border-t bg-white px-6 py-4 shadow-[0_-8px_20px_rgba(15,23,42,0.08)]">
          <div>
            <p className="font-semibold">
              Receive separate bills
            </p>
            <p className="text-sm text-slate-500">
              Receive each player's bill separately. The table will close after all bills are received.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {playerBills.map((bill) => {
              const paid =
                paidPlayers.includes(
                  bill.playerName
                );

              return (
                <Button
                  key={bill.playerName}
                  className="h-12 text-base"
                  variant={
                    paid
                      ? "secondary"
                      : "default"
                  }
                  disabled={paid}
                  onClick={() =>
                    handleReceivePlayerBill(
                      bill.playerName
                    )
                  }
                >
                  {paid
                    ? `${bill.playerName} Bill Received`
                    : `Receive ${bill.playerName} Bill - Rs. ${bill.total}`}
                </Button>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default BillingDialog;
