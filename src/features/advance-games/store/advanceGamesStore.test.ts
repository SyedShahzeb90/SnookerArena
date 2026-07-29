import { beforeEach, describe, expect, it } from "vitest";

import { useAdvanceGamesStore } from "./advanceGamesStore";

const award = {
  transactionId: "ADV-EARN-SESSION-1-FRAME-1-0",
  customerId: "CUSTOMER-1",
  customerName: "Shadab",
  games: 3,
  tableId: 3,
  tableName: "Table 3",
  sessionId: "SESSION-1",
  frameId: "FRAME-1",
  finalGames: 3,
  billId: "CUSTOMER-1",
};

const secondAward = {
  ...award,
  transactionId: "ADV-EARN-SESSION-1-FRAME-2-0",
  customerId: "CUSTOMER-2",
  customerName: "Janzeb",
  games: 4,
  frameId: "FRAME-2",
  finalGames: 4,
  billId: "CUSTOMER-2",
};

const sessionScopedAward = {
  ...award,
  transactionId: "ADV-EARN-SESSION-2-FRAME-1-0",
  customerId: "AHMED",
  customerName: "Ahmed",
  games: 1,
  sessionId: "SESSION-2",
  billId: "ADVANCE-SESSION:SESSION-2",
};

describe("advance game payment lifecycle", () => {
  beforeEach(() => {
    useAdvanceGamesStore
      .getState()
      .resetAdvanceGamesStore();
  });

  it("keeps a staged award out of the balance until its bill is paid", () => {
    expect(
      useAdvanceGamesStore
        .getState()
        .stageEarn(award)
    ).toBe(true);
    expect(
      useAdvanceGamesStore
        .getState()
        .getBalance(award.customerId)
    ).toBe(0);

    expect(
      useAdvanceGamesStore
        .getState()
        .releasePendingAwardsForBill(
          award.billId
        )
    ).toBe(3);
    expect(
      useAdvanceGamesStore
        .getState()
        .getBalance(award.customerId)
    ).toBe(3);
  });

  it("discards a staged award when its unpaid bill is deleted", () => {
    useAdvanceGamesStore
      .getState()
      .stageEarn(award);

    expect(
      useAdvanceGamesStore
        .getState()
        .cancelPendingAwardsForBill(
          award.billId
        )
    ).toBe(3);
    expect(
      useAdvanceGamesStore
        .getState()
        .getBalance(award.customerId)
    ).toBe(0);
    expect(
      useAdvanceGamesStore.getState()
        .transactions
    ).toHaveLength(0);
  });

  it("cancels only the deleted bill award when one session has multiple bills", () => {
    const store = useAdvanceGamesStore.getState();
    store.stageEarn(award);
    store.stageEarn(secondAward);

    expect(
      store.cancelPendingAwardsForBill(award.billId)
    ).toBe(3);
    expect(
      useAdvanceGamesStore.getState().pendingAwards
    ).toEqual([
      expect.objectContaining({
        billId: secondAward.billId,
      }),
    ]);

    expect(
      useAdvanceGamesStore
        .getState()
        .releasePendingAwardsForBill(
          secondAward.billId
        )
    ).toBe(4);
    expect(
      useAdvanceGamesStore
        .getState()
        .getBalance(secondAward.customerId)
    ).toBe(4);
  });

  it("releases only the bill that settled and leaves sibling awards pending", () => {
    const store = useAdvanceGamesStore.getState();
    store.stageEarn(award);
    store.stageEarn(secondAward);

    expect(
      store.releasePendingAwardsForBill(award.billId)
    ).toBe(3);
    expect(
      useAdvanceGamesStore
        .getState()
        .getBalance(award.customerId)
    ).toBe(3);
    expect(
      useAdvanceGamesStore
        .getState()
        .getBalance(secondAward.customerId)
    ).toBe(0);
    expect(
      useAdvanceGamesStore.getState().pendingAwards
    ).toEqual([
      expect.objectContaining({
        billId: secondAward.billId,
      }),
    ]);
  });

  it("keeps the first bill award when the sibling bill is cancelled", () => {
    const store = useAdvanceGamesStore.getState();
    store.stageEarn(award);
    store.stageEarn(secondAward);

    expect(
      store.cancelPendingAwardsForBill(
        secondAward.billId
      )
    ).toBe(4);
    expect(
      useAdvanceGamesStore.getState().pendingAwards
    ).toEqual([
      expect.objectContaining({
        billId: award.billId,
      }),
    ]);
  });

  it("keeps a session award pending while the losing bill is unpaid", () => {
    const store = useAdvanceGamesStore.getState();

    expect(store.stageEarn(sessionScopedAward)).toBe(true);
    expect(store.getBalance("AHMED")).toBe(0);
    expect(useAdvanceGamesStore.getState().pendingAwards).toEqual([
      expect.objectContaining({
        customerId: "AHMED",
        games: 1,
        sessionId: "SESSION-2",
      }),
    ]);
  });

  it("makes a session award available after the session bills settle", () => {
    const store = useAdvanceGamesStore.getState();
    store.stageEarn(sessionScopedAward);

    expect(
      store.releasePendingAwardsForSession("SESSION-2")
    ).toBe(1);
    expect(
      useAdvanceGamesStore.getState().getBalance("AHMED")
    ).toBe(1);
    expect(
      useAdvanceGamesStore.getState().pendingAwards
    ).toHaveLength(0);
  });

  it("removes the session award when its unpaid bill is deleted", () => {
    const store = useAdvanceGamesStore.getState();
    store.stageEarn(sessionScopedAward);

    expect(
      store.cancelAwardsForSession("SESSION-2")
    ).toBe(1);
    expect(
      useAdvanceGamesStore.getState().pendingAwards
    ).toHaveLength(0);
    expect(
      useAdvanceGamesStore.getState().getBalance("AHMED")
    ).toBe(0);
  });

  it("removes the pending award when the entire session is cancelled", () => {
    const store = useAdvanceGamesStore.getState();
    store.stageEarn(sessionScopedAward);

    expect(
      store.cancelPendingAwardsForSession("SESSION-2")
    ).toBe(1);
    expect(
      useAdvanceGamesStore.getState().pendingAwards
    ).toHaveLength(0);
    expect(store.getBalance("AHMED")).toBe(0);
  });

  it("removes an award that was already released before the bill was deleted", () => {
    const store = useAdvanceGamesStore.getState();
    store.stageEarn(sessionScopedAward);
    store.releasePendingAwardsForSession("SESSION-2");

    expect(store.getBalance("AHMED")).toBe(1);
    expect(
      useAdvanceGamesStore.getState()
        .transactions
    ).toHaveLength(1);

    expect(
      useAdvanceGamesStore
        .getState()
        .cancelAwardsForSession("SESSION-2")
    ).toBe(1);
    expect(
      useAdvanceGamesStore
        .getState()
        .getBalance("AHMED")
    ).toBe(0);
    expect(
      useAdvanceGamesStore.getState()
        .transactions
    ).toHaveLength(0);
  });
});
