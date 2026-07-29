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

function singleGameLine(
  id: string,
  loserName: string,
  winnerName: string,
  options: {
    isFinal?: boolean;
    finalGames?: number;
    loserCustomerId?: string;
    loserParticipantKey?: string;
    winnerCustomerId?: string;
    winnerParticipantKey?: string;
  } = {}
): TableChargeLine {
  return {
    id,
    sessionId: "SESSION-2",
    type: "singleGame",
    label: "Single Game",
    startedAt: `2026-07-26T00:0${id.at(-1)}:00.000Z`,
    endedAt: `2026-07-26T00:0${id.at(-1)}:30.000Z`,
    amount: 300,
    unitRate: 300,
    loserName,
    loserCustomerId: options.loserCustomerId,
    loserParticipantKey: options.loserParticipantKey,
    winnerName,
    winnerCustomerId: options.winnerCustomerId,
    winnerParticipantKey: options.winnerParticipantKey,
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

  it("uses advance games earned earlier in the session against later losses", () => {
    const session = {
      id: "SESSION-2",
      tableId: 3,
      sessionType: "single",
      player1: "shadab",
      player1CustomerId: "SHADAB",
      player2: "janzeb",
      player2CustomerId: "JANZEB",
    } as Session;
    const lines = [
      singleGameLine(
        "LINE-1",
        "janzeb",
        "shadab",
        { isFinal: true, finalGames: 3 }
      ),
      singleGameLine(
        "LINE-2",
        "shadab",
        "janzeb"
      ),
    ];

    const settlement =
      calculateFinalSettlement(session, lines);
    const shadab = settlement.owners.find(
      (item) => item.customerId === "SHADAB"
    );

    expect(shadab?.payableGames).toBe(0);
    expect(shadab?.advanceGames).toBe(2);
  });

  it("charges only the losses remaining after earlier advance games are used", () => {
    const session = {
      id: "SESSION-3",
      tableId: 3,
      sessionType: "single",
      player1: "shadab",
      player1CustomerId: "SHADAB",
      player2: "janzeb",
      player2CustomerId: "JANZEB",
    } as Session;
    const lines = [
      singleGameLine(
        "LINE-1",
        "janzeb",
        "shadab",
        { isFinal: true, finalGames: 3 }
      ),
      singleGameLine("LINE-2", "shadab", "janzeb"),
      singleGameLine("LINE-3", "shadab", "janzeb"),
      singleGameLine("LINE-4", "shadab", "janzeb"),
      singleGameLine("LINE-5", "shadab", "janzeb"),
    ];

    const settlement =
      calculateFinalSettlement(session, lines);
    const shadab = settlement.owners.find(
      (item) => item.customerId === "SHADAB"
    );

    expect(shadab?.payableGames).toBe(1);
    expect(shadab?.advanceGames).toBe(0);
  });

  it("awards Ahmed one advance game when Ali loses Final 1", () => {
    const session = {
      id: "SESSION-FINAL-1",
      tableId: 1,
      sessionType: "single",
      player1: "Ali",
      player1CustomerId: "ALI",
      player2: "Ahmed",
      player2CustomerId: "AHMED",
    } as Session;
    const settlement = calculateFinalSettlement(session, [
      singleGameLine("LINE-1", "Ali", "Ahmed", {
        isFinal: true,
        finalGames: 1,
        loserCustomerId: "ALI",
        loserParticipantKey: "SESSION-FINAL-1:player1",
        winnerCustomerId: "AHMED",
        winnerParticipantKey: "SESSION-FINAL-1:player2",
      }),
    ]);

    expect(
      settlement.owners.find((owner) => owner.customerId === "ALI")
    ).toMatchObject({ payableGames: 2, advanceGames: 0 });
    expect(
      settlement.owners.find((owner) => owner.customerId === "AHMED")
    ).toMatchObject({ payableGames: 0, advanceGames: 1 });
  });

  it("reverses the Final 1 award when Ahmed loses to Ali", () => {
    const session = {
      id: "SESSION-FINAL-REVERSE",
      tableId: 1,
      sessionType: "single",
      player1: "Ali",
      player1CustomerId: "ALI",
      player2: "Ahmed",
      player2CustomerId: "AHMED",
    } as Session;
    const settlement = calculateFinalSettlement(session, [
      singleGameLine("LINE-1", "Ahmed", "Ali", {
        isFinal: true,
        finalGames: 1,
        loserCustomerId: "AHMED",
        loserParticipantKey: "SESSION-FINAL-REVERSE:player2",
        winnerCustomerId: "ALI",
        winnerParticipantKey: "SESSION-FINAL-REVERSE:player1",
      }),
    ]);

    expect(
      settlement.owners.find((owner) => owner.customerId === "AHMED")
    ).toMatchObject({ payableGames: 2, advanceGames: 0 });
    expect(
      settlement.owners.find((owner) => owner.customerId === "ALI")
    ).toMatchObject({ payableGames: 0, advanceGames: 1 });
  });

  it("keeps same-name players separate by stable customer and participant IDs", () => {
    const session = {
      id: "SESSION-SAME-NAME",
      tableId: 1,
      sessionType: "single",
      player1: "Ali",
      player1CustomerId: "ALI-1",
      player2: "Ali",
      player2CustomerId: "ALI-2",
    } as Session;
    const settlement = calculateFinalSettlement(session, [
      singleGameLine("LINE-1", "Ali", "Ali", {
        isFinal: true,
        finalGames: 1,
        loserCustomerId: "ALI-1",
        loserParticipantKey: "SESSION-SAME-NAME:player1",
        winnerCustomerId: "ALI-2",
        winnerParticipantKey: "SESSION-SAME-NAME:player2",
      }),
    ]);

    expect(settlement.owners).toHaveLength(2);
    expect(
      settlement.owners.find((owner) => owner.customerId === "ALI-1")
    ).toMatchObject({ payableGames: 2, advanceGames: 0 });
    expect(
      settlement.owners.find((owner) => owner.customerId === "ALI-2")
    ).toMatchObject({ payableGames: 0, advanceGames: 1 });
  });
});
