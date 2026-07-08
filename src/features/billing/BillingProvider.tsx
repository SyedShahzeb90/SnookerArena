import { useState } from "react";

import type { ReactNode } from "react";

import type {
  PaymentMethod,
  Session,
} from "@/types/session";

import { useTableStore } from "@/store/tableStore";

import BillingDialog from "./BillingDialog";
import { BillingContext } from "./BillingContext";

interface Props {
  children: ReactNode;
}

function BillingProvider({
  children,
}: Props) {
  const receivePayment =
    useTableStore(
      (state) => state.receivePayment
    );

  const [open, setOpen] =
    useState(false);

  const [tableId, setTableId] =
    useState<number | null>(null);

  const [session, setSession] =
    useState<Session | null>(null);

  function openBilling(
    tableId: number,
    session: Session
  ) {
    setTableId(tableId);
    setSession(session);
    setOpen(true);
  }

  function closeBilling() {
    setOpen(false);
  }

  function handleReceivePayment(
    paymentMethod: PaymentMethod
  ) {
    if (
      tableId === null ||
      session === null
    )
      return;

    receivePayment({
      tableId,
      paymentMethod,
    });

    closeBilling();
  }

  return (
    <BillingContext.Provider
      value={{
        open,
        session,
        tableId,
        openBilling,
        closeBilling,
      }}
    >
      {children}

      {session && (
        <BillingDialog
          open={open}
          session={session}
          onClose={closeBilling}
          onReceivePayment={
            handleReceivePayment
          }
        />
      )}
    </BillingContext.Provider>
  );
}

export default BillingProvider;