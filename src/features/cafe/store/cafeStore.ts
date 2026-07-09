import { create } from "zustand";

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

interface CafeStore {
  menu: MenuItem[];

  waitingCustomers: WaitingCustomer[];

  playerOrders: PlayerOrder[];

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

  saveOrder: (
    targetName: string
  ) => void;
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
  item: MenuItem
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
  create<CafeStore>((set, get) => ({
    menu: initialMenu,

    waitingCustomers: [],

    playerOrders: [],

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
              item
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
              item
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
  })),

saveOrder: (targetName) => {
  console.log(
    `Order saved for ${targetName}`
  );
},
}));
