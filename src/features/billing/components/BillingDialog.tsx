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

import BillingSummary from "./BillingSummary";
import PaymentMethodSelector from "./PaymentMethodSelector";
import PaymentActions from "./PaymentActions";

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

  return (
    <Dialog
      open={open}
      onOpenChange={onClose}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Billing
          </DialogTitle>
        </DialogHeader>

        <BillingSummary
          gameAmount={session.gameAmount}
          cafeAmount={session.cafeAmount}
          discount={session.discount}
        />

        <PaymentMethodSelector
          value={paymentMethod}
          onChange={setPaymentMethod}
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