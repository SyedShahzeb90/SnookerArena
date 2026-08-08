import { beforeEach, describe, expect, it, vi } from "vitest";

function installLocalStorage() {
  const storage = new Map<string, string>();

  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => {
        storage.clear();
      },
    },
    configurable: true,
  });
}

async function loadStores() {
  vi.resetModules();
  installLocalStorage();

  const cafe = await import("./cafeStore");
  const customers = await import(
    "@/features/customers/store/customerAccountStore"
  );
  const table = await import("@/store/tableStore");
  const checkout = await import(
    "@/features/billing/store/checkoutStore"
  );

  cafe.useCafeStore
    .getState()
    .resetCafeStoreToDefault();
  customers.useCustomerAccountStore
    .getState()
    .resetCustomerAccountsForTesting();
  table.useTableStore
    .getState()
    .resetTableStoreToDefault();
  checkout.useCheckoutStore
    .getState()
    .resetBillingStore();

  return {
    useCafeStore: cafe.useCafeStore,
    useCustomerAccountStore:
      customers.useCustomerAccountStore,
    useTableStore: table.useTableStore,
    useCheckoutStore: checkout.useCheckoutStore,
  };
}

const tea = {
  id: "MENU-TEA",
  name: "Tea",
  category: "Tea / Coffee" as const,
  price: 100,
  available: true,
  isAvailable: true,
};

const fries = {
  id: "MENU-FRIES",
  name: "Fries",
  category: "Fast Food" as const,
  price: 250,
  available: true,
  isAvailable: true,
};

describe("running table cafe orders", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("attaches and persists a Player 1 cafe order without duplicates", async () => {
    const { useCafeStore } = await loadStores();

    useCafeStore
      .getState()
      .addItemToPlayer(1, "S1", "Ali", tea, "CUST-1");
    const order = useCafeStore
      .getState()
      .saveOrder({
        tableId: 1,
        tableName: "Table 1",
        sessionId: "S1",
        customerName: "Ali",
        customerAccountId: "CUST-1",
        orderItems:
          useCafeStore
            .getState()
            .getPlayerOrder(1, "Ali", "CUST-1")
            ?.orderItems ?? [],
      });
    useCafeStore
      .getState()
      .saveOrder({
        tableId: 1,
        tableName: "Table 1",
        sessionId: "S1",
        customerName: "Ali",
        customerAccountId: "CUST-1",
        orderItems: order.orderItems,
      });

    const playerOrders =
      useCafeStore.getState().playerOrders;

    expect(playerOrders).toHaveLength(1);
    expect(playerOrders[0].playerName).toBe("Ali");
    expect(playerOrders[0].totalAmount).toBe(100);
    expect(
      useCafeStore.getState().getTableCafeTotal(1)
    ).toBe(100);
  });

  it("preserves attach-to-table ownership when cafe items enter the session", async () => {
    const { useCafeStore } = await loadStores();
    const participantKey = "S1:table-booking";

    useCafeStore
      .getState()
      .addItemToPlayer(
        1,
        "S1",
        "Table 1 Booking",
        tea,
        undefined,
        participantKey
      );
    useCafeStore.getState().saveOrder({
      tableId: 1,
      tableName: "Table 1",
      sessionId: "S1",
      customerName: "Table 1 Booking",
      participantKey,
      orderItems:
        useCafeStore
          .getState()
          .getPlayerOrder(
            1,
            "Table 1 Booking",
            undefined,
            "S1",
            participantKey
          )?.orderItems ?? [],
    });

    const [sessionItem] =
      useCafeStore.getState().getTableOrderItems(1, "S1");

    expect(sessionItem.participantKey).toBe(participantKey);
    expect(sessionItem.playerName).toBe("Table 1 Booking");
    expect(sessionItem.tableBill).toBe(true);
  });

  it("moves table-attached cafe items to the selected table-booking loser", async () => {
    const {
      useCafeStore,
      useCheckoutStore,
      useCustomerAccountStore,
      useTableStore,
    } = await loadStores();

    const olderShahBill = useCustomerAccountStore
      .getState()
      .createCustomerAccount({ customerName: "Shah" });
    useCustomerAccountStore.getState().addCafeChargeToCustomer({
      customerId: olderShahBill.id,
      customerName: "Shah",
      itemId: "OLD-TEA",
      name: "Old Tea",
      quantity: 1,
      price: 50,
      subtotal: 50,
      orderedAt: new Date("2026-08-08T05:00:00").toISOString(),
    });
    const shah = useCustomerAccountStore
      .getState()
      .createCustomerAccount({ customerName: "Shah" });
    const ali = useCustomerAccountStore
      .getState()
      .createCustomerAccount({ customerName: "Ali" });

    useTableStore.getState().startSession({
      tableId: 1,
      sessionType: "time",
      player1: "Shah",
      player1CustomerId: shah.id,
      extraPlayers: ["Ali"],
      extraPlayerCustomerIds: [ali.id],
      startTime: new Date("2026-08-08T05:56:00"),
    });
    const sessionId =
      useTableStore.getState().tables[0].session!.id;
    const participantKey = `${sessionId}:table-booking`;

    useCafeStore
      .getState()
      .addItemToPlayer(
        1,
        sessionId,
        "Table 1 Booking",
        tea,
        undefined,
        participantKey
      );
    useTableStore.getState().endSession({
      tableId: 1,
      endTime: new Date("2026-08-08T05:58:00"),
      loserName: "Shah",
      payerName: "Shah",
      loserCustomerId: shah.id,
      payerCustomerId: shah.id,
      loserParticipantKey: `${sessionId}:player1`,
    });

    const shahSessionBill =
      useCustomerAccountStore
        .getState()
        .accounts.find((account) =>
          account.id === shah.id &&
          account.gameCharges.some(
            (charge) => charge.sessionId === sessionId
          )
        );

    expect(shahSessionBill?.customerName).toBe("Shah");
    expect(shahSessionBill?.totalCafeAmount).toBe(100);
    expect(shahSessionBill?.cafeCharges[0]?.name).toBe("Tea");

    const pendingBill =
      useCheckoutStore.getState().pendingBills.find(
        (bill) => bill.session.id === sessionId
      );
    const pendingCafeTotal = pendingBill?.session.cafeOrders.reduce(
      (total, item) => total + item.subtotal,
      0
    );

    expect(pendingCafeTotal).toBe(100);
    expect(pendingBill?.session.cafeAmount).toBe(100);
  });

  it("attaches Player 2 cafe orders to Player 2 instead of Player 1", async () => {
    const { useCafeStore } = await loadStores();

    useCafeStore
      .getState()
      .addItemToPlayer(1, "S1", "Ali", tea, "CUST-1");
    useCafeStore
      .getState()
      .addItemToPlayer(1, "S1", "Bilal", fries, "CUST-2");

    const player1Order = useCafeStore
      .getState()
      .getPlayerOrder(1, "Ali", "CUST-1");
    const player2Order = useCafeStore
      .getState()
      .getPlayerOrder(1, "Bilal", "CUST-2");

    expect(player1Order?.totalAmount).toBe(100);
    expect(player2Order?.totalAmount).toBe(250);
    expect(player2Order?.orderItems[0].playerName).toBe(
      "Bilal"
    );
    expect(player2Order?.orderItems[0].playerId).toBe(
      "CUST-2"
    );
    expect(
      useCafeStore.getState().getTableOrderItems(1)
    ).toHaveLength(2);
    expect(
      useCafeStore.getState().getTableCafeTotal(1)
    ).toBe(350);
  });

  it("keeps separate orders for numbered walk-in players", async () => {
    const { useCafeStore } = await loadStores();

    useCafeStore
      .getState()
      .addItemToPlayer(1, "S1", "Walk-in Customer", tea);
    useCafeStore
      .getState()
      .addItemToPlayer(
        1,
        "S1",
        "Walk-in Customer 2",
        fries
      );

    expect(
      useCafeStore
        .getState()
        .getPlayerOrder(1, "Walk-in Customer")
        ?.totalAmount
    ).toBe(100);
    expect(
      useCafeStore
        .getState()
        .getPlayerOrder(1, "Walk-in Customer 2")
        ?.totalAmount
    ).toBe(250);
    expect(
      useCafeStore.getState().playerOrders
    ).toHaveLength(2);
  });

  it("keeps same-name player orders separate across a legitimate customer ID change", async () => {
    const { useCafeStore } = await loadStores();
    const player1Key = "S1:player1";
    const player2Key = "S1:player2";

    useCafeStore
      .getState()
      .addItemToPlayer(
        1,
        "S1",
        "Ali",
        tea,
        "OLD-CUST-1",
        player1Key
      );

    expect(
      useCafeStore
        .getState()
        .getPlayerOrder(
          1,
          "Ali",
          "NEW-CUST-1",
          "S1",
          player1Key
        )
        ?.totalAmount
    ).toBe(100);
    expect(
      useCafeStore
        .getState()
        .getPlayerOrder(
          1,
          "Ali",
          "CUST-2",
          "S1",
          player2Key
        )
    ).toBeUndefined();

    useCafeStore
      .getState()
      .addItemToPlayer(
        1,
        "S1",
        "Ali",
        fries,
        "CUST-2",
        player2Key
      );

    expect(
      useCafeStore
        .getState()
        .getPlayerOrder(
          1,
          "Ali",
          "NEW-CUST-1",
          "S1",
          player1Key
        )
        ?.totalAmount
    ).toBe(100);
    expect(
      useCafeStore
        .getState()
        .getPlayerOrder(
          1,
          "Ali",
          "CUST-2",
          "S1",
          player2Key
        )
        ?.totalAmount
    ).toBe(250);
  });

  it("finds a saved same-name cafe order by participant key after its customer ID changes", async () => {
    const { useCafeStore } = await loadStores();
    const participantKey = "S1:player1";

    useCafeStore
      .getState()
      .addItemToPlayer(
        1,
        "S1",
        "Ali",
        tea,
        "OLD-CUST-1",
        participantKey
      );
    useCafeStore.getState().saveOrder({
      tableId: 1,
      tableName: "Table 1",
      sessionId: "S1",
      customerName: "Ali",
      customerAccountId: "OLD-CUST-1",
      participantKey,
      orderItems:
        useCafeStore
          .getState()
          .getPlayerOrder(
            1,
            "Ali",
            "OLD-CUST-1",
            "S1",
            participantKey
          )
          ?.orderItems ?? [],
    });

    const savedOrder =
      useCafeStore
        .getState()
        .getSavedOrderForTable(
          1,
          "S1",
          "Ali",
          "NEW-CUST-1",
          participantKey
        );

    expect(savedOrder?.totalAmount).toBe(100);
    expect(savedOrder?.participantKey).toBe(
      participantKey
    );
  });

  it("updates the active session aggregate cafe total for both players", async () => {
    const { useCafeStore, useTableStore } =
      await loadStores();

    useTableStore.getState().startSession({
      tableId: 1,
      sessionType: "single",
      player1: "Ali",
      player1CustomerId: "CUST-1",
      player2: "Bilal",
      player2CustomerId: "CUST-2",
      startTime: new Date("2026-07-13T10:00:00"),
    });
    const sessionId =
      useTableStore.getState().tables[0].session?.id;

    expect(sessionId).toBeTruthy();

    useCafeStore
      .getState()
      .addItemToPlayer(1, sessionId!, "Ali", tea, "CUST-1");
    useCafeStore
      .getState()
      .addItemToPlayer(
        1,
        sessionId!,
        "Bilal",
        fries,
        "CUST-2"
      );

    useTableStore.getState().updateSessionCafe({
      tableId: 1,
      cafeOrders:
        useCafeStore.getState().getTableOrderItems(1),
    });

    const session =
      useTableStore.getState().tables[0].session;

    expect(session?.cafeAmount).toBe(350);
    expect(
      session?.cafeOrders.filter(
        (item) => item.playerName === "Ali"
      )
    ).toHaveLength(1);
    expect(
      session?.cafeOrders.filter(
        (item) => item.playerName === "Bilal"
      )
    ).toHaveLength(1);
  });

  it("adds Player 2 cafe charges to the correct customer account", async () => {
    const { useCafeStore, useCustomerAccountStore } =
      await loadStores();
    const player2 =
      useCustomerAccountStore
        .getState()
        .createCustomerAccount({
          customerName: "Bilal",
        });

    useCafeStore
      .getState()
      .addItemToPlayer(
        1,
        "S1",
        "Bilal",
        fries,
        player2.id
      );
    const savedOrder =
      useCafeStore.getState().saveOrder({
        tableId: 1,
        tableName: "Table 1",
        sessionId: "S1",
        customerName: "Bilal",
        customerAccountId: player2.id,
        orderItems:
          useCafeStore
            .getState()
            .getPlayerOrder(1, "Bilal", player2.id)
            ?.orderItems ?? [],
      });

    useCustomerAccountStore
      .getState()
      .replaceCafeChargesForOrder({
        customerId: player2.id,
        customerName: "Bilal",
        sourceOrderId: savedOrder.id,
        charges: savedOrder.orderItems.map((item) => ({
          itemId: item.menuItemId,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          subtotal: item.subtotal,
          tableId: savedOrder.tableId,
          tableName: savedOrder.tableName,
          sessionId: savedOrder.sessionId,
          orderedAt: item.orderedAt!,
        })),
      });

    const account =
      useCustomerAccountStore
        .getState()
        .getCustomerById(player2.id);

    expect(account?.totalCafeAmount).toBe(250);
    expect(account?.grandTotal).toBe(250);
    expect(account?.cafeCharges).toHaveLength(1);
    expect(account?.cafeCharges[0].customerName).toBe(
      "Bilal"
    );
  });
});
