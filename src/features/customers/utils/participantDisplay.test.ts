import { describe, expect, it } from "vitest";

import type { TableHistoryRecord } from "@/features/table-history/types/tableHistory";

import {
  formatDuplicateParticipantLabel,
  getHistoryParticipantDisplayLabel,
  normalizeParticipantDisplayName,
} from "./participantDisplay";

function makeHistoryRecord(
  overrides: Partial<TableHistoryRecord> = {}
): TableHistoryRecord {
  return {
    id: "history-1",
    sessionId: "session-1",
    tableId: 1,
    tableName: "Table 1",
    tableType: "standard",
    sessionType: "single",
    startedAt: "2026-07-29T07:00:00.000Z",
    endedAt: "2026-07-29T07:30:00.000Z",
    durationMinutes: 30,
    players: ["Ali", "Ali"],
    player1Name: "Ali",
    player1CustomerId: "customer-1",
    player2Name: "Ali",
    player2CustomerId: "customer-2",
    tableAmount: 600,
    cafeAmount: 0,
    discount: 0,
    grandTotal: 600,
    paymentStatus: "pending",
    createdAt: "2026-07-29T07:30:00.000Z",
    updatedAt: "2026-07-29T07:30:00.000Z",
    cafeItems: [],
    playerBreakdown: [],
    ...overrides,
  } as TableHistoryRecord;
}

describe("participant display labels", () => {
  it("numbers same-name participants by their stable session slots", () => {
    const record = makeHistoryRecord();

    expect(
      getHistoryParticipantDisplayLabel(record, "customer-1")
    ).toBe("Ali #1");
    expect(
      getHistoryParticipantDisplayLabel(record, "customer-2")
    ).toBe("Ali #2");
  });

  it("leaves unique participant names unchanged", () => {
    const record = makeHistoryRecord({ player2Name: "Sherry" });

    expect(
      getHistoryParticipantDisplayLabel(record, "customer-1")
    ).toBe("Ali");
    expect(
      getHistoryParticipantDisplayLabel(record, "customer-2")
    ).toBe("Sherry");
  });

  it("detects duplicates after trimming, collapsing spaces, and ignoring case", () => {
    const record = makeHistoryRecord({
      player1Name: "  Ali  Khan ",
      player2Name: "ali   khan",
    });

    expect(normalizeParticipantDisplayName(record.player1Name)).toBe(
      normalizeParticipantDisplayName(record.player2Name ?? "")
    );
    expect(
      getHistoryParticipantDisplayLabel(record, "customer-1")
    ).toBe("Ali Khan #1");
    expect(
      getHistoryParticipantDisplayLabel(record, "customer-2")
    ).toBe("ali khan #2");
  });

  it("keeps numbering stable when participant or bill display order changes", () => {
    const participants = [
      { slot: "player2", name: "Ali", customerId: "customer-2" },
      { slot: "player1", name: "Ali", customerId: "customer-1" },
    ];

    expect(
      formatDuplicateParticipantLabel(participants[0], participants)
    ).toBe("Ali #2");
    expect(
      formatDuplicateParticipantLabel(participants[1], participants)
    ).toBe("Ali #1");
  });

  it("does not alter participant IDs or charge ownership data", () => {
    const participants = [
      { slot: "player1", name: "Ali", customerId: "customer-1" },
      { slot: "player2", name: "Ali", customerId: "customer-2" },
    ];
    const original = structuredClone(participants);

    formatDuplicateParticipantLabel(participants[0], participants);

    expect(participants).toEqual(original);
  });

  it("keeps separate Cafe charge ownership unchanged for same-name participants", () => {
    const record = makeHistoryRecord();
    const cafeCharges = [
      {
        id: "cafe-charge-1",
        customerId: "customer-1",
        name: "Tea",
      },
      {
        id: "cafe-charge-2",
        customerId: "customer-2",
        name: "Water",
      },
    ];
    const originalCharges = structuredClone(cafeCharges);

    expect(
      getHistoryParticipantDisplayLabel(
        record,
        cafeCharges[0].customerId
      )
    ).toBe("Ali #1");
    expect(
      getHistoryParticipantDisplayLabel(
        record,
        cafeCharges[1].customerId
      )
    ).toBe("Ali #2");
    expect(cafeCharges).toEqual(originalCharges);
  });

  it("keeps labels stable after persisted history is serialized and restored", () => {
    const restored = JSON.parse(
      JSON.stringify(makeHistoryRecord())
    ) as TableHistoryRecord;

    expect(
      getHistoryParticipantDisplayLabel(restored, "customer-1")
    ).toBe("Ali #1");
    expect(
      getHistoryParticipantDisplayLabel(restored, "customer-2")
    ).toBe("Ali #2");
  });

  it("leaves legacy records unchanged when stable participant IDs are absent", () => {
    const record = makeHistoryRecord({
      player1CustomerId: undefined,
      player2CustomerId: undefined,
    });

    expect(
      getHistoryParticipantDisplayLabel(record, "customer-1")
    ).toBeUndefined();
  });
});
