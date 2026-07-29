import { describe, expect, it } from "vitest";

import type { AdvanceGameTransaction } from "../store/advanceGamesStore";
import { buildAdvanceGameBalanceRows } from "./advanceGameBalances";

describe("buildAdvanceGameBalanceRows", () => {
  it("shows a winner's staged award as pending before payment", () => {
    expect(
      buildAdvanceGameBalanceRows([], [
        {
          customerId: "AHMED",
          customerName: "Ahmed",
          games: 1,
        },
      ])
    ).toEqual([
      {
        customerId: "AHMED",
        customerName: "Ahmed",
        availableGames: 0,
        pendingGames: 1,
      },
    ]);
  });

  it("moves the award from pending to available after release", () => {
    const earned: AdvanceGameTransaction = {
      id: "ADV-1",
      type: "earned",
      customerId: "AHMED",
      customerName: "Ahmed",
      games: 1,
      balanceDelta: 1,
      createdAt: "2026-07-29T00:00:00.000Z",
    };

    expect(buildAdvanceGameBalanceRows([earned], [])).toEqual([
      {
        customerId: "AHMED",
        customerName: "Ahmed",
        availableGames: 1,
        pendingGames: 0,
      },
    ]);
  });

  it("keeps two customers with the same display name separate", () => {
    const rows = buildAdvanceGameBalanceRows([], [
      { customerId: "ALI-1", customerName: "Ali", games: 1 },
      { customerId: "ALI-2", customerName: "Ali", games: 2 },
    ]);

    expect(rows).toHaveLength(2);
    expect(
      rows.find((row) => row.customerId === "ALI-1")
    ).toMatchObject({ pendingGames: 1 });
    expect(
      rows.find((row) => row.customerId === "ALI-2")
    ).toMatchObject({ pendingGames: 2 });
  });
});
