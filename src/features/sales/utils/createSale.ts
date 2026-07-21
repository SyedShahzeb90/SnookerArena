import { calculateBill } from "@/features/pricing/utils/calculateBill";
import { calculateGamePrice, getStoredSessionGameAmount } from "@/features/pricing/utils/calculateGamePrice";
import { calculateDuration } from "@/features/pricing/utils/calculateDuration";
import type {
  CafeOrderItem,
  PaymentMethod,
} from "@/types/session";
import type { Table } from "@/types/table";
import { getSessionPlayers } from "@/features/sessions/utils/sessionPlayers";
import { calculateDoubleGamePayerBreakdown } from "@/features/sessions/utils/doubleGameBilling";
import {
  findPayerBreakdownForPlayer,
  getPlayerCafeItems,
} from "@/features/billing/utils/playerBillIdentity";

import type { Sale } from "../types/sale";
import type { PaymentSplit } from "../types/sale";

interface CreateSaleInput {
  table: Table;
  paymentMethod: PaymentMethod;
  paymentSplits?: PaymentSplit[];
  invoiceNumber: string;
  playerBill?: {
    playerName: string;
    tableAmount: number;
    cafeAmount: number;
    cafeItems: CafeOrderItem[];
    discount?: number;
  };
}

export function createSaleFromTable({
  table,
  paymentMethod,
  paymentSplits,
  invoiceNumber,
  playerBill,
}: CreateSaleInput): Sale | null {
  if (!table.session || !table.session.endTime) {
    return null;
  }

  const session = table.session;
  const endTime = session.endTime as Date;

  const startedAt = new Date(
    session.startTime
  );
  const endedAt = new Date(
    endTime
  );

  const pricing = calculateGamePrice({
    sessionType:
      session.sessionType,
    tableType: table.type,
    startTime: startedAt,
    endTime: endedAt,
  });

  const duration = calculateDuration(
    startedAt,
    endedAt
  );

  const bill = calculateBill({
    gameAmount: getStoredSessionGameAmount(session, table.type, endedAt),
    cafeAmount: session.cafeAmount,
    discount: session.discount,
  });
  const players = getSessionPlayers(session);

  const payerBreakdown =
    calculateDoubleGamePayerBreakdown({
      session,
      tableAmount: session.settledTableAmount ?? pricing.gameAmount,
    });

  const playerBreakdown = players.map(
    (playerName) => {
      const cafeItems =
        getPlayerCafeItems(
          session,
          playerName
        );
      const cafeAmount =
        cafeItems.reduce(
          (total, item) =>
            total + item.subtotal,
          0
        );
      const tableAmountShare =
        findPayerBreakdownForPlayer(
          payerBreakdown,
          playerName
        )?.tableAmountShare ?? 0;

      return {
        playerName,
        tableAmountShare,
        cafeAmount,
        totalAmount:
          tableAmountShare +
          cafeAmount,
        cafeItems,
      };
    }
  );

  const salePlayers = playerBill
    ? [{ name: playerBill.playerName }]
    : [
        ...players.map((name) => ({
          name,
        })),
      ];
  const saleTableAmount =
    playerBill?.tableAmount ??
    session.settledTableAmount ?? pricing.gameAmount;
  const saleCafeAmount =
    playerBill?.cafeAmount ??
    session.cafeAmount;
  const saleSubtotal =
    saleTableAmount + saleCafeAmount;
  const saleDiscount = playerBill
    ? Math.min(
        playerBill.discount ?? 0,
        saleTableAmount
      )
    : Math.min(
        session.discount,
        saleTableAmount
      );
  const saleGrandTotal =
    saleSubtotal - saleDiscount;
  const saleItems =
    playerBill?.cafeItems ??
    session.cafeOrders;

  return {
    id: `SALE-${invoiceNumber}-${table.id}`,
    invoiceNumber,
    tableId: table.id,
    tableName: table.name,
    sessionId: session.id,
    players: salePlayers,
    sessionType: session.sessionType,
    winnerName: session.winnerName,
    loserName: session.loserName,
    payerName: session.payerName,
    teamAPlayers: session.teamAPlayers,
    teamBPlayers: session.teamBPlayers,
    teamAOneNameEnough:
      session.teamAOneNameEnough,
    teamBOneNameEnough:
      session.teamBOneNameEnough,
    extraPlayers: session.extraPlayers,
    winningTeam: session.winningTeam,
    losingTeam: session.losingTeam,
    payerBreakdown,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    durationMinutes:
      duration.totalMinutes,
    createdAt: new Date().toISOString(),
    tableAmount: saleTableAmount,
    cafeAmount: saleCafeAmount,
    subtotal: playerBill
      ? saleSubtotal
      : bill.subtotal,
    discount: saleDiscount,
    grandTotal: playerBill
      ? saleGrandTotal
      : bill.total,
    originalTableAmount: session.originalTableAmount,
    originalGameCount: session.originalGameCount,
    paymentMethod,
    paymentSplits,
    paymentStatus: "paid",
    orderedItems: saleItems,
    playerBreakdown: playerBill
      ? [
          {
            playerName:
              playerBill.playerName,
            tableAmountShare:
              playerBill.tableAmount,
            cafeAmount:
              playerBill.cafeAmount,
            totalAmount:
              saleGrandTotal,
            cafeItems:
              playerBill.cafeItems,
          },
        ]
      : playerBreakdown,
  };
}
