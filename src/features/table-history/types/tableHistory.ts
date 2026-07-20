import type {
  CafeOrderItem,
  SessionType,
  TableChargeLine,
} from "@/types/session";
import type { Table } from "@/types/table";

export type TableHistoryPaymentStatus =
  | "pending"
  | "paid"
  | "cancelled";

export interface TableHistoryPlayerBreakdown {
  playerName: string;
  customerId?: string;
  tableAmountShare: number;
  cafeAmount: number;
  totalAmount: number;
  cafeItems: CafeOrderItem[];
}

export interface TableHistoryCafeItem
  extends CafeOrderItem {
  itemId: string;
}

export interface TableHistoryRecord {
  id: string;
  tableId: number;
  tableName: string;
  tableType: Table["type"];
  sessionId: string;
  billNo?: string;
  displayToken?: string;
  customerToken?: string;
  invoiceNumber?: string;
  staffBillNumber?: string;
  players: string[];
  player1Name: string;
  player1CustomerId?: string;
  player2Name?: string;
  player2CustomerId?: string;
  player3Name?: string;
  player3CustomerId?: string;
  player4Name?: string;
  player4CustomerId?: string;
  sessionType: SessionType;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
  winnerName?: string;
  winnerCustomerId?: string;
  loserName?: string;
  loserCustomerId?: string;
  payerName?: string;
  payerCustomerId?: string;
  teamAPlayers?: string[];
  teamBPlayers?: string[];
  teamAOneNameEnough?: boolean;
  teamBOneNameEnough?: boolean;
  extraPlayers?: string[];
  winningTeam?: "A" | "B";
  losingTeam?: "A" | "B";
  payerBreakdown?: {
    playerName: string;
    customerId?: string;
    tableAmountShare: number;
    note?: string;
  }[];
  tableChargeLines?: TableChargeLine[];
  tableAmount: number;
  cafeAmount: number;
  discount: number;
  grandTotal: number;
  originalGameCount?: number;
  originalTableAmount?: number;
  advanceGamesEarned?: number;
  advanceGamesApplied?: number;
  advanceReduction?: number;
  tableAmountAfterAdvance?: number;
  settlementLabel?: string;
  paymentStatus: TableHistoryPaymentStatus;
  pendingBillId?: string;
  saleId?: string;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
  cancelledAt?: string;
  cancelledReason?: string;
  cancelledNote?: string;
  cafeItems: TableHistoryCafeItem[];
  playerBreakdown: TableHistoryPlayerBreakdown[];
}
