import { useContext } from "react";

import { BillingContext } from "../BillingContext";

function useBilling() {
  const context =
    useContext(BillingContext);

  if (!context) {
    throw new Error(
      "useBilling must be used inside BillingProvider."
    );
  }

  return context;
}

export default useBilling;