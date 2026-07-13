import { describe, expect, it } from "vitest";

import {
  getPlayerIdentityKey,
  isSamePlayerIdentity,
  normalizePlayerName,
} from "./playerIdentity";

describe("player identity", () => {
  it("normalizes names without merging numbered walk-ins", () => {
    expect(normalizePlayerName("  Walk-in   Customer  ")).toBe(
      "walk-in customer"
    );
    expect(normalizePlayerName("Walk-in Customer 2")).toBe(
      "walk-in customer 2"
    );
    expect(
      isSamePlayerIdentity(
        { playerName: "Walk-in Customer" },
        { playerName: "Walk-in Customer 2" }
      )
    ).toBe(false);
  });

  it("prefers customer id over name when present", () => {
    expect(
      getPlayerIdentityKey({
        customerId: "CUSTACC-2",
        playerName: "Ali",
      })
    ).toBe("customer:CUSTACC-2");
    expect(
      isSamePlayerIdentity(
        { playerId: "CUSTACC-2", playerName: "Ali" },
        {
          customerId: "CUSTACC-2",
          playerName: "Renamed Ali",
        }
      )
    ).toBe(true);
  });
});
