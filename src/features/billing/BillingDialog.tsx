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

  const duration = useMemo(() => {
    if (!session.endTime) return "00:00:00";

    const ms =
      new Date(session.endTime).getTime() -
      new Date(session.startTime).getTime();

    const totalSeconds = Math.floor(ms / 1000);

    const hours = Math.floor(totalSeconds / 3600);

    const minutes = Math.floor(
      (totalSeconds % 3600) / 60
    );

    const seconds = totalSeconds % 60;

    return `${String(hours).padStart(
      2,
      "0"
    )}:${String(minutes).padStart(
      2,
      "0"
    )}:${String(seconds).padStart(2, "0")}`;
  }, [session]);

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

        <BillingSummary
          session={session}
          duration={duration}
        />

        <PaymentMethodSelector
          value={paymentMethod}
          onChange={setPaymentMethod}
        />

        <PaymentFooter
          total={session.totalAmount}
          onReceivePayment={() =>
            onReceivePayment(paymentMethod)
          }
        />
      </DialogContent>
    </Dialog>
  );
}

export default BillingDialog;