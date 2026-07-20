import type {
  PaymentMethod,
  SessionType,
} from "@/types/session";

export type CustomerAccountStatus =
  | "active"
  | "closed";

export type CustomerPaymentStatus =
  | "unpaid"
  | "paid";

export interface CustomerGameCharge {
  id: string;
  sessionId: string;
  tableId: number;
  tableName: string;
  tableType: string;
  sessionType: SessionType;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
  winnerName?: string;
  loserName?: string;
  winningTeam?: "A" | "B";
  losingTeam?: "A" | "B";
  payerCustomerId: string;
  payerName: string;
  amount: number;
  createdAt: string;
  shareType: "full" | "split";
  teamName?: string;
  teamPlayers?: string[];
  gameCount?: number;
  originalAmount?: number;
  isFinal?: boolean;
  finalGames?: number;
  sourceFrameIds?: string[];
}

export interface CustomerCafeCharge {
  id: string;
  itemId: string;
  name: string;
  quantity: number;
  price: number;
  subtotal: number;
  customerId: string;
  customerName: string;
  tableId?: number;
  tableName?: string;
  sessionId?: string;
  orderedAt: string;
  createdAt: string;
  sourceOrderId?: string;
}

export interface CustomerAccessoryCharge
  extends CustomerCafeCharge {}

export interface CustomerAccount {
  id: string;
  customerToken: string;
  staffBillNumber?: string;
  customerName: string;
  customerNote?: string;
  phone?: string;
  status: CustomerAccountStatus;
  openedAt: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
  gameCharges: CustomerGameCharge[];
  cafeCharges: CustomerCafeCharge[];
  accessoryCharges?: CustomerAccessoryCharge[];
  totalGameAmount: number;
  totalCafeAmount: number;
  totalAccessoryAmount?: number;
  discount: number;
  grandTotal: number;
  paymentStatus: CustomerPaymentStatus;
  paymentMethod?: PaymentMethod;
  paidAt?: string;
  activeBusinessDayId?: string;
  saleId?: string;
  advanceGamesApplied?: number;
  advanceReduction?: number;
  advanceApplicationId?: string;
  lastTableName?: string;
  lastActivityAt?: string;
}

export interface CustomerTotals {
  totalGameAmount: number;
  totalCafeAmount: number;
  totalAccessoryAmount: number;
  grandTotal: number;
}
