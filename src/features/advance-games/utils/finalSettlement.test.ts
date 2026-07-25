import { describe, expect, it } from "vitest";

import type { Session, TableChargeLine } from "@/types/session";

import { calculateFinalSettlement } from "./finalSettlement";

function gameLine(
  id: string,
  losingTeam: "A" | "B",
  options: { isFinal?: boolean; finalGames?: number } = {}
): TableChargeLine {
  return {
    id,
    sessionId: "SESSION-1",
    type: "doubleGame",
    label: "Double Game",
    startedAt: `2026-07-24T00:0${id.at(-1)}:00.000Z`,
    endedAt: `2026-07-24T00:0${id.at(-1)}:30.000Z`,
    amount: 600,
    unitRate: 600,
    losingTeam,
    winningTeam: losingTeam === "A" ? "B" : "A",
    loserName: losingTeam === "A" ? "adeel, shadab" : "sherry, amir",
    winnerName: losingTeam === "A" ? "sherry, amir" : "adeel, shadab",
    isFinal: options.isFinal,
    finalGames: options.finalGames,
  };
}

describe("calculateFinalSettlement", () => {
  it("offsets two Adeel games and leaves Sherry with six after Sherry loses Final 2", () => {
    const session = {
      id: "SESSION-1",
      tableId: 1,
      sessionType: "double",
      player1: "adeel",
      player1CustomerId: "ADEEL",
      player2: "shadab",
      player2CustomerId: "SHADAB",
      player3: "sherry",
      player3CustomerId: "SHERRY",
      player4: "amir",
      player4CustomerId: "AMIR",
      teamAPlayers: ["adeel", "shadab"],
      teamBPlayers: ["sherry", "amir"],
      teamAOneNameEnough: false,
      teamBOneNameEnough: false,
    } as Session;
    const lines = [
      gameLine("LINE-1", "A"),
      gameLine("LINE-2", "A"),
      gameLine("LINE-3", "B"),
      gameLine("LINE-4", "B"),
      gameLine("LINE-5", "B"),
      gameLine("LINE-6", "B", { isFinal: true, finalGames: 2 }),
    ];

    const settlement = calculateFinalSettlement(session, lines);
    const balances = Object.fromEntries(
      settlement.owners.map((item) => [item.customerName, item.payableGames])
    );

    expect(balances.adeel).toBe(0);
    expect(balances.sherry).toBe(6);
  });
});
