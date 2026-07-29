import { beforeEach, describe, expect, it } from "vitest";

import { useAdvanceGamesStore } from "@/features/advance-games/store/advanceGamesStore";
import { useCustomerAccountStore } from "./customerAccountStore";

describe("customer bill advance award lifecycle", () => {
  beforeEach(() => {
    useCustomerAccountStore
      .getState()
      .resetCustomerAccountsForTesting();
    useAdvanceGamesStore
      .getState()
      .resetAdvanceGamesStore();
  });

  it("releases a pending award only when its linked bill is paid", () => {
    const winner = useCustomerAccountStore
      .getState()
      .createCustomerAccount({
        customerName: "Winner",
      });
    const loser = useCustomerAccountStore
      .getState()
      .createCustomerAccount({
        customerName: "Loser",
      });

    useAdvanceGamesStore.getState().stageEarn({
      transactionId: "ADV-SESSION-1-FRAME-1",
      customerId: winner.id,
      customerName: winner.customerName,
      games: 3,
      tableId: 1,
      tableName: "Table 1",
      sessionId: "SESSION-1",
      frameId: "FRAME-1",
      finalGames: 3,
      billId: winner.id,
    });

    useCustomerAccountStore
      .getState()
      .markCustomerBillPaid({
        customerId: loser.id,
        paymentMethod: "cash",
      });

    expect(
      useAdvanceGamesStore
        .getState()
        .getBalance(winner.id)
    ).toBe(0);
    expect(
      useAdvanceGamesStore.getState().pendingAwards
    ).toHaveLength(1);

    useCustomerAccountStore
      .getState()
      .markCustomerBillPaid({
        customerId: winner.id,
        paymentMethod: "cash",
      });

    expect(
      useAdvanceGamesStore
        .getState()
        .getBalance(winner.id)
    ).toBe(3);
    expect(
      useAdvanceGamesStore.getState().pendingAwards
    ).toHaveLength(0);

    useCustomerAccountStore
      .getState()
      .markCustomerBillPaid({
        customerId: winner.id,
        paymentMethod: "cash",
      });
    expect(
      useAdvanceGamesStore
        .getState()
        .getBalance(winner.id)
    ).toBe(3);
  });

  it("deleting one bill cancels only that bill's staged award", () => {
    const first = useCustomerAccountStore
      .getState()
      .createCustomerAccount({
        customerName: "First",
      });
    const second = useCustomerAccountStore
      .getState()
      .createCustomerAccount({
        customerName: "Second",
      });

    for (const [index, account] of [
      first,
      second,
    ].entries()) {
      useAdvanceGamesStore.getState().stageEarn({
        transactionId: `ADV-SHARED-${index}`,
        customerId: account.id,
        customerName: account.customerName,
        games: index + 2,
        tableId: 1,
        tableName: "Table 1",
        sessionId: "SHARED-SESSION",
        frameId: `FRAME-${index}`,
        finalGames: index + 2,
        billId: account.id,
      });
    }

    useCustomerAccountStore
      .getState()
      .deleteCustomerAccount(first.id);

    expect(
      useAdvanceGamesStore.getState().pendingAwards
    ).toEqual([
      expect.objectContaining({
        billId: second.id,
      }),
    ]);
  });
});
