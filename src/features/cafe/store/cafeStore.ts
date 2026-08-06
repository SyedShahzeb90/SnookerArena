import { create } from "zustand";
import { persist } from "zustand/middleware";

import { menuItems as initialMenu } from "../data/menu";

import type { PaymentMethod } from "@/types/session";
import type { OperatorSnapshot } from "@/types/operatorAudit";
import { getActiveOperatorSnapshot } from "@/lib/operatorAttribution";
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

  participantKey?: string;

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
  participantKey?: string;
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
  participantKey?: string;
  orderItems: OrderItem[];
  customerType?: "waiting_customer" | "table_player";
}

export interface MenuItemInput {
  name: string;
  category: string;
  price: number;
  emoji?: string;
  imageDataUrl?: string;
  imageKey?: string;
  isAvailable: boolean;
  trackStock: boolean;
  currentStock: number;
  lowStockAlertQuantity: number;
  stockUnit: string;
}

export interface StockTransaction {
  id: string;
  menuItemId: string;
  type: "confirmed_charge" | "charge_restored" | "manual_add" | "manual_remove" | "manual_set" | "restock" | "restock_cancelled";
  quantityChange: number;
  balanceAfter: number;
  note: string;
  createdAt: string;
  sourceId?: string;
  lineId?: string;
  quantityBefore?: number;
  quantityAfter?: number;
  restockingRecordId?: string;
}

export type StockAdjustmentType = "add" | "remove" | "set";

export type VendorRestockingPaymentSource = "cash_drawer" | "digital" | "staff_paid" | "owner_paid" | "vendor_credit";

export interface VendorRestockingRecord {
  id: string;
  vendorName: string;
  menuItemId: string;
  productName: string;
  quantityReceived: number;
  unit: string;
  costPerUnit: number;
  totalCost: number;
  paymentSource: VendorRestockingPaymentSource;
  purchaseDate: string;
  note?: string;
  createdBy: string;
  createdByOperator?: OperatorSnapshot;
  createdAt: string;
  businessDayId?: string;
  status: "active" | "cancelled";
  cancelledAt?: string;
  cancelledBy?: string;
  cancelledByOperator?: OperatorSnapshot;
  cancellationNote?: string;
  cancelledBusinessDayId?: string;
  creditPaidAt?: string;
  creditPaymentSource?: Exclude<VendorRestockingPaymentSource, "vendor_credit">;
  creditPaidBusinessDayId?: string;
  creditPaidBy?: string;
  creditPaidByOperator?: OperatorSnapshot;
}

export interface VendorRestockingInput {
  vendorName: string;
  menuItemId: string;
  quantityReceived: number;
  unit: string;
  costPerUnit: number;
  paymentSource: VendorRestockingPaymentSource;
  purchaseDate: string;
  note?: string;
  createdBy: string;
  businessDayId?: string;
}

interface OrderItemContext {
  tableId?: number;
  sessionId?: string;
  customerName?: string;
  playerName?: string;
  playerId?: string;
  participantKey?: string;
}

interface CafeStore {
  menu: MenuItem[];

  waitingCustomers: WaitingCustomer[];

  playerOrders: PlayerOrder[];

  savedOrders: SavedCafeOrder[];

  stockTransactions: StockTransaction[];

  stockCommitments: Record<string, Record<string, number>>;

  vendorRestockingRecords: VendorRestockingRecord[];

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

  migrateMenuImageReference: (id: string, imageKey: string) => void;

  adjustStock: (menuItemId: string, type: StockAdjustmentType, quantity: number, note: string) => void;

  confirmStockForCharge: (sourceId: string, items: OrderItem[]) => void;

  reverseStockForCharge: (sourceId: string, note: string) => void;

  recordVendorRestocking: (input: VendorRestockingInput) => VendorRestockingRecord;

  cancelVendorRestocking: (recordId: string, input: { cancelledBy: string; cancellationNote: string; businessDayId?: string }) => void;

  payVendorCredit: (recordId: string, input: { paymentSource: Exclude<VendorRestockingPaymentSource, "vendor_credit">; paidBy: string; businessDayId?: string }) => void;

  addWaitingCustomer: (
    name: string
  ) => string;

  addPlayerOrder: (
    tableId: number,
    sessionId: string,
    playerName: string,
    playerId?: string,
    participantKey?: string
  ) => void;

  getPlayerOrder: (
    tableId: number,
    playerName: string,
    playerId?: string,
    sessionId?: string,
    participantKey?: string
  ) => PlayerOrder | undefined;

  getWaitingCustomerOrder: (
    customerId: string
  ) => WaitingCustomer | undefined;

  getTableCafeTotal: (
    tableId: number
  ) => number;

  getTableOrderItems: (
    tableId: number,
    sessionId?: string
  ) => OrderItem[];

  getSavedOrderForTable: (
    tableId: number,
    sessionId?: string,
    customerName?: string,
    customerAccountId?: string,
    participantKey?: string
  ) => SavedCafeOrder | undefined;

  addItemToPlayer: (
    tableId: number,
    sessionId: string,
    playerName: string,
    item: MenuItem,
    playerId?: string,
    participantKey?: string
  ) => void;

  increasePlayerItem: (
    tableId: number,
    playerName: string,
    menuItemId: string,
    playerId?: string,
    sessionId?: string,
    participantKey?: string
  ) => void;

  decreasePlayerItem: (
    tableId: number,
    playerName: string,
    menuItemId: string,
    playerId?: string,
    sessionId?: string,
    participantKey?: string
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
      participantKey: context.participantKey,
      orderedAt:
        new Date().toISOString(),
      lineId: `CAFE-LINE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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

function assertStockAvailable(menu: MenuItem[], menuItemId: string, orderItems: OrderItem[]) {
  const item = menu.find((current) => current.id === menuItemId);
  if (!item?.trackStock) return;
  const quantity = orderItems.find((line) => line.menuItemId === menuItemId)?.quantity ?? 0;
  const available = Math.max(0, item.currentStock ?? 0);
  if (available === 0) throw new Error(`${item.name} is out of stock.`);
  if (quantity >= available) throw new Error(`Only ${available} ${item.stockUnit || "pcs"} of ${item.name} are available.`);
}

export const useCafeStore =
  create<CafeStore>()(
    persist(
      (set, get) => ({
    menu: initialMenu,

    waitingCustomers: [],

    playerOrders: [],

    savedOrders: [],

    stockTransactions: [],

    stockCommitments: {},

    vendorRestockingRecords: [],

    addMenuItem: (input) => {
      const now = new Date().toISOString();
      const item: MenuItem = {
        id: `MENU-${Date.now()}`,
        name: input.name,
        category: input.category,
        price: input.price,
        emoji: input.emoji,
        imageDataUrl: input.imageDataUrl,
        imageKey: input.imageKey,
        available: input.isAvailable,
        isAvailable: input.isAvailable,
        createdAt: now,
        updatedAt: now,
        trackStock: input.trackStock,
        currentStock: input.trackStock ? input.currentStock : 0,
        lowStockAlertQuantity: input.trackStock ? input.lowStockAlertQuantity : 0,
        stockUnit: input.trackStock ? input.stockUnit.trim() : "pcs",
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
                imageKey: input.imageKey,
                available:
                  input.isAvailable,
                isAvailable:
                  input.isAvailable,
                updatedAt:
                  new Date().toISOString(),
                trackStock: input.trackStock,
                currentStock: input.trackStock
                  ? item.trackStock
                    ? Math.max(0, item.currentStock ?? 0)
                    : input.currentStock
                  : Math.max(0, item.currentStock ?? 0),
                lowStockAlertQuantity: input.trackStock ? input.lowStockAlertQuantity : 0,
                stockUnit: input.trackStock ? input.stockUnit.trim() : "pcs",
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

    migrateMenuImageReference: (id, imageKey) =>
      set((state) => ({
        menu: state.menu.map((item) =>
          item.id === id
            ? {
                ...item,
                imageKey,
                imageDataUrl: undefined,
                updatedAt: new Date().toISOString(),
              }
            : item
        ),
      })),

    adjustStock: (menuItemId, type, quantity, note) => {
      if (!note.trim()) throw new Error("A stock adjustment note is required.");
      if (!Number.isInteger(quantity) || quantity < 0 || (type !== "set" && quantity === 0)) {
        throw new Error("Enter a valid whole-number quantity.");
      }
      set((state) => {
        const item = state.menu.find((current) => current.id === menuItemId);
        if (!item?.trackStock) throw new Error("Stock tracking is not enabled for this product.");
        const current = Math.max(0, item.currentStock ?? 0);
        const next = type === "add" ? current + quantity : type === "remove" ? current - quantity : quantity;
        if (next < 0) throw new Error("Stock cannot become negative.");
        const now = new Date().toISOString();
        return {
          menu: state.menu.map((currentItem) => currentItem.id === menuItemId ? { ...currentItem, currentStock: next, updatedAt: now } : currentItem),
          stockTransactions: [
            ...state.stockTransactions,
            {
              id: `STOCK-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              menuItemId,
              type: type === "add" ? "manual_add" : type === "remove" ? "manual_remove" : "manual_set",
              quantityChange: next - current,
              balanceAfter: next,
              note: note.trim(),
              createdAt: now,
            },
          ],
        };
      });
    },

    confirmStockForCharge: (sourceId, items) => {
      if (!sourceId.trim()) throw new Error("A charge ID is required for stock tracking.");
      set((state) => {
        const desired = items.reduce<Record<string, number>>((totals, item) => {
          if (!state.menu.find((product) => product.id === item.menuItemId)?.trackStock) return totals;
          totals[item.menuItemId] = (totals[item.menuItemId] ?? 0) + item.quantity;
          return totals;
        }, {});
        const previous = state.stockCommitments[sourceId] ?? {};
        const ids = new Set([...Object.keys(previous), ...Object.keys(desired)]);

        for (const menuItemId of ids) {
          const item = state.menu.find((current) => current.id === menuItemId);
          if (!item?.trackStock) continue;
          const deduction = (desired[menuItemId] ?? 0) - (previous[menuItemId] ?? 0);
          if (deduction > Math.max(0, item.currentStock ?? 0)) {
            throw new Error(`${item.name} has only ${Math.max(0, item.currentStock ?? 0)} ${item.stockUnit || "pcs"} available.`);
          }
        }

        const now = new Date().toISOString();
        const transactions: StockTransaction[] = [];
        const menu = state.menu.map((item) => {
          if (!item.trackStock || !ids.has(item.id)) return item;
          const deduction = (desired[item.id] ?? 0) - (previous[item.id] ?? 0);
          if (deduction === 0) return item;
          const next = Math.max(0, (item.currentStock ?? 0) - deduction);
          transactions.push({
            id: `STOCK-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            menuItemId: item.id,
            type: deduction > 0 ? "confirmed_charge" : "charge_restored",
            quantityChange: -deduction,
            balanceAfter: next,
            note: deduction > 0 ? "Confirmed Cafe charge" : "Confirmed Cafe charge quantity reduced",
            createdAt: now,
            sourceId,
            lineId: items.find((line) => line.menuItemId === item.id)?.lineId,
          });
          return { ...item, currentStock: next, updatedAt: now };
        });

        return {
          menu,
          stockTransactions: [...state.stockTransactions, ...transactions],
          stockCommitments: { ...state.stockCommitments, [sourceId]: desired },
        };
      });
    },

    reverseStockForCharge: (sourceId, note) => {
      set((state) => {
        const commitment = state.stockCommitments[sourceId];
        if (!commitment) return state;
        const now = new Date().toISOString();
        const transactions: StockTransaction[] = [];
        const menu = state.menu.map((item) => {
          const quantity = commitment[item.id] ?? 0;
          if (!item.trackStock || quantity <= 0) return item;
          const next = Math.max(0, item.currentStock ?? 0) + quantity;
          transactions.push({
            id: `STOCK-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            menuItemId: item.id,
            type: "charge_restored",
            quantityChange: quantity,
            balanceAfter: next,
            note: note.trim() || "Cafe charge reversed",
            createdAt: now,
            sourceId,
          });
          return { ...item, currentStock: next, updatedAt: now };
        });
        const stockCommitments = { ...state.stockCommitments };
        delete stockCommitments[sourceId];
        return { menu, stockTransactions: [...state.stockTransactions, ...transactions], stockCommitments };
      });
    },

    recordVendorRestocking: (input) => {
      const vendorName = input.vendorName.trim();
      const unit = input.unit.trim();
      const createdBy = input.createdBy.trim() || "Operator";
      if (!vendorName) throw new Error("Vendor name is required.");
      if (!input.menuItemId) throw new Error("Product is required.");
      if (!Number.isInteger(input.quantityReceived) || input.quantityReceived <= 0) throw new Error("Quantity must be a positive whole number.");
      if (!Number.isFinite(input.costPerUnit) || input.costPerUnit < 0) throw new Error("Cost per unit must be zero or greater.");
      if (!input.purchaseDate || Number.isNaN(new Date(input.purchaseDate).getTime())) throw new Error("Purchase date is required.");

      const item = get().menu.find((product) => product.id === input.menuItemId);
      if (!item?.trackStock) throw new Error("Select a stock-tracked Cafe product.");
      const configuredUnit = (item.stockUnit || "pcs").trim();
      if (unit.toLowerCase() !== configuredUnit.toLowerCase()) throw new Error(`Unit must match ${configuredUnit}.`);

      const now = new Date().toISOString();
      const record: VendorRestockingRecord = {
        id: `RESTOCK-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        vendorName,
        menuItemId: item.id,
        productName: item.name,
        quantityReceived: input.quantityReceived,
        unit: configuredUnit,
        costPerUnit: input.costPerUnit,
        totalCost: input.quantityReceived * input.costPerUnit,
        paymentSource: input.paymentSource,
        purchaseDate: input.purchaseDate,
        note: input.note?.trim() || undefined,
        createdBy,
        createdByOperator: getActiveOperatorSnapshot(),
        createdAt: now,
        businessDayId: input.businessDayId,
        status: "active",
      };

      set((state) => {
        const current = Math.max(0, state.menu.find((product) => product.id === item.id)?.currentStock ?? 0);
        const next = current + record.quantityReceived;
        return {
          menu: state.menu.map((product) => product.id === item.id ? { ...product, currentStock: next, updatedAt: now } : product),
          vendorRestockingRecords: [record, ...state.vendorRestockingRecords],
          stockTransactions: [...state.stockTransactions, {
            id: `STOCK-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            menuItemId: item.id,
            type: "restock",
            quantityChange: record.quantityReceived,
            balanceAfter: next,
            quantityBefore: current,
            quantityAfter: next,
            note: record.note || `Vendor restock from ${record.vendorName}`,
            createdAt: now,
            sourceId: record.id,
            restockingRecordId: record.id,
          }],
        };
      });
      return record;
    },

    cancelVendorRestocking: (recordId, input) => {
      const record = get().vendorRestockingRecords.find((item) => item.id === recordId);
      if (!record) throw new Error("Restocking record was not found.");
      if (record.status === "cancelled") throw new Error("This restocking record is already cancelled.");
      if (!input.cancellationNote.trim()) throw new Error("A cancellation note is required.");
      const item = get().menu.find((product) => product.id === record.menuItemId);
      if (!item) throw new Error("The linked Cafe product was not found.");
      const current = Math.max(0, item.currentStock ?? 0);
      if (current < record.quantityReceived) throw new Error("This restock cannot be cancelled because it would make stock negative.");
      const now = new Date().toISOString();
      const next = current - record.quantityReceived;
      set((state) => ({
        menu: state.menu.map((product) => product.id === item.id ? { ...product, currentStock: next, updatedAt: now } : product),
        vendorRestockingRecords: state.vendorRestockingRecords.map((entry) => entry.id === recordId ? {
          ...entry,
          status: "cancelled",
          cancelledAt: now,
          cancelledBy: input.cancelledBy.trim() || "Operator",
          cancelledByOperator: getActiveOperatorSnapshot(),
          cancellationNote: input.cancellationNote.trim(),
          cancelledBusinessDayId: input.businessDayId,
        } : entry),
        stockTransactions: [...state.stockTransactions, {
          id: `STOCK-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          menuItemId: item.id,
          type: "restock_cancelled",
          quantityChange: -record.quantityReceived,
          balanceAfter: next,
          quantityBefore: current,
          quantityAfter: next,
          note: input.cancellationNote.trim(),
          createdAt: now,
          sourceId: record.id,
          restockingRecordId: record.id,
        }],
      }));
    },

    payVendorCredit: (recordId, input) => {
      const record = get().vendorRestockingRecords.find((item) => item.id === recordId);
      if (!record) throw new Error("Restocking record was not found.");
      if (record.status !== "active") throw new Error("Cancelled restocking cannot be paid.");
      if (record.paymentSource !== "vendor_credit") throw new Error("This record is not vendor credit.");
      if (record.creditPaidAt) throw new Error("This vendor credit has already been paid.");
      const now = new Date().toISOString();
      set((state) => ({
        vendorRestockingRecords: state.vendorRestockingRecords.map((entry) => entry.id === recordId ? {
          ...entry,
          creditPaidAt: now,
          creditPaymentSource: input.paymentSource,
          creditPaidBusinessDayId: input.businessDayId,
          creditPaidBy: input.paidBy.trim() || "Operator",
          creditPaidByOperator: getActiveOperatorSnapshot(),
        } : entry),
      }));
    },

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
      playerId,
      participantKey
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
              (participantKey && p.participantKey
                ? participantKey === p.participantKey
                : isSamePlayerIdentity(p, {
                    playerId,
                    playerKey,
                    playerName,
                  }))
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
              participantKey,
              orderItems: [],
              totalAmount: 0,
            },
          ],
        };
      }),

    getPlayerOrder: (
      tableId,
      playerName,
      playerId,
      sessionId,
      participantKey
    ) =>
      get().playerOrders.find(
        (p) =>
          p.tableId === tableId &&
          (!sessionId || p.sessionId === sessionId) &&
          (participantKey && p.participantKey
            ? participantKey === p.participantKey
            : isSamePlayerIdentity(p, {
                playerId,
                playerName,
              }))
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

    getTableOrderItems: (tableId, sessionId) =>
      get()
        .playerOrders.filter(
          (order) =>
            order.tableId === tableId &&
            (!sessionId ||
              order.sessionId === sessionId)
        )
        .flatMap(
          (order) => order.orderItems
        ),

    getSavedOrderForTable: (
      tableId,
      sessionId,
      customerName,
      customerAccountId,
      participantKey
    ) =>
      get().savedOrders.find((order) => {
        if (participantKey && order.participantKey) {
          return order.participantKey === participantKey;
        }

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

        if (sessionId) {
          return order.sessionId === sessionId;
        }

        return order.tableId === tableId;
      }),

addItemToPlayer: (
  tableId,
  sessionId,
  playerName,
  item,
  playerId,
  participantKey
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
          (participantKey && player.participantKey
            ? participantKey === player.participantKey
            : isSamePlayerIdentity(player, {
                playerId,
                playerKey,
                playerName,
              }))
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
            participantKey,
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
            !(participantKey && player.participantKey
              ? participantKey === player.participantKey
              : isSamePlayerIdentity(player, {
                  playerId,
                  playerKey,
                  playerName,
                }))
          ) {
            return player;
          }

          assertStockAvailable(state.menu, item.id, player.orderItems);

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
                participantKey,
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
  playerId,
  sessionId,
  participantKey
) =>
  set((state) => ({
    playerOrders:
      state.playerOrders.map(
        (player) => {
          if (
            player.tableId !==
              tableId ||
            (sessionId && player.sessionId !== sessionId) ||
            !(participantKey && player.participantKey
              ? participantKey === player.participantKey
              : isSamePlayerIdentity(player, {
                  playerId,
                  playerName,
                }))
          )
            return player;

          assertStockAvailable(state.menu, menuItemId, player.orderItems);

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
  playerId,
  sessionId,
  participantKey
) =>
  set((state) => ({
    playerOrders:
      state.playerOrders.map(
        (player) => {
          if (
            player.tableId !==
              tableId ||
            (sessionId && player.sessionId !== sessionId) ||
            !(participantKey && player.participantKey
              ? participantKey === player.participantKey
              : isSamePlayerIdentity(player, {
                  playerId,
                  playerName,
                }))
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

          assertStockAvailable(state.menu, item.id, customer.orderItems);

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

          assertStockAvailable(state.menu, menuItemId, customer.orderItems);

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
        (input.participantKey && order.participantKey
          ? input.participantKey === order.participantKey
          : isSamePlayerIdentity(
              {
                customerId: order.customerAccountId,
                playerName: order.customerName,
              },
              {
                customerId:
                  input.customerAccountId,
                playerName: input.customerName,
              }
            ))
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
    participantKey: input.participantKey,
    customerType:
      input.customerType ??
      (input.tableId === undefined
        ? "waiting_customer"
        : "table_player"),
    orderItems: input.orderItems.map(
      (item, index) => ({
        ...item,
        lineId: item.lineId ?? `${existingOrder?.id ?? "CAFE"}-${item.menuItemId}-${index}`,
      })
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

  get().confirmStockForCharge(savedOrder.id, savedOrder.orderItems);

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
              order.customerAccountId ??
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
          isSamePlayerIdentity(order, {
            playerId:
              attachedOrder!.customerAccountId,
            playerName:
              attachedOrder!.customerName,
          })
      );

    const playerOrders = playerOrderExists
      ? state.playerOrders.map((order) =>
          order.tableId === tableId &&
          order.sessionId ===
            sessionId &&
          isSamePlayerIdentity(order, {
            playerId:
              attachedOrder!.customerAccountId,
            playerName:
              attachedOrder!.customerName,
          })
            ? {
                ...order,
                playerId:
                  attachedOrder!
                    .customerAccountId ??
                  order.playerId,
                playerKey:
                  getPlayerIdentityKey({
                    customerId:
                      attachedOrder!
                        .customerAccountId ??
                      order.playerId,
                    playerName:
                      attachedOrder!
                        .customerName,
                  }),
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
            playerId:
              attachedOrder.customerAccountId,
            playerKey:
              getPlayerIdentityKey({
                customerId:
                  attachedOrder.customerAccountId,
                playerName:
                  attachedOrder.customerName,
              }),
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
  set((state) => {
    const restoredByItem = Object.values(state.stockCommitments).reduce<Record<string, number>>((totals, commitment) => {
      Object.entries(commitment).forEach(([menuItemId, quantity]) => {
        totals[menuItemId] = (totals[menuItemId] ?? 0) + quantity;
      });
      return totals;
    }, {});
    const now = new Date().toISOString();
    const restoredTransactions = state.menu.flatMap<StockTransaction>((item) => {
      const quantity = restoredByItem[item.id] ?? 0;
      if (!item.trackStock || quantity <= 0) return [];
      return [{
        id: `STOCK-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        menuItemId: item.id,
        type: "charge_restored",
        quantityChange: quantity,
        balanceAfter: Math.max(0, item.currentStock ?? 0) + quantity,
        note: "Cafe test data cleared",
        createdAt: now,
        sourceId: "clear-test-data",
      }];
    });
    return {
      menu: state.menu.map((item) => restoredByItem[item.id]
        ? { ...item, currentStock: Math.max(0, item.currentStock ?? 0) + restoredByItem[item.id] }
        : item),
      waitingCustomers: [],
      playerOrders: [],
      savedOrders: [],
      stockCommitments: {},
      stockTransactions: [...state.stockTransactions, ...restoredTransactions],
    };
  }),

resetCafeStoreToDefault: () =>
  set({
    menu: initialMenu,
    waitingCustomers: [],
    playerOrders: [],
    savedOrders: [],
    stockTransactions: [],
    stockCommitments: {},
    vendorRestockingRecords: [],
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
          stockTransactions: state.stockTransactions,
          stockCommitments: state.stockCommitments,
          vendorRestockingRecords: state.vendorRestockingRecords,
        }),
      }
    )
  );
