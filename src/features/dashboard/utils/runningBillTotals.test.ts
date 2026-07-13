import { describe, expect, it } from "vitest";

import { getRunningBillTotals } from "./runningBillTotals";

describe("running table bill totals", () => {
  it("shows total cafe while keeping multi-player current bill separate", () => {
    const totals = getRunningBillTotals({
      tableBill: 300,
      billedCafeTotal: 60,
      sessionCafeTotal: 960,
      billedAccessoriesTotal: 0,
      sessionAccessoriesTotal: 0,
      separatePlayerBills: true,
    });

    expect(totals.cafeTotal).toBe(960);
    expect(totals.currentBill).toBe(300);
  });

  it("uses billed cafe total when it has the complete saved bill total", () => {
    const totals = getRunningBillTotals({
      tableBill: 300,
      billedCafeTotal: 960,
      sessionCafeTotal: 60,
      billedAccessoriesTotal: 0,
      sessionAccessoriesTotal: 0,
    });

    expect(totals.cafeTotal).toBe(960);
    expect(totals.currentBill).toBe(1260);
  });
});
