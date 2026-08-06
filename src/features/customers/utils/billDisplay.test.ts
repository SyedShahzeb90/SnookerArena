import { beforeEach, describe, expect, it } from "vitest";

import { useTableHistoryStore } from "@/features/table-history/store/tableHistoryStore";
import type { TableHistoryRecord } from "@/features/table-history/types/tableHistory";
import type { CustomerAccount } from "../types/customerAccount";

import {
  formatCustomerDisplayLabel,
  getBillCustomerLabel,
} from "./billDisplay";

function makeAccount(
  overrides: Partial<CustomerAccount> = {}
): CustomerAccount {
  return {
    id: "account-1",
    customerToken: "C-005",
    staffBillNumber: "005",
    customerName: "Walk-in Customer",
    status: "active",
    openedAt: "2026-07-29T07:00:00.000Z",
    createdAt: "2026-07-29T07:00:00.000Z",
    updatedAt: "2026-07-29T07:00:00.000Z",
    gameCharges: [
      {
        id: "charge-1",
        sessionId: "session-1",
        tableId: 2,
        tableName: "Table 2",
        tableType: "table",
        sessionType: "single",
        startedAt: "2026-07-29T07:00:00.000Z",
        endedAt: "2026-07-29T07:30:00.000Z",
        durationMinutes: 30,
        payerCustomerId: "account-1",
        payerName: "Walk-in Customer",
        amount: 300,
        createdAt: "2026-07-29T07:30:00.000Z",
        shareType: "full",
      },
    ],
    cafeCharges: [],
    discount: 0,
    totalGameAmount: 300,
    totalCafeAmount: 0,
    grandTotal: 300,
    paymentStatus: "unpaid",
    lastTableName: "Table 2",
    ...overrides,
  };
}

function makeHistoryRecord(
  overrides: Partial<TableHistoryRecord> = {}
): TableHistoryRecord {
  return {
    id: "history-1",
    sessionId: "session-1",
    tableId: 2,
    tableName: "Table 2",
    tableType: "table",
    sessionType: "single",
    startedAt: "2026-07-29T07:00:00.000Z",
    endedAt: "2026-07-29T07:30:00.000Z",
    durationMinutes: 30,
    players: ["Walk-in Customer"],
    player1Name: "Walk-in Customer",
    player1CustomerId: "account-1",
    tableAmount: 300,
    cafeAmount: 0,
    discount: 0,
    grandTotal: 300,
    paymentStatus: "pending",
    createdAt: "2026-07-29T07:30:00.000Z",
    updatedAt: "2026-07-29T07:30:00.000Z",
    cafeItems: [],
    playerBreakdown: [],
    ...overrides,
  } as TableHistoryRecord;
}

describe("bill display labels", () => {
  beforeEach(() => {
    useTableHistoryStore.setState({
      records: [makeHistoryRecord()],
    });
  });

  it("uses an edited customer name instead of stale walk-in history", () => {
    const account = makeAccount({
      customerName: "abdullah",
      customerNote: "T2-005",
    });

    expect(getBillCustomerLabel(account)).toBe("abdullah · T2-005");
    expect(formatCustomerDisplayLabel(account)).toBe(
      "abdullah · T2-005 — T2-005"
    );
  });

  it("keeps walk-in bills using stable history labels", () => {
    const account = makeAccount();

    expect(getBillCustomerLabel(account)).toBe("Walk-in Customer");
    expect(formatCustomerDisplayLabel(account)).toBe(
      "Walk-in Customer — T2-005"
    );
  });
});
