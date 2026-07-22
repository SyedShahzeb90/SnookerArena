import { useState } from "react";

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

import BillingSummary from "./components/BillingSummary";
import PaymentMethodSelector from "./components/PaymentMethodSelector";
import PaymentActions from "./components/PaymentActions";
import { useClubSettingsStore } from "@/features/settings/store/clubSettingsStore";

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
    useState<PaymentMethod>(() =>
      useClubSettingsStore.getState().settings.defaultPaymentMethod
    );

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] w-[min(96vw,960px)] !max-w-[960px] overflow-y-auto border-slate-300 shadow-2xl dark:border-slate-700">
        <DialogHeader>
          <DialogTitle>
            Billing
          </DialogTitle>
        </DialogHeader>

        <BillingSummary
          session={session}
          tableType="table"
        />

        {session.cafeOrders.length > 0 && (
          <div className="rounded-lg border p-4">
            <h3 className="mb-3 font-semibold">
              Cafe Orders
            </h3>

            <div className="space-y-2">
              {session.cafeOrders.map(
                (item) => (
                  <div
                    key={`${item.menuItemId}-${item.timeAdded}`}
                    className="flex justify-between text-sm"
                  >
                    <span>
                      {item.name} x
                      {item.quantity}
                    </span>
                    <span>
                      Rs. {item.subtotal}
                    </span>
                  </div>
                )
              )}
            </div>
          </div>
        )}

        <PaymentMethodSelector
          value={paymentMethod}
          onChange={
            setPaymentMethod
          }
        />

        <PaymentActions
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
