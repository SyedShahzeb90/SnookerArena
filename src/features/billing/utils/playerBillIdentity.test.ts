import { describe, expect, it } from "vitest";

import type { Session } from "@/types/session";

import {
  getPlayerCafeAmount,
  getPlayerCafeItems,
  getSessionPlayerBillingIdentities,
  getSessionPlayerCustomerId,
  hasPlayerName,
} from "./playerBillIdentity";

function makeSession(
  overrides: Partial<Session> = {}
): Session {
  return {
    id: "S1",
    tableId: 1,
    sessionType: "single",
    player1: "Ali",
    player1CustomerId: "CUST-ALI",
    player2: "Shah",
    player2CustomerId: "CUST-SHAH",
    startTime: new Date("2026-07-13T12:00:00"),
    endTime: new Date("2026-07-13T12:30:00"),
    totalPausedMilliseconds: 0,
    cafeAmount: 960,
    cafeOrders: [
      {
        menuItemId: "BISCUIT",
        name: "Biscuit",
        price: 60,
        quantity: 1,
        subtotal: 60,
        timeAdded: new Date("2026-07-13T12:05:00"),
        tableId: 1,
        sessionId: "S1",
        playerName: "Ali",
        playerId: "CUST-ALI",
      },
      {
        menuItemId: "BURGER",
        name: "Master Blaster Burger",
        price: 900,
        quantity: 1,
        subtotal: 900,
        timeAdded: new Date("2026-07-13T12:10:00"),
        tableId: 1,
        sessionId: "S1",
        playerName: " shah ",
        playerId: "CUST-SHAH",
      },
    ],
    discount: 0,
    isPaid: false,
    ...overrides,
  };
}

describe("player bill identity", () => {
  it("resolves Player 2 cafe amount by customer id before display name", () => {
    const session = makeSession();

    expect(
      getSessionPlayerCustomerId(session, "Shah")
    ).toBe("CUST-SHAH");
    expect(
      getPlayerCafeAmount(session, "Ali")
    ).toBe(60);
    expect(
      getPlayerCafeAmount(session, "Shah")
    ).toBe(900);
    expect(
      getPlayerCafeItems(session, "Shah")
    ).toHaveLength(1);
  });

  it("keeps numbered walk-ins separate when no id exists", () => {
    const session = makeSession({
      player1: "Walk-in Customer",
      player1CustomerId: undefined,
      player2: "Walk-in Customer 2",
      player2CustomerId: undefined,
      cafeOrders: [
        {
          menuItemId: "TEA",
          name: "Tea",
          price: 100,
          quantity: 1,
          subtotal: 100,
          timeAdded: new Date("2026-07-13T12:05:00"),
          playerName: "Walk-in Customer",
        },
        {
          menuItemId: "FRIES",
          name: "Fries",
          price: 250,
          quantity: 1,
          subtotal: 250,
          timeAdded: new Date("2026-07-13T12:10:00"),
          playerName: "Walk-in Customer 2",
        },
      ],
    });

    expect(
      getPlayerCafeAmount(
        session,
        "Walk-in Customer"
      )
    ).toBe(100);
    expect(
      getPlayerCafeAmount(
        session,
        "Walk-in Customer 2"
      )
    ).toBe(250);
  });

  it("keeps attached cafe charges with the same player after the session customer id changes", () => {
    const session = makeSession({
      player1: "Ali",
      player1CustomerId: "CUST-ALI-EDITED",
      cafeOrders: [
        {
          menuItemId: "TEA",
          name: "Tea",
          price: 120,
          quantity: 1,
          subtotal: 120,
          timeAdded: new Date("2026-07-13T12:05:00"),
          tableId: 1,
          sessionId: "S1",
          playerName: "Ali",
          playerId: "CUST-ALI-WAITING",
        },
      ],
    });

    expect(
      getPlayerCafeAmount(session, "Ali")
    ).toBe(120);
  });

  it("keeps same-name players separate by their session participant key after an id change", () => {
    const session = makeSession({
      player1: "Ali",
      player1CustomerId: "CUST-ALI-EDITED",
      player2: "Ali",
      player2CustomerId: "CUST-ALI-SECOND",
      cafeOrders: [
        {
          menuItemId: "TEA",
          name: "Tea",
          price: 120,
          quantity: 1,
          subtotal: 120,
          timeAdded: new Date("2026-07-13T12:05:00"),
          tableId: 1,
          sessionId: "S1",
          playerName: "Ali",
          playerId: "CUST-ALI-ORIGINAL",
          participantKey: "S1:player1",
        },
      ],
    });
    const [player1, player2] =
      getSessionPlayerBillingIdentities(session);

    expect(getPlayerCafeAmount(session, player1)).toBe(120);
    expect(getPlayerCafeAmount(session, player2)).toBe(0);
  });

  it("does not assign an older name-only charge when same-name players are ambiguous", () => {
    const session = makeSession({
      player1: "Ali",
      player1CustomerId: undefined,
      player2: "Ali",
      player2CustomerId: undefined,
      cafeOrders: [
        {
          menuItemId: "TEA",
          name: "Tea",
          price: 120,
          quantity: 1,
          subtotal: 120,
          timeAdded: new Date("2026-07-13T12:05:00"),
          playerName: "Ali",
        },
      ],
    });
    const [player1, player2] =
      getSessionPlayerBillingIdentities(session);

    expect(getPlayerCafeAmount(session, player1)).toBe(0);
    expect(getPlayerCafeAmount(session, player2)).toBe(0);
  });

  it("compares paid player names after normalization", () => {
    expect(hasPlayerName([" shah "], "Shah")).toBe(
      true
    );
  });
});
