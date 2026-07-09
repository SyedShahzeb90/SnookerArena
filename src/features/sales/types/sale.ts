import type {
  CafeOrderItem,
  PaymentMethod,
  SessionType,
} from "@/types/session";

export type PaymentStatus = "paid";

export interface SalePlayer {
  name: string;
}

export interface SalePlayerBreakdown {
  playerName: string;
  tableAmountShare: number;
  cafeAmount: number;
  totalAmount: number;
  cafeItems: CafeOrderItem[];
}

export interface Sale {
  id: string;
  invoiceNumber: string;
  tableId: number;
  tableName: string;
  sessionId: string;
  players: SalePlayer[];
  sessionType: SessionType;
  winnerName?: string;
  loserName?: string;
  payerName?: string;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
  createdAt: string;
  tableAmount: number;
  cafeAmount: number;
  subtotal: number;
  discount: number;
  grandTotal: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  orderedItems: CafeOrderItem[];
  playerBreakdown?: SalePlayerBreakdown[];
}

export type ReportRange =
  | "today"
  | "yesterday"
  | "this-week"
  | "this-month"
  | "custom";

export interface SalesTotals {
  revenue: number;
  tableRevenue: number;
  cafeRevenue: number;
  discount: number;
  salesCount: number;
  averageSale: number;
}
