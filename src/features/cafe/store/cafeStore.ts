import { create } from "zustand";
import { persist } from "zustand/middleware";

import { menuItems as initialMenu } from "../data/menu";

import type {
  MenuItem,
  OrderItem,
  WaitingCustomer,
} from "../types/menu";

export interface PlayerOrder {
  tableId: number;

  sessionId: string;

  playerName: string;

  orderItems: OrderItem[];

  totalAmount: number;
}

export interface SavedCafeOrder {
  id: string;
  tableId?: number;
  tableName?: string;
  sessionId?: string;
  customerName: string;
  orderItems: OrderItem[];
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
  status: "saved";
}

interface SaveOrderInput {
  tableId?: number;
  tableName?: string;
  sessionId?: string;
  customerName: string;
  orderItems: OrderItem[];
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

  addWaitingCustomer: (
    name: string
  ) => string;

  addPlayerOrder: (
    tableId: number,
    sessionId: string,
    playerName: string
  ) => void;

  getPlayerOrder: (
    tableId: number,
    playerName: string
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
    customerName?: string
  ) => SavedCafeOrder | undefined;

  addItemToPlayer: (
    tableId: number,
    sessionId: string,
    playerName: string,
    item: MenuItem
  ) => void;

  increasePlayerItem: (
    tableId: number,
    playerName: string,
    menuItemId: string
  ) => void;

  decreasePlayerItem: (
    tableId: number,
    playerName: string,
    menuItemId: string
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

  saveOrder: (
    input: SaveOrderInput
  ) => SavedCafeOrder;
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
      playerName
    ) =>
      set((state) => {
        const exists =
          state.playerOrders.find(
            (p) =>
              p.tableId === tableId &&
              p.playerName ===
                playerName
          );

        if (exists) return state;

        return {
          playerOrders: [
            ...state.playerOrders,
            {
              tableId,
              sessionId,
              playerName,
              orderItems: [],
              totalAmount: 0,
            },
          ],
        };
      }),

    getPlayerOrder: (
      tableId,
      playerName
    ) =>
      get().playerOrders.find(
        (p) =>
          p.tableId === tableId &&
          p.playerName ===
            playerName
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
      customerName
    ) =>
      get().savedOrders.find((order) => {
        if (
          customerName &&
          order.customerName !== customerName
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
  item
) =>
  set((state) => {
    const exists =
      state.playerOrders.some(
        (player) =>
          player.tableId === tableId &&
          player.playerName === playerName
      );

    const playerOrders = exists
      ? state.playerOrders
      : [
          ...state.playerOrders,
          {
            tableId,
            sessionId,
            playerName,
            orderItems: [],
            totalAmount: 0,
          },
        ];

    return {
      playerOrders: playerOrders.map(
        (player) => {
          if (
            player.tableId !== tableId ||
            player.playerName !== playerName
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
                playerId: playerName,
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
  menuItemId
) =>
  set((state) => ({
    playerOrders:
      state.playerOrders.map(
        (player) => {
          if (
            player.tableId !==
              tableId ||
            player.playerName !==
              playerName
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
  menuItemId
) =>
  set((state) => ({
    playerOrders:
      state.playerOrders.map(
        (player) => {
          if (
            player.tableId !==
              tableId ||
            player.playerName !==
              playerName
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
        input.sessionId &&
        order.sessionId === input.sessionId &&
        order.customerName ===
          input.customerName
      ) {
        return true;
      }

      return (
        input.tableId !== undefined &&
        order.tableId === input.tableId &&
        order.customerName ===
          input.customerName &&
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
    orderItems: input.orderItems.map(
      (item) => ({ ...item })
    ),
    totalAmount,
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

    const playerOrderExists =
      input.tableId !== undefined &&
      input.sessionId &&
      state.playerOrders.some(
        (order) =>
          order.tableId === input.tableId &&
          order.sessionId === input.sessionId &&
          order.playerName ===
            input.customerName
      );

    const playerOrders =
      input.tableId !== undefined &&
      input.sessionId
        ? playerOrderExists
          ? state.playerOrders.map((order) =>
              order.tableId ===
                input.tableId &&
              order.sessionId ===
                input.sessionId &&
              order.playerName ===
                input.customerName
                ? {
                    ...order,
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
                tableId: input.tableId,
                sessionId:
                  input.sessionId,
                playerName:
                  input.customerName,
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
      }),
      {
        name: "snooker-arena-cafe",
        partialize: (state) => ({
          waitingCustomers:
            state.waitingCustomers,
          playerOrders: state.playerOrders,
          savedOrders: state.savedOrders,
        }),
      }
    )
  );
