import { ReceiptText } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { PaymentMethod } from "@/types/session";

import BillingDialog from "./BillingDialog";
import {
  useCheckoutStore,
  type PendingBill,
} from "../store/checkoutStore";
import { getSessionPlayers } from "@/features/sessions/utils/sessionPlayers";
import { getWalkInDisplayName } from "@/features/sessions/utils/walkInLabel";

function CheckoutPanel() {
  const pendingBills = useCheckoutStore(
    (state) =>
      state.pendingBills.filter(
        (bill) =>
          bill.status !== "cancelled"
      )
  );
  const receivePendingBillPayment =
    useCheckoutStore(
      (state) =>
        state.receivePendingBillPayment
    );
  const receivePendingPlayerBillPayment =
    useCheckoutStore(
      (state) =>
        state.receivePendingPlayerBillPayment
    );

  const [selectedBill, setSelectedBill] =
    useState<PendingBill | null>(null);

  const getBillDisplayName = (
    bill: PendingBill,
    name?: string
  ) =>
    getWalkInDisplayName({
      name,
      tableId: bill.tableId,
      tableName: bill.tableName,
      tableType: bill.tableType,
      time: bill.session.startTime,
    });

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

  const handleReceivePlayerBill = (input: {
    paymentMethod: PaymentMethod;
    payerName?: string;
    playerName: string;
    tableAmount: number;
    cafeAmount: number;
    cafeItems: PendingBill["session"]["cafeOrders"];
    allPlayerNames: string[];
  }) => {
    if (!selectedBill) return;

    receivePendingPlayerBillPayment({
      billId: selectedBill.id,
      ...input,
    });

    const paidPlayerNames =
      selectedBill.paidPlayerNames ?? [];
    const nextPaidPlayerNames =
      paidPlayerNames.includes(
        input.playerName
      )
        ? paidPlayerNames
        : [
            ...paidPlayerNames,
            input.playerName,
          ];
    const allBillsReceived =
      input.allPlayerNames.every((name) =>
        nextPaidPlayerNames.includes(name)
      );

    if (allBillsReceived) {
      setSelectedBill(null);
    } else {
      setSelectedBill({
        ...selectedBill,
        paidPlayerNames:
          nextPaidPlayerNames,
      });
    }
  };

  return (
    <section className="mt-6">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-slate-700 shadow-sm ring-1 ring-slate-200">
          <ReceiptText className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-950">
            Customer Bills / Checkout
          </h2>
          <p className="text-sm text-slate-500">
            Ended game bills waiting for payment.
          </p>
        </div>
      </div>

      {pendingBills.length === 0 ? (
        <Card className="rounded-lg border-dashed p-6 text-center text-slate-500">
          No pending bills.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pendingBills.map((bill) => (
            <Card
              key={bill.id}
              className="rounded-lg p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-950">
                    {bill.tableName}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {getSessionPlayers(
                      bill.session
                    )
                      .map((player) =>
                        getBillDisplayName(
                          bill,
                          player
                        )
                      )
                      .join(" vs ")}
                  </p>
                </div>

                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                  Pending
                </span>
              </div>

              <div className="mt-4 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Winner</span>
                  <span>
                    {bill.session.winnerName ??
                      "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Payer</span>
                  <span className="font-semibold">
                    {bill.session.payerName
                      ? getBillDisplayName(
                          bill,
                          bill.session
                            .payerName
                        )
                      : "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Cafe</span>
                  <span>
                    Rs. {bill.session.cafeAmount}
                  </span>
                </div>
              </div>

              <Button
                className="mt-4 w-full"
                onClick={() =>
                  setSelectedBill(bill)
                }
              >
                Open Bill
              </Button>
            </Card>
          ))}
        </div>
      )}

      {selectedBill && (
        <BillingDialog
          open={!!selectedBill}
          session={selectedBill.session}
          tableType={selectedBill.tableType}
          tableName={selectedBill.tableName}
          paidPlayerNames={
            selectedBill.paidPlayerNames
          }
          onClose={() => setSelectedBill(null)}
          onReceivePayment={
            handleReceivePayment
          }
          onReceivePlayerBill={
            handleReceivePlayerBill
          }
        />
      )}
    </section>
  );
}

export default CheckoutPanel;
