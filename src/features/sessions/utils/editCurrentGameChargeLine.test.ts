import { describe, expect, it } from "vitest";

import type { TableChargeLine } from "@/types/session";

import { editCurrentGameChargeLine } from "./editCurrentGameChargeLine";

describe("editCurrentGameChargeLine", () => {
  it("preserves the active Double Game and saves Final 2 as numeric metadata", () => {
    const line: TableChargeLine = {
      id: "LINE-1",
      sessionId: "SESSION-1",
      type: "doubleGame",
      label: "Double Game",
      startedAt: "2026-07-24T00:00:00.000Z",
      endedAt: "2026-07-24T00:00:00.000Z",
      amount: 600,
      unitRate: 600,
      isFinal: true,
      finalGames: 1,
      settlementProcessedAt: "2026-07-24T00:01:00.000Z",
      settlement: [],
    };

    const [edited] = editCurrentGameChargeLine({
      lines: [line],
      type: "doubleGame",
      singleGameRate: 300,
      doubleGameRate: 600,
      isFinal: true,
      finalGames: 2,
    });

    expect(edited.type).toBe("doubleGame");
    expect(edited.amount).toBe(600);
    expect(edited.isFinal).toBe(true);
    expect(edited.finalGames).toBe(2);
    expect(edited.settlement).toBeUndefined();
    expect(edited.settlementProcessedAt).toBeUndefined();
  });
});
