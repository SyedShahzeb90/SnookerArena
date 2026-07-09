export type SessionType =
  | "single"
  | "double"
  | "time"
  | "private";

export type PaymentMethod =
  | "cash"
  | "card"
  | "jazzcash"
  | "easypaisa";

export interface CafeOrderItem {
  menuItemId: string;

  name: string;

  price: number;

  quantity: number;

  subtotal: number;

  timeAdded: Date;
}

export interface Session {
  id: string;

  tableId: number;

  sessionType: SessionType;

  player1: string;

  player2?: string;

  startTime: Date;

  endTime?: Date;

  pausedAt?: Date;

  totalPausedMilliseconds: number;

  cafeAmount: number;

  cafeOrders: CafeOrderItem[];

  discount: number;

  paymentMethod?: PaymentMethod;

  isPaid: boolean;
}
