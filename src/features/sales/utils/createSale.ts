import { calculateBill } from "@/features/pricing/utils/calculateBill";
import { calculateGamePrice } from "@/features/pricing/utils/calculateGamePrice";
import { calculateDuration } from "@/features/pricing/utils/calculateDuration";
import type { PaymentMethod } from "@/types/session";
import type { Table } from "@/types/table";

import type { Sale } from "../types/sale";

interface CreateSaleInput {
  table: Table;
  paymentMethod: PaymentMethod;
  invoiceNumber: string;
}

export function createSaleFromTable({
  table,
  paymentMethod,
  invoiceNumber,
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
    gameAmount: pricing.gameAmount,
    cafeAmount: session.cafeAmount,
    discount: session.discount,
  });
  const players = [
    session.player1,
    session.player2,
  ].filter(Boolean) as string[];

  const itemPlayerName = (
    item: (typeof session.cafeOrders)[number]
  ) =>
    item.playerName ??
    item.customerName ??
    "";

  const playerBreakdown = players.map(
    (playerName) => {
      const cafeItems =
        session.cafeOrders.filter(
          (item) =>
            itemPlayerName(item) ===
            playerName
        );
      const cafeAmount =
        cafeItems.reduce(
          (total, item) =>
            total + item.subtotal,
          0
        );
      const tableAmountShare =
        session.payerName ===
        playerName
          ? pricing.gameAmount
          : 0;

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

  return {
    id: `SALE-${Date.now()}-${table.id}`,
    invoiceNumber,
    tableId: table.id,
    tableName: table.name,
    sessionId: session.id,
    players: [
      { name: session.player1 },
      ...(session.player2
        ? [
            {
              name: session.player2,
            },
          ]
        : []),
    ],
    sessionType: session.sessionType,
    winnerName: session.winnerName,
    loserName: session.loserName,
    payerName: session.payerName,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    durationMinutes:
      duration.totalMinutes,
    createdAt: new Date().toISOString(),
    tableAmount: pricing.gameAmount,
    cafeAmount: session.cafeAmount,
    subtotal: bill.subtotal,
    discount: session.discount,
    grandTotal: bill.total,
    paymentMethod,
    paymentStatus: "paid",
    orderedItems:
      session.cafeOrders,
    playerBreakdown,
  };
}
