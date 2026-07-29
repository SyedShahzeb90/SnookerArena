import { beforeEach, describe, expect, it, vi } from "vitest";

const operator = {
  operatorId: "OP-1",
  operatorName: "Ali",
};

vi.mock("@/lib/operatorAttribution", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/lib/operatorAttribution")
    >();

  return {
    ...actual,
    getActiveOperatorSnapshot: () => operator,
  };
});

import { useCafeStore } from "@/features/cafe/store/cafeStore";
import { useExpensesStore } from "@/features/expenses/store/expensesStore";
import { useOutsidePurchaseStore } from "@/features/outside-purchases/store/outsidePurchaseStore";
import { getOperatorDisplayName } from "@/lib/operatorAttribution";

describe("stable operator attribution", () => {
  beforeEach(() => {
    useExpensesStore.getState().resetExpensesStore();
    useOutsidePurchaseStore
      .getState()
      .resetOutsidePurchaseStore();
    useCafeStore.getState().resetCafeStoreToDefault();
  });

  it("stores snapshots for expense creation and cancellation", () => {
    const expense = useExpensesStore
      .getState()
      .addExpense({
        category: "Other",
        amount: 100,
        note: "Test",
        expenseDate: "2026-07-29",
        paymentMethod: "cash",
      });

    expect(expense.createdByOperator).toEqual(operator);
    useExpensesStore
      .getState()
      .cancelExpense(expense.id, "Correction");
    expect(
      useExpensesStore.getState().expenses[0]
        .cancelledByOperator
    ).toEqual(operator);
  });

  it("stores snapshots for outside purchase lifecycle actions", () => {
    const input = {
      id: "OUTSIDE-1",
      tableId: 1,
      tableName: "Table 1",
      sessionId: "SESSION-1",
      customerName: "Ali",
      description: "Pizza",
      paymentMethod: "cash" as const,
      amountPaidFromDrawer: 500,
      operator: "Legacy Operator",
      businessDayId: "BD-1",
    };

    expect(
      useOutsidePurchaseStore
        .getState()
        .createOutsidePurchase(input).ok
    ).toBe(true);
    expect(
      useOutsidePurchaseStore.getState().purchases[0]
        .createdByOperator
    ).toEqual(operator);

    expect(
      useOutsidePurchaseStore
        .getState()
        .recordReimbursement({
          id: "REIMBURSE-1",
          purchaseId: input.id,
          amount: 200,
          paymentMethod: "easypaisa",
          operator: "Legacy Operator",
          businessDayId: "BD-1",
        }).ok
    ).toBe(true);
    expect(
      useOutsidePurchaseStore.getState().purchases[0]
        .reimbursements[0].operatorSnapshot
    ).toEqual(operator);
  });

  it("stores snapshots for vendor restocking actions", () => {
    const productId = "TRACKED-ITEM";
    useCafeStore.setState((state) => ({
      menu: [
        {
          id: productId,
          name: "Lays",
          category: "Snacks",
          price: 100,
          available: true,
          isAvailable: true,
          trackStock: true,
          currentStock: 5,
          lowStockAlertQuantity: 2,
          stockUnit: "packs",
        },
        ...state.menu,
      ],
      vendorRestockingRecords: [],
      stockTransactions: [],
    }));

    const record = useCafeStore
      .getState()
      .recordVendorRestocking({
        vendorName: "Vendor",
        menuItemId: productId,
        quantityReceived: 10,
        unit: "packs",
        costPerUnit: 50,
        paymentSource: "vendor_credit",
        purchaseDate: "2026-07-29",
        createdBy: "Legacy Operator",
      });

    expect(record.createdByOperator).toEqual(operator);
    useCafeStore
      .getState()
      .payVendorCredit(record.id, {
        paymentSource: "cash_drawer",
        paidBy: "Legacy Operator",
      });
    expect(
      useCafeStore.getState().vendorRestockingRecords[0]
        .creditPaidByOperator
    ).toEqual(operator);
  });

  it("uses snapshots first and legacy names for older records", () => {
    expect(
      getOperatorDisplayName(operator, "Old Name")
    ).toBe("Ali");
    expect(
      getOperatorDisplayName(undefined, "Old Name")
    ).toBe("Old Name");
    expect(getOperatorDisplayName()).toBe("\u2014");
  });
});
