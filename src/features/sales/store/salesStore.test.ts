import { beforeEach, describe, expect, it } from "vitest";

import type { Sale } from "../types/sale";
import { useSalesStore } from "./salesStore";

function makeSale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: "SALE-1",
    invoiceNumber: "INV-1",
    tableId: 4,
    tableName: "Table 4",
    saleType: "table",
    sessionId: "SESSION-1",
    players: [{ name: "Sherry" }],
    sessionType: "single",
    startedAt: "2026-08-03T17:00:00.000Z",
    endedAt: "2026-08-03T17:39:00.000Z",
    durationMinutes: 39,
    createdAt: "2026-08-03T17:39:00.000Z",
    paidAt: "2026-08-03T17:39:00.000Z",
    tableAmount: 300,
    cafeAmount: 0,
    subtotal: 300,
    discount: 0,
    grandTotal: 300,
    paymentMethod: "cash",
    paymentStatus: "paid",
    orderedItems: [],
    ...overrides,
  };
}

describe("sales store", () => {
  beforeEach(() => {
    useSalesStore.getState().resetSalesStore();
  });

  it("does not add the same paid session twice", () => {
    const firstSale = makeSale();
    const duplicateSale = makeSale({
      id: "SALE-2",
      invoiceNumber: "INV-2",
    });

    useSalesStore.getState().addSale(firstSale);
    useSalesStore.getState().addSale(duplicateSale);

    expect(useSalesStore.getState().sales).toHaveLength(1);
    expect(useSalesStore.getState().sales[0].id).toBe("SALE-1");
  });

  it("does not add the same paid customer bill twice", () => {
    const firstSale = makeSale({
      saleType: "customer_bill",
      sessionId: "ACCOUNT-1",
      customerAccountId: "ACCOUNT-1",
    });
    const duplicateSale = makeSale({
      id: "SALE-2",
      invoiceNumber: "INV-2",
      saleType: "customer_bill",
      sessionId: "ACCOUNT-1",
      customerAccountId: "ACCOUNT-1",
    });

    useSalesStore.getState().addSale(firstSale);
    useSalesStore.getState().addSale(duplicateSale);

    expect(useSalesStore.getState().sales).toHaveLength(1);
    expect(useSalesStore.getState().sales[0].id).toBe("SALE-1");
  });
});
