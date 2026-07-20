import { create } from "zustand";
import { persist } from "zustand/middleware";

import { menuItems as initialMenu } from "../data/menu";

import type { PaymentMethod } from "@/types/session";
import type {
  MenuItem,
  OrderItem,
  WaitingCustomer,
} from "../types/menu";
import {
  getPlayerIdentityKey,
  isSamePlayerIdentity,
} from "../utils/playerIdentity";

export interface PlayerOrder {
  tableId: number;

  sessionId: string;

  playerName: string;

  playerId?: string;

  playerKey?: string;

  orderItems: OrderItem[];

  totalAmount: number;
}

export interface SavedCafeOrder {
  id: string;
  tableId?: number;
  tableName?: string;
  sessionId?: string;
  customerName: string;
  customerAccountId?: string;
  customerType?: "waiting_customer" | "table_player";
  orderItems: OrderItem[];
  totalAmount: number;
  cafeAmount?: number;
  paymentStatus?: "draft" | "saved" | "paid" | "attached";
  paymentMethod?: PaymentMethod;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
  attachedTableId?: number;
  attachedSessionId?: string;
  status: "saved";
}

interface SaveOrderInput {
  tableId?: number;
  tableName?: string;
  sessionId?: string;
  customerName: string;
  customerAccountId?: string;
  orderItems: OrderItem[];
  customerType?: "waiting_customer" | "table_player";
}

export interface MenuItemInput {
  name: string;
  category: string;
  price: number;
  emoji?: string;
  imageDataUrl?: string;
  isAvailable: boolean;
}

interface OrderItemContext {
  tableId?: number;
  sessionId?: string;
  customerName?: string;
  playerName?: string;
  playerId?: string;
}

interface CafeStore {
  menu: MenuItem[];

  waitingCustomers: WaitingCustomer[];

  playerOrders: PlayerOrder[];

  savedOrders: SavedCafeOrder[];

  addMenuItem: (
    input: MenuItemInput
  ) => MenuItem;

  updateMenuItem: (
    id: string,
    input: MenuItemInput
  ) => void;

  toggleMenuItemAvailability: (
    id: string
  ) => void;

  deleteMenuItem: (id: string) => void;

  addWaitingCustomer: (
    name: string
  ) => string;

  addPlayerOrder: (
    tableId: number,
    sessionId: string,
    playerName: string,
    playerId?: string
  ) => void;

  getPlayerOrder: (
    tableId: number,
    playerName: string,
    playerId?: string
  ) => PlayerOrder | undefined;

  getWaitingCustomerOrder: (
    customerId: string
  ) => WaitingCustomer | undefined;

  getTableCafeTotal: (
    tableId: number
  ) => number;

  getTableOrderItems: (
    tableId: number
  ) => OrderItem[];

  getSavedOrderForTable: (
    tableId: number,
    sessionId?: string,
    customerName?: string,
    customerAccountId?: string
  ) => SavedCafeOrder | undefined;

  addItemToPlayer: (
    tableId: number,
    sessionId: string,
    playerName: string,
    item: MenuItem,
    playerId?: string
  ) => void;

  increasePlayerItem: (
    tableId: number,
    playerName: string,
    menuItemId: string,
    playerId?: string
  ) => void;

  decreasePlayerItem: (
    tableId: number,
    playerName: string,
    menuItemId: string,
    playerId?: string
  ) => void;

  addItemToWaitingCustomer: (
    customerId: string,
    item: MenuItem
  ) => void;

  increaseWaitingItem: (
    customerId: string,
    menuItemId: string
  ) => void;

  decreaseWaitingItem: (
    customerId: string,
    menuItemId: string
  ) => void;

  clearTableOrders: (
    tableId: number
  ) => void;

  clearSessionOrders: (
    tableId: number,
    sessionId: string
  ) => void;

  deleteSavedOrdersForCustomerAccount: (
    customerAccountId: string
  ) => void;

  saveOrder: (
    input: SaveOrderInput
  ) => SavedCafeOrder;

  receiveWaitingCustomerPayment: (
    orderId: string,
    paymentMethod: PaymentMethod
  ) => SavedCafeOrder | undefined;

  attachWaitingOrderToTable: (
    orderId: string,
    tableId: number,
    tableName: string,
    sessionId: string
  ) => SavedCafeOrder | undefined;

  resetCafeTestData: () => void;
  resetCafeStoreToDefault: () => void;
}

const calculateTotal = (
  orderItems: OrderItem[]
) =>
  orderItems.reduce(
    (total, current) =>
      total +
      current.price * current.quantity,
    0
  );

const upsertOrderItem = (
  orderItems: OrderItem[],
  item: MenuItem,
  context: OrderItemContext = {}
) => {
  const existing = orderItems.find(
    (orderItem) =>
      orderItem.menuItemId === item.id
  );

  if (existing) {
    return orderItems.map((orderItem) =>
      orderItem.menuItemId === item.id
        ? {
            ...orderItem,
            quantity:
              orderItem.quantity + 1,
            subtotal:
              orderItem.price *
              (orderItem.quantity + 1),
          }
        : orderItem
    );
  }

  return [
    ...orderItems,
    {
      menuItemId: item.id,
      name: item.name,
      price: item.price,
      quantity: 1,
      subtotal: item.price,
      timeAdded: new Date(),
      tableId: context.tableId,
      sessionId: context.sessionId,
      customerName:
        context.customerName ??
        context.playerName,
      playerName: context.playerName,
      playerId: context.playerId,
      orderedAt:
        new Date().toISOString(),
    },
  ];
};

const increaseOrderItem = (
  orderItems: OrderItem[],
  menuItemId: string
) =>
  orderItems.map((item) =>
    item.menuItemId === menuItemId
      ? {
          ...item,
          quantity: item.quantity + 1,
          subtotal:
            item.price *
            (item.quantity + 1),
        }
      : item
  );

const decreaseOrderItem = (
  orderItems: OrderItem[],
  menuItemId: string
) =>
  orderItems
    .map((item) =>
      item.menuItemId === menuItemId
      ? {
          ...item,
          quantity: item.quantity - 1,
          subtotal:
            item.price *
            (item.quantity - 1),
        }
        : item
    )
    .filter((item) => item.quantity > 0);

export const useCafeStore =
  create<CafeStore>()(
    persist(
      (set, get) => ({
    menu: initialMenu,

    waitingCustomers: [],

    playerOrders: [],

    savedOrders: [],

    addMenuItem: (input) => {
      const now = new Date().toISOString();
      const item: MenuItem = {
        id: `MENU-${Date.now()}`,
        name: input.name,
        category: input.category,
        price: input.price,
        emoji: input.emoji,
        imageDataUrl: input.imageDataUrl,
        available: input.isAvailable,
        isAvailable: input.isAvailable,
        createdAt: now,
        updatedAt: now,
      };

      set((state) => ({
        menu: [item, ...state.menu],
      }));

      return item;
    },

    updateMenuItem: (id, input) =>
      set((state) => ({
        menu: state.menu.map((item) =>
          item.id === id
            ? {
                ...item,
                name: input.name,
                category: input.category,
                price: input.price,
                emoji: input.emoji,
                imageDataUrl: input.imageDataUrl,
                available:
                  input.isAvailable,
                isAvailable:
                  input.isAvailable,
                updatedAt:
                  new Date().toISOString(),
              }
            : item
        ),
      })),

    toggleMenuItemAvailability: (id) =>
      set((state) => ({
        menu: state.menu.map((item) => {
          if (item.id !== id) return item;

          const nextAvailable = !(
            item.isAvailable ??
            item.available
          );

          return {
            ...item,
            available: nextAvailable,
            isAvailable: nextAvailable,
            updatedAt:
              new Date().toISOString(),
          };
        }),
      })),

    deleteMenuItem: (id) =>
      set((state) => ({
        menu: state.menu.filter(
          (item) => item.id !== id
        ),
      })),

    addWaitingCustomer: (
      name
    ) => {
      const id = `WC-${Date.now()}`;

      set((state) => ({
        waitingCustomers: [
          ...state.waitingCustomers,
          {
            id,
            name,
            orderItems: [],
            totalAmount: 0,
          },
        ],
      }));

      return id;
    },

    addPlayerOrder: (
      tableId,
      sessionId,
      playerName,
      playerId
    ) =>
      set((state) => {
        const playerKey =
          getPlayerIdentityKey({
            customerId: playerId,
            playerName,
          });
        const exists =
          state.playerOrders.find(
            (p) =>
              p.tableId === tableId &&
              p.sessionId === sessionId &&
              isSamePlayerIdentity(p, {
                playerId,
                playerKey,
                playerName,
              })
          );

        if (exists) return state;

        return {
          playerOrders: [
            ...state.playerOrders,
            {
              tableId,
              sessionId,
              playerName,
              playerId,
              playerKey,
              orderItems: [],
              totalAmount: 0,
            },
          ],
        };
      }),

    getPlayerOrder: (
      tableId,
      playerName,
      playerId
    ) =>
      get().playerOrders.find(
        (p) =>
          p.tableId === tableId &&
          isSamePlayerIdentity(p, {
            playerId,
            playerName,
          })
      ),

    getWaitingCustomerOrder: (
      customerId
    ) =>
      get().waitingCustomers.find(
        (c) =>
          c.id === customerId
      ),

    getTableCafeTotal: (tableId) =>
      get()
        .playerOrders.filter(
          (order) =>
            order.tableId === tableId
        )
        .reduce(
          (total, order) =>
            total + order.totalAmount,
          0
        ),

    getTableOrderItems: (tableId) =>
      get()
        .playerOrders.filter(
          (order) =>
            order.tableId === tableId
        )
        .flatMap(
          (order) => order.orderItems
        ),

    getSavedOrderForTable: (
      tableId,
      sessionId,
      customerName,
      customerAccountId
    ) =>
      get().savedOrders.find((order) => {
        if (
          customerAccountId &&
          order.customerAccountId &&
          order.customerAccountId !== customerAccountId
        ) {
          return false;
        }

        if (
          customerName &&
          !isSamePlayerIdentity(
            {
              customerId: order.customerAccountId,
              playerName: order.customerName,
            },
            {
              customerId: customerAccountId,
              playerName: customerName,
            }
          )
        ) {
          return false;
        }

        if (
          sessionId &&
          order.sessionId === sessionId
        ) {
          return true;
        }

        return order.tableId === tableId;
      }),

addItemToPlayer: (
  tableId,
  sessionId,
  playerName,
  item,
  playerId
) =>
  set((state) => {
    const playerKey =
      getPlayerIdentityKey({
        customerId: playerId,
        playerName,
      });
    const exists =
      state.playerOrders.some(
        (player) =>
          player.tableId === tableId &&
          player.sessionId === sessionId &&
          isSamePlayerIdentity(player, {
            playerId,
            playerKey,
            playerName,
          })
      );

    const playerOrders = exists
      ? state.playerOrders
      : [
          ...state.playerOrders,
          {
            tableId,
            sessionId,
            playerName,
            playerId,
            playerKey,
            orderItems: [],
            totalAmount: 0,
          },
        ];

    return {
      playerOrders: playerOrders.map(
        (player) => {
          if (
            player.tableId !== tableId ||
            player.sessionId !== sessionId ||
            !isSamePlayerIdentity(player, {
              playerId,
              playerKey,
              playerName,
            })
          ) {
            return player;
          }

          const orderItems =
            upsertOrderItem(
              player.orderItems,
              item,
              {
                tableId,
                sessionId,
                customerName: playerName,
                playerName,
                playerId,
              }
            );

          return {
            ...player,
            orderItems,
            totalAmount:
              calculateTotal(orderItems),
          };
        }
      ),
    };
  }),

increasePlayerItem: (
  tableId,
  playerName,
  menuItemId,
  playerId
) =>
  set((state) => ({
    playerOrders:
      state.playerOrders.map(
        (player) => {
          if (
            player.tableId !==
              tableId ||
            !isSamePlayerIdentity(player, {
              playerId,
              playerName,
            })
          )
            return player;

          const orderItems =
            increaseOrderItem(
              player.orderItems,
              menuItemId
            );

          return {
            ...player,
            orderItems,
            totalAmount:
              calculateTotal(orderItems),
          };
        }
      ),
  })),

decreasePlayerItem: (
  tableId,
  playerName,
  menuItemId,
  playerId
) =>
  set((state) => ({
    playerOrders:
      state.playerOrders.map(
        (player) => {
          if (
            player.tableId !==
              tableId ||
            !isSamePlayerIdentity(player, {
              playerId,
              playerName,
            })
          )
            return player;

          const orderItems =
            decreaseOrderItem(
              player.orderItems,
              menuItemId
            );

          return {
            ...player,
            orderItems,
            totalAmount:
              calculateTotal(orderItems),
          };
        }
      ),
  })),

addItemToWaitingCustomer: (
  customerId,
  item
) =>
  set((state) => ({
    waitingCustomers:
      state.waitingCustomers.map(
        (customer) => {
          if (
            customer.id !==
            customerId
          )
            return customer;

          const orderItems =
            upsertOrderItem(
              customer.orderItems,
              item,
              {
                customerName:
                  customer.name,
              }
            );

          return {
            ...customer,
            orderItems,
            totalAmount:
              calculateTotal(orderItems),
          };
        }
      ),
  })),

increaseWaitingItem: (
  customerId,
  menuItemId
) =>
  set((state) => ({
    waitingCustomers:
      state.waitingCustomers.map(
        (customer) => {
          if (
            customer.id !==
            customerId
          )
            return customer;

          const orderItems =
            increaseOrderItem(
              customer.orderItems,
              menuItemId
            );

          return {
            ...customer,
            orderItems,
            totalAmount:
              calculateTotal(orderItems),
          };
        }
      ),
  })),

decreaseWaitingItem: (
  customerId,
  menuItemId
) =>
  set((state) => ({
    waitingCustomers:
      state.waitingCustomers.map(
        (customer) => {
          if (
            customer.id !==
            customerId
          )
            return customer;

          const orderItems =
            decreaseOrderItem(
              customer.orderItems,
              menuItemId
            );

          return {
            ...customer,
            orderItems,
            totalAmount:
              calculateTotal(orderItems),
          };
        }
      ),
  })),

clearTableOrders: (tableId) =>
  set((state) => ({
    playerOrders:
      state.playerOrders.filter(
        (order) =>
          order.tableId !== tableId
      ),
    savedOrders:
      state.savedOrders.filter(
        (order) =>
          order.tableId !== tableId
      ),
  })),

clearSessionOrders: (tableId, sessionId) =>
  set((state) => ({
    playerOrders:
      state.playerOrders.filter(
        (order) =>
          !(
            order.tableId === tableId &&
            order.sessionId === sessionId
          )
      ),
    savedOrders:
      state.savedOrders.filter(
        (order) =>
          !(
            order.tableId === tableId &&
            order.sessionId === sessionId
          )
      ),
  })),

deleteSavedOrdersForCustomerAccount: (customerAccountId) =>
  set((state) => ({
    savedOrders: state.savedOrders.filter(
      (order) =>
        order.customerAccountId !== customerAccountId
    ),
  })),

saveOrder: (input) => {
  const totalAmount = calculateTotal(
    input.orderItems
  );

  if (!input.customerName.trim()) {
    throw new Error(
      "Customer is required."
    );
  }

  if (input.orderItems.length === 0) {
    throw new Error(
      "Order cart is empty."
    );
  }

  const now = new Date().toISOString();
  const existingOrder =
    get().savedOrders.find((order) => {
      if (
        input.tableId === undefined &&
        (input.customerType ===
          "waiting_customer" ||
          order.customerType ===
            "waiting_customer") &&
        (input.customerAccountId
          ? order.customerAccountId ===
            input.customerAccountId
          : order.customerName ===
            input.customerName) &&
        order.paymentStatus === "saved"
      ) {
        return true;
      }

      if (
        input.sessionId &&
        order.sessionId === input.sessionId &&
        isSamePlayerIdentity(
          {
            customerId: order.customerAccountId,
            playerName: order.customerName,
          },
          {
            customerId:
              input.customerAccountId,
            playerName: input.customerName,
          }
        )
      ) {
        return true;
      }

      return (
        input.tableId !== undefined &&
        order.tableId === input.tableId &&
        isSamePlayerIdentity(
          {
            customerId: order.customerAccountId,
            playerName: order.customerName,
          },
          {
            customerId:
              input.customerAccountId,
            playerName: input.customerName,
          }
        ) &&
        order.status === "saved"
      );
    });

  const savedOrder: SavedCafeOrder = {
    id:
      existingOrder?.id ??
      `CAFE-${Date.now()}`,
    tableId: input.tableId,
    tableName: input.tableName,
    sessionId: input.sessionId,
    customerName: input.customerName,
    customerAccountId:
      input.customerAccountId,
    customerType:
      input.customerType ??
      (input.tableId === undefined
        ? "waiting_customer"
        : "table_player"),
    orderItems: input.orderItems.map(
      (item) => ({ ...item })
    ),
    totalAmount,
    cafeAmount: totalAmount,
    paymentStatus:
      input.tableId === undefined
        ? "saved"
        : "attached",
    createdAt:
      existingOrder?.createdAt ?? now,
    updatedAt: now,
    status: "saved",
  };

  set((state) => {
    const savedOrders = existingOrder
      ? state.savedOrders.map((order) =>
          order.id === existingOrder.id
            ? savedOrder
            : order
        )
      : [
          savedOrder,
          ...state.savedOrders,
        ];

    const shouldAttachToTable =
      input.tableId !== undefined &&
      input.sessionId;

    const playerOrderExists =
      shouldAttachToTable &&
      state.playerOrders.some(
        (order) =>
          order.tableId === input.tableId &&
          order.sessionId === input.sessionId &&
          isSamePlayerIdentity(order, {
            playerId:
              input.customerAccountId,
            playerName:
              input.customerName,
          })
      );

    const playerOrders =
      shouldAttachToTable
        ? playerOrderExists
          ? state.playerOrders.map((order) =>
              order.tableId ===
                input.tableId &&
              order.sessionId ===
                input.sessionId &&
              isSamePlayerIdentity(order, {
                playerId:
                  input.customerAccountId,
                playerName:
                  input.customerName,
              })
                ? {
                    ...order,
                    playerId:
                      input.customerAccountId ??
                      order.playerId,
                    playerKey:
                      getPlayerIdentityKey({
                        customerId:
                          input.customerAccountId ??
                          order.playerId,
                        playerName:
                          input.customerName,
                      }),
                    orderItems:
                      savedOrder.orderItems,
                    totalAmount:
                      savedOrder.totalAmount,
                  }
                : order
            )
          : [
              ...state.playerOrders,
              {
                tableId: input.tableId!,
                sessionId:
                  input.sessionId!,
                playerName:
                  input.customerName,
                playerId:
                  input.customerAccountId,
                playerKey:
                  getPlayerIdentityKey({
                    customerId:
                      input.customerAccountId,
                    playerName:
                      input.customerName,
                  }),
                orderItems:
                  savedOrder.orderItems,
                totalAmount:
                  savedOrder.totalAmount,
              },
            ]
        : state.playerOrders;

    return {
      savedOrders,
      playerOrders,
    };
  });

  return savedOrder;
},

receiveWaitingCustomerPayment: (
  orderId,
  paymentMethod
) => {
  const now = new Date().toISOString();
  let paidOrder:
    | SavedCafeOrder
    | undefined;

  set((state) => {
    let customerName = "";
    const savedOrders =
      state.savedOrders.map((order) => {
        if (order.id !== orderId) {
          return order;
        }

        customerName = order.customerName;

        paidOrder = {
          ...order,
          paymentStatus: "paid",
          paymentMethod,
          paidAt: now,
          updatedAt: now,
        };

        return paidOrder;
      });

    const hasUnpaidOrder =
      customerName &&
      savedOrders.some(
        (order) =>
          order.customerType ===
            "waiting_customer" &&
          order.customerName ===
            customerName &&
          (order.paymentStatus ===
            "saved" ||
            order.paymentStatus ===
              "draft")
      );

    return {
      savedOrders,
      waitingCustomers:
        customerName && !hasUnpaidOrder
          ? state.waitingCustomers.filter(
              (customer) =>
                customer.name !==
                customerName
            )
          : state.waitingCustomers,
    };
  });

  return paidOrder;
},

attachWaitingOrderToTable: (
  orderId,
  tableId,
  tableName,
  sessionId
) => {
  const now = new Date().toISOString();
  let attachedOrder:
    | SavedCafeOrder
    | undefined;

  set((state) => {
    const savedOrders =
      state.savedOrders.map((order) => {
        if (order.id !== orderId) {
          return order;
        }

        const orderItems =
          order.orderItems.map((item) => ({
            ...item,
            tableId,
            sessionId,
            customerName:
              order.customerName,
            playerName:
              order.customerName,
            playerId:
              order.customerName,
          }));

        attachedOrder = {
          ...order,
          tableId,
          tableName,
          sessionId,
          attachedTableId: tableId,
          attachedSessionId: sessionId,
          orderItems,
          paymentStatus: "attached",
          updatedAt: now,
        };

        return attachedOrder;
      });

    if (!attachedOrder) {
      return state;
    }

    const playerOrderExists =
      state.playerOrders.some(
        (order) =>
          order.tableId === tableId &&
          order.sessionId === sessionId &&
          order.playerName ===
            attachedOrder!
              .customerName
      );

    const playerOrders = playerOrderExists
      ? state.playerOrders.map((order) =>
          order.tableId === tableId &&
          order.sessionId ===
            sessionId &&
          order.playerName ===
            attachedOrder!
              .customerName
            ? {
                ...order,
                orderItems:
                  attachedOrder!
                    .orderItems,
                totalAmount:
                  attachedOrder!
                    .totalAmount,
              }
            : order
        )
      : [
          ...state.playerOrders,
          {
            tableId,
            sessionId,
            playerName:
              attachedOrder.customerName,
            orderItems:
              attachedOrder.orderItems,
            totalAmount:
              attachedOrder.totalAmount,
          },
        ];

    return {
      savedOrders,
      playerOrders,
    };
  });

  return attachedOrder;
},

resetCafeTestData: () =>
  set({
    waitingCustomers: [],
    playerOrders: [],
    savedOrders: [],
  }),

resetCafeStoreToDefault: () =>
  set({
    menu: initialMenu,
    waitingCustomers: [],
    playerOrders: [],
    savedOrders: [],
  }),
      }),
      {
        name: "snooker-arena-cafe",
        partialize: (state) => ({
          menu: state.menu,
          waitingCustomers:
            state.waitingCustomers,
          playerOrders: state.playerOrders,
          savedOrders: state.savedOrders,
        }),
      }
    )
  );
