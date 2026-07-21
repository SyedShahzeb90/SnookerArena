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

export type TableChargeLineType =
  | "singleGame"
  | "doubleGame"
  | "tableBooking";

export interface TableChargeLine {
  id: string;
  sessionId: string;
  type: TableChargeLineType;
  label: string;
  startedAt: string;
  endedAt?: string;
  durationMinutes?: number;
  amount: number;
  unitRate?: number;
  payerName?: string;
  payerCustomerId?: string;
  loserName?: string;
  winnerName?: string;
  winningTeam?: "A" | "B";
  losingTeam?: "A" | "B";
  isFinal?: boolean;
  finalGames?: number;
  settlementProcessedAt?: string;
  settlement?: FrameSettlementEffect[];
  notes?: string;
}

export interface FrameSettlementEffect {
  customerId: string;
  customerName: string;
  payableGamesDelta: number;
  advanceGamesDelta: number;
  role: "loser" | "winner";
}

export interface CafeOrderItem {
  lineId?: string;

  menuItemId: string;

  name: string;

  price: number;

  quantity: number;

  subtotal: number;

  timeAdded: Date;

  tableId?: number;

  sessionId?: string;

  customerName?: string;

  playerName?: string;

  playerId?: string;

  orderedAt?: string;
}

export interface Session {
  id: string;

  tableId: number;

  sessionType: SessionType;

  tableChargeLines?: TableChargeLine[];

  frameTimerStartedAt?: string;

  frameTimerPausedMilliseconds?: number;

  player1: string;
  player1CustomerId?: string;

  player2?: string;
  player2CustomerId?: string;

  player3?: string;
  player3CustomerId?: string;

  player4?: string;
  player4CustomerId?: string;

  extraPlayers?: string[];

  teamAPlayers?: string[];

  teamBPlayers?: string[];

  teamAOneNameEnough?: boolean;

  teamBOneNameEnough?: boolean;

  teamABillOwnerCustomerId?: string;
  teamABillOwnerName?: string;
  teamBBillOwnerCustomerId?: string;
  teamBBillOwnerName?: string;

  settlementProcessedAt?: string;
  settlementId?: string;
  originalGameCount?: number;
  originalTableAmount?: number;
  settledTableAmount?: number;
  advanceGamesEarned?: number;

  winningTeam?: "A" | "B";

  losingTeam?: "A" | "B";

  payerBreakdown?: {
    playerName: string;
    tableAmountShare: number;
    note?: string;
  }[];

  startTime: Date;

  endTime?: Date;

  pausedAt?: Date;

  totalPausedMilliseconds: number;

  cafeAmount: number;

  cafeOrders: CafeOrderItem[];

  discount: number;

  winnerName?: string;

  loserName?: string;

  payerName?: string;
  payerCustomerId?: string;

  paymentMethod?: PaymentMethod;

  isPaid: boolean;
}
