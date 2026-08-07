import type {
  CustomerCafeCharge,
  CustomerGameCharge,
} from "@/features/customers/types/customerAccount";
import type {
  CafeOrderItem,
  PaymentMethod,
  SessionType,
} from "@/types/session";
import type {
  OperatorSnapshot,
  TransactionAuditEvent,
} from "@/types/operatorAudit";

export type PaymentStatus =
  | "paid"
  | "pending"
  | "credit"
  | "cancelled"
  | "refunded"
  | "complimentary";

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

export interface PaymentSplit {
  method: PaymentMethod;
  amount: number;
}

export interface Sale {
  id: string;
  invoiceNumber: string;
  staffBillNumber?: string;
  tableId: number;
  tableName: string;
  saleType?:
    | "table"
    | "cafe-only"
    | "cafe_only"
    | "customer_bill"
    | "accessories";
  sessionId: string;
  players: SalePlayer[];
  sessionType: SessionType;
  winnerName?: string;
  loserName?: string;
  payerName?: string;
  teamAPlayers?: string[];
  teamBPlayers?: string[];
  teamAOneNameEnough?: boolean;
  teamBOneNameEnough?: boolean;
  extraPlayers?: string[];
  winningTeam?: "A" | "B";
  losingTeam?: "A" | "B";
  payerBreakdown?: {
    playerName: string;
    tableAmountShare: number;
    note?: string;
  }[];
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
  createdAt: string;
  paidAt?: string;
  tableAmount: number;
  cafeAmount: number;
  subtotal: number;
  discount: number;
  grandTotal: number;
  originalTableAmount?: number;
  originalGameCount?: number;
  advanceGamesApplied?: number;
  advanceReduction?: number;
  settlementLabel?: string;
  paymentMethod: PaymentMethod;
  paymentSplits?: PaymentSplit[];
  paymentStatus: PaymentStatus;
  paymentReceivedBy?: OperatorSnapshot;
  paymentCorrectedBy?: OperatorSnapshot;
  operatorAudit?: TransactionAuditEvent[];
  activeBusinessDayId?: string;
  orderedItems: CafeOrderItem[];
  playerBreakdown?: SalePlayerBreakdown[];
  customerAccountId?: string;
  customerToken?: string;
  customerName?: string;
  customerNote?: string;
  gameCharges?: CustomerGameCharge[];
  cafeCharges?: CustomerCafeCharge[];
  tableChargeLines?: import("@/types/session").TableChargeLine[];
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
