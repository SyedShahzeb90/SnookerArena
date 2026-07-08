import { createContext } from "react";

import type { Session } from "@/types/session";

interface BillingContextValue {
  open: boolean;

  session: Session | null;

  tableId: number | null;

  openBilling: (
    tableId: number,
    session: Session
  ) => void;

  closeBilling: () => void;
}

export const BillingContext =
  createContext<BillingContextValue | null>(
    null
  );