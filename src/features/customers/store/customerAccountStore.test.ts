import { beforeEach, describe, expect, it } from "vitest";

import { useCustomerAccountStore } from "./customerAccountStore";

describe("Final game offsets on existing customer bills", () => {
  beforeEach(() => {
    useCustomerAccountStore.getState().resetCustomerAccountsForTesting();
  });

  it("clears two existing games exactly once after winning Final 2", () => {
    const store = useCustomerAccountStore.getState();
    const account = store.createCustomerAccount({
      customerName: "adeel",
    });

    store.addGameChargeToCustomer({
      customerId: account.id,
      customerName: "adeel",
      sessionId: "OLD-SESSION",
      tableId: 1,
      tableName: "Table 1",
      tableType: "table",
      sessionType: "single",
      startedAt: "2026-07-24T00:00:00.000Z",
      endedAt: "2026-07-24T00:20:00.000Z",
      durationMinutes: 20,
      payerName: "adeel",
      amount: 600,
      shareType: "full",
      gameCount: 2,
      originalAmount: 600,
      sourceFrameIds: ["FRAME-1", "FRAME-2"],
    });

    expect(
      store.applyFinalGamesToExistingBill(
        account.id,
        2,
        "FINAL-2-WIN"
      )
    ).toBe(2);
    expect(
      useCustomerAccountStore.getState().getCustomerById(account.id)
        ?.totalGameAmount
    ).toBe(0);

    useCustomerAccountStore
      .getState()
      .markCustomerBillSettledByAdvance(account.id);
    expect(
      useCustomerAccountStore.getState().getCustomerById(account.id)
        ?.paymentStatus
    ).toBe("paid");

    expect(
      useCustomerAccountStore
        .getState()
        .applyFinalGamesToExistingBill(account.id, 2, "FINAL-2-WIN")
    ).toBe(0);
  });
});
