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

export interface Session {
  id: string;

  tableId: number;

  sessionType: SessionType;

  player1: string;

  player2?: string;

  startTime: Date;

  endTime?: Date;

  // Billing

  gameAmount: number;

  cafeAmount: number;

  discount: number;

  totalAmount: number;

  paymentMethod?: PaymentMethod;

  isPaid: boolean;
}