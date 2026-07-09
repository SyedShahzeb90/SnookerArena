import { useMemo, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type {
  PaymentMethod,
  Session,
} from "@/types/session";

import { useCafeStore } from "@/features/cafe/store/cafeStore";

import BillingSummary from "./components/BillingSummary";
import PaymentMethodSelector from "./components/PaymentMethodSelector";
import PaymentFooter from "./components/PaymentFooter";

interface Props {
  open: boolean;
  session: Session;
  onClose: () => void;
  onReceivePayment: (
    paymentMethod: PaymentMethod
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

  const playerOrders = useCafeStore(
    (state) => state.playerOrders
  );

  const duration = useMemo(() => {
    if (!session.endTime)
      return "00:00:00";

    const ms =
      new Date(
        session.endTime
      ).getTime() -
      new Date(
        session.startTime
      ).getTime();

    const totalSeconds =
      Math.floor(ms / 1000);

    const hours = Math.floor(
      totalSeconds / 3600
    );

    const minutes = Math.floor(
      (totalSeconds % 3600) / 60
    );

    const seconds =
      totalSeconds % 60;

    return `${String(hours).padStart(
      2,
      "0"
    )}:${String(minutes).padStart(
      2,
      "0"
    )}:${String(seconds).padStart(
      2,
      "0"
    )}`;
  }, [session]);

  const player1Order =
    playerOrders.find(
      (p) =>
        p.tableId ===
          session.tableId &&
        p.playerName ===
          session.player1
    );

  const player2Order =
    session.player2
      ? playerOrders.find(
          (p) =>
            p.tableId ===
              session.tableId &&
            p.playerName ===
              session.player2
        )
      : undefined;

  const cafeAmount =
    (player1Order?.totalAmount ??
      0) +
    (player2Order?.totalAmount ??
      0);

  const total =
    session.gameAmount +
    cafeAmount -
    session.discount;

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            Billing
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-1 rounded-lg border p-4 text-sm">
          <div className="flex justify-between">
            <span>Table</span>

            <span>
              Table {session.tableId}
            </span>
          </div>

          <div className="flex justify-between">
            <span>Player</span>

            <span>
              {session.player1}
            </span>
          </div>

          {session.player2 && (
            <div className="flex justify-between">
              <span>
                Player 2
              </span>

              <span>
                {session.player2}
              </span>
            </div>
          )}

          <div className="flex justify-between">
            <span>
              Duration
            </span>

            <span>
              {duration}
            </span>
          </div>
        </div>

        <BillingSummary
          gameAmount={
            session.gameAmount
          }
          cafeAmount={
            cafeAmount
          }
          discount={
            session.discount
          }
        />

        <div className="rounded-lg border p-4">
          <h3 className="mb-3 font-semibold">
            Cafe Orders
          </h3>

          {player1Order?.orderItems.map(
            (item) => (
              <div
                key={`${session.player1}-${item.menuItemId}`}
                className="flex justify-between text-sm"
              >
                <span>
                  {session.player1}
                  {" • "}
                  {item.name}
                  {" × "}
                  {item.quantity}
                </span>

                <span>
                  Rs.
                  {" "}
                  {item.price *
                    item.quantity}
                </span>
              </div>
            )
          )}

          {player2Order?.orderItems.map(
            (item) => (
              <div
                key={`${session.player2}-${item.menuItemId}`}
                className="flex justify-between text-sm"
              >
                <span>
                  {session.player2}
                  {" • "}
                  {item.name}
                  {" × "}
                  {item.quantity}
                </span>

                <span>
                  Rs.
                  {" "}
                  {item.price *
                    item.quantity}
                </span>
              </div>
            )
          )}

          {cafeAmount === 0 && (
            <p className="text-sm text-gray-500">
              No cafe items.
            </p>
          )}
        </div>

        <PaymentMethodSelector
          value={
            paymentMethod
          }
          onChange={
            setPaymentMethod
          }
        />

        <PaymentFooter
          total={total}
          onReceivePayment={() =>
            onReceivePayment(
              paymentMethod
            )
          }
        />
      </DialogContent>
    </Dialog>
  );
}

export default BillingDialog;