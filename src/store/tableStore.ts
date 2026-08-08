import { create } from "zustand";
import { persist } from "zustand/middleware";

import { initialTables } from "@/data/initialTables";
import { useCheckoutStore } from "@/features/billing/store/checkoutStore";
import { useCafeStore } from "@/features/cafe/store/cafeStore";
import { useBusinessDayStore } from "@/features/business-day/store/businessDayStore";
import { calculateBill } from "@/features/pricing/utils/calculateBill";
import { calculateGamePrice } from "@/features/pricing/utils/calculateGamePrice";
import { useCustomerAccountStore } from "@/features/customers/store/customerAccountStore";
import { useSalesStore } from "@/features/sales/store/salesStore";
import { createSaleFromTable } from "@/features/sales/utils/createSale";
import {
  getSessionParticipantKey,
  getSessionPlayerEntries,
  getSessionPlayers,
} from "@/features/sessions/utils/sessionPlayers";
import {
  calculateDoubleGamePayerBreakdown,
  calculateTableChargeLinePayerBreakdown,
  getTeamPlayers,
} from "@/features/sessions/utils/doubleGameBilling";
import {
  findPayerBreakdownForPlayer,
  getPlayerCafeItems,
} from "@/features/billing/utils/playerBillIdentity";
import { normalizePlayerName } from "@/features/cafe/utils/playerIdentity";
import { useTableHistoryStore } from "@/features/table-history/store/tableHistoryStore";
import { useAdvanceGamesStore } from "@/features/advance-games/store/advanceGamesStore";
import { calculateFinalSettlement } from "@/features/advance-games/utils/finalSettlement";
import { useClubSettingsStore } from "@/features/settings/store/clubSettingsStore";

import type {
  CafeOrderItem,
  FrameSettlementEffect,
  PaymentMethod,
  Session,
  SessionType,
  TableChargeLine,
  TableChargeLineType,
} from "@/types/session";

import type { Table } from "@/types/table";

function compactNames(
  names: Array<string | undefined>
) {
  return names
    .map((name) => name?.trim())
    .filter(Boolean) as string[];
}

function isWalkInName(name?: string) {
  return /^walk-in customer(?: \(\d+\))?$/i.test(
    name?.trim() || ""
  );
}

function getWalkInBaseLabel(index: number) {
  return index === 0
    ? "Walk-in Customer"
    : `Walk-in Customer (${index})`;
}

function getActiveWalkInLabels(
  tables: Table[],
  excludedTableId?: number
) {
  return tables
    .filter(
      (table) =>
        table.id !== excludedTableId &&
        table.session &&
        (table.status === "running" ||
          table.status === "paused" ||
          table.status ===
            "payment-pending")
    )
    .flatMap((table) =>
      getSessionPlayers(table.session!)
    )
    .filter(isWalkInName);
}

function getNextWalkInLabel(
  tables: Table[],
  excludedTableId?: number
) {
  const activeLabels = new Set(
    getActiveWalkInLabels(
      tables,
      excludedTableId
    ).map((name) => name.toLowerCase())
  );

  let index = 0;
  while (
    activeLabels.has(
      getWalkInBaseLabel(index).toLowerCase()
    )
  ) {
    index += 1;
  }

  return getWalkInBaseLabel(index);
}

function normalizeWalkInPlayerName(
  name: string,
  tables: Table[],
  tableId: number
) {
  return !name.trim() || isWalkInName(name)
    ? getNextWalkInLabel(tables, tableId)
    : name.trim();
}

function getSessionCustomerIdForPlayer(
  session: Session,
  playerName?: string
) {
  const targetName = normalizePlayerName(playerName);
  if (!targetName) return undefined;

  const players = getSessionPlayerEntries(session);
  const match = players.find(
    (player) =>
      normalizePlayerName(player.name) === targetName
  );

  return match?.customerId;
}

function isTableAttachedCafeItem(
  item: CafeOrderItem,
  session: Session,
  table: Table
) {
  const tableBookingKey = getSessionParticipantKey(
    session.id,
    "table-booking"
  );
  const attachedNames = [
    `${table.name} Booking`,
    `Table ${table.id} Booking`,
    "Table Booking",
  ].map(normalizePlayerName);
  const itemNames = [
    item.playerName,
    item.customerName,
  ]
    .filter(Boolean)
    .map((name) => normalizePlayerName(name!));

  return (
    item.participantKey === tableBookingKey ||
    itemNames.some((name) => attachedNames.includes(name))
  );
}

function addTableBillCafeChargesToCustomer(
  table: Table,
  session: Session
) {
  const tableBillItems = session.cafeOrders.filter(
    (item) => item.tableBill
  );

  if (tableBillItems.length === 0) return;

  const ownedTableBillItems = tableBillItems.filter(
    (item) => item.playerName || item.customerName || item.playerId
  );
  if (
    session.sessionType === "century" &&
    ownedTableBillItems.length > 0
  ) {
    const customerStore =
      useCustomerAccountStore.getState();
    const ownerGroups = new Map<string, CafeOrderItem[]>();

    ownedTableBillItems.forEach((item) => {
      const ownerName =
        item.playerName ?? item.customerName;
      const ownerKey =
        item.playerId ??
        (ownerName
          ? `name:${normalizePlayerName(ownerName)}`
          : undefined);

      if (!ownerKey || !ownerName) return;

      ownerGroups.set(ownerKey, [
        ...(ownerGroups.get(ownerKey) ?? []),
        item,
      ]);
    });

    ownerGroups.forEach((items, ownerKey) => {
      const ownerName =
        items[0]?.playerName ?? items[0]?.customerName;
      if (!ownerName) return;

      const existingSessionBill =
        customerStore.accounts.find(
          (account) =>
            account.status === "active" &&
            account.paymentStatus === "unpaid" &&
            account.gameCharges.some(
              (charge) =>
                charge.sessionId === session.id &&
                normalizePlayerName(
                  charge.payerName
                ) === normalizePlayerName(ownerName)
            )
        );
      const customerId =
        existingSessionBill?.id ??
        items[0]?.playerId ??
        getSessionCustomerIdForPlayer(session, ownerName) ??
        customerStore.getOrCreateActiveCustomerByIdOrName({
              customerName: ownerName,
            }).id;

      customerStore.replaceCafeChargesForOrder({
        customerId,
        customerName: ownerName,
        sourceOrderId: `TABLE-BILL-CAFE-${session.id}-${ownerKey}`,
        charges: items.map((item) => ({
          itemId: item.menuItemId,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          subtotal: item.subtotal,
          tableId: table.id,
          tableName: table.name,
          sessionId: session.id,
          orderedAt:
            item.orderedAt ?? new Date().toISOString(),
        })),
      });
    });
    return;
  }

  const payerName =
    session.payerName ??
    session.loserName ??
    tableBillItems[0]?.playerName ??
    tableBillItems[0]?.customerName;
  if (!payerName) return;

  const customerStore =
    useCustomerAccountStore.getState();
  const existingSessionBill =
    customerStore.accounts.find(
      (account) =>
        account.status === "active" &&
        account.paymentStatus === "unpaid" &&
        account.gameCharges.some(
          (charge) =>
            charge.sessionId === session.id &&
            normalizePlayerName(charge.payerName) ===
              normalizePlayerName(payerName)
        )
    );
  const customerId =
    existingSessionBill?.id ??
    session.payerCustomerId ??
    getSessionCustomerIdForPlayer(session, payerName) ??
    customerStore.getOrCreateActiveCustomerByIdOrName({
      customerName: payerName,
    }).id;

  customerStore.replaceCafeChargesForOrder({
    customerId,
    customerName: payerName,
    sourceOrderId: `TABLE-BILL-CAFE-${session.id}`,
    charges: tableBillItems.map((item) => ({
      itemId: item.menuItemId,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      subtotal: item.subtotal,
      tableId: table.id,
      tableName: table.name,
      sessionId: session.id,
      orderedAt:
        item.orderedAt ?? new Date().toISOString(),
    })),
  });
}

function buildPlayerBreakdown(
  session: Session,
  tableAmount: number,
  tableChargeLines: TableChargeLine[] = []
) {
  const players = getSessionPlayerEntries(session);
  return players.map(({ name: playerName, customerId, slot }) => {
    const cafeItems =
      getPlayerCafeItems(
        session,
        {
          playerName,
          customerId,
          participantKey: getSessionParticipantKey(
            session.id,
            slot
          ),
        }
      );
    const cafeAmount =
      cafeItems.reduce(
        (total, item) =>
          total + item.subtotal,
        0
      );
    const linePayerBreakdown = tableChargeLines.length
      ? tableChargeLines.flatMap((line) =>
          calculateTableChargeLinePayerBreakdown({
            session,
            line,
          })
        )
      : [];
    const tableAmountShare = tableChargeLines.length
      ? linePayerBreakdown
          .filter(
            (payer) =>
              normalizePlayerName(
                payer.playerName
              ) ===
              normalizePlayerName(playerName)
          )
          .reduce(
            (total, payer) =>
              total + payer.tableAmountShare,
            0
          )
      : findPayerBreakdownForPlayer(
          calculateDoubleGamePayerBreakdown({
            session,
            tableAmount,
          }),
          playerName
        )?.tableAmountShare ?? 0;

    return {
      playerName,
      customerId,
      tableAmountShare,
      cafeAmount,
      totalAmount:
        tableAmountShare + cafeAmount,
      cafeItems,
    };
  });
}

function getChargeLineAmount({
  type,
  tableType,
  startedAt,
  endedAt,
  unitRate,
}: {
  type: TableChargeLineType;
  tableType: Table["type"];
  startedAt: Date;
  endedAt: Date;
  unitRate?: number;
}) {
  const settings = useClubSettingsStore.getState().settings;
  if (type === "singleGame") return unitRate ?? settings.singleGameRate;
  if (type === "doubleGame") return unitRate ?? settings.doubleGameRate;

  const rate =
    unitRate ??
    (tableType === "private-room"
      ? 25
      : settings.tableBookingRatePerMinute);
  const minutes = Math.max(
    1,
    Math.ceil(
      (endedAt.getTime() - startedAt.getTime()) /
        60000
    )
  );

  return minutes * rate;
}

function getChargeLineLabel(
  type: TableChargeLineType,
  tableType: Table["type"]
) {
  if (type === "singleGame") return "Single Game";
  if (type === "doubleGame") return "Double Game";
  return tableType === "private-room"
    ? "Private Room"
    : "Table Booking";
}

function sessionTypeToChargeLineType(
  sessionType: SessionType
): TableChargeLineType {
  if (sessionType === "double") return "doubleGame";
  if (
    sessionType === "time" ||
    sessionType === "private" ||
    sessionType === "century"
  ) {
    return "tableBooking";
  }

  return "singleGame";
}

function createInitialChargeLine(
  sessionId: string,
  sessionType: SessionType,
  tableType: Table["type"],
  startedAt: Date,
  final?: { isFinal?: boolean; finalGames?: number }
): TableChargeLine {
  const type =
    sessionTypeToChargeLineType(sessionType);
  const settings = useClubSettingsStore.getState().settings;
  const unitRate =
    type === "singleGame"
      ? settings.singleGameRate
      : type === "doubleGame"
        ? settings.doubleGameRate
        : tableType === "private-room"
          ? 25
          : settings.tableBookingRatePerMinute;

  return {
    id: `TCL-${sessionId}-${Date.now()}`,
    sessionId,
    type,
    label: getChargeLineLabel(type, tableType),
    startedAt: startedAt.toISOString(),
    endedAt: undefined,
    durationMinutes: undefined,
    amount:
      type === "tableBooking"
        ? 0
        : unitRate,
    unitRate,
    isFinal: Boolean(final?.isFinal),
    finalGames: final?.isFinal ? final.finalGames : undefined,
  };
}

function finalizeChargeLine(
  line: TableChargeLine,
  tableType: Table["type"],
  endedAt: Date
): TableChargeLine {
  const startedAt = new Date(line.startedAt);
  const storedEndedAt = line.endedAt
    ? new Date(line.endedAt)
    : undefined;

  if (
    storedEndedAt &&
    storedEndedAt.getTime() > startedAt.getTime()
  ) {
    return line;
  }

  const durationMinutes = Math.max(
    0,
    Math.ceil(
      (endedAt.getTime() - startedAt.getTime()) /
        60000
    )
  );

  return {
    ...line,
    endedAt: endedAt.toISOString(),
    durationMinutes,
    amount:
      line.type === "tableBooking"
        ? getChargeLineAmount({
            type: line.type,
            tableType,
            startedAt,
            endedAt,
            unitRate: line.unitRate,
          })
        : line.amount,
  };
}

function getSettlementOwnerAmount(
  owner: ReturnType<typeof calculateFinalSettlement>["owners"][number],
  lines: TableChargeLine[]
) {
  return Math.max(
    0,
    lines.reduce((total, line) => {
      const rate =
        line.type === "doubleGame"
          ? (line.unitRate ?? line.amount) / 2
          : line.unitRate ?? line.amount;
      const effect = line.settlement?.find(
        (item) => settlementEffectMatchesOwner(item, owner)
      );
      return total + (effect?.payableGamesDelta ?? 0) * rate;
    }, 0)
  );
}

function settlementEffectMatchesOwner(
  effect: FrameSettlementEffect,
  owner: ReturnType<typeof calculateFinalSettlement>["owners"][number]
) {
  if (owner.customerId) {
    return effect.customerId === owner.customerId;
  }

  if (owner.participantKey) {
    return (
      effect.participantKey === owner.participantKey ||
      effect.customerId === owner.participantKey
    );
  }

  return (
    effect.customerId === owner.key ||
    normalizePlayerName(effect.customerName) ===
      normalizePlayerName(owner.customerName)
  );
}

function getFinalTableChargeLines(
  table: Table,
  session: Session,
  endedAt: Date
) {
  const existingLines =
    session.tableChargeLines ?? [];

  if (existingLines.length > 0) {
    return existingLines.map((line, index) => {
      const nextLine = existingLines[index + 1];
      const lineEndedAt = nextLine
        ? new Date(nextLine.startedAt)
        : endedAt;

      return finalizeChargeLine(line, table.type, lineEndedAt);
    });
  }

  return [
    finalizeChargeLine(
      createInitialChargeLine(
        session.id,
        session.sessionType,
        table.type,
        new Date(session.startTime)
      ),
      table.type,
      endedAt
    ),
  ];
}

function createTableHistoryRecord(
  table: Table,
  session: Session,
  staffBillNumber?: string,
  options: {
    paymentStatus?: "pending" | "paid" | "cancelled";
    pendingBillId?: string;
    cancelledAt?: string;
    cancelledReason?: string;
    cancelledNote?: string;
  } = {}
) {
  if (!session.endTime) return;

  const startedAt = new Date(
    session.startTime
  );
  const endedAt = new Date(
    session.endTime
  );
  const pricing = calculateGamePrice({
    sessionType: session.sessionType,
    tableType: table.type,
    startTime: startedAt,
    endTime: endedAt,
  });
  const tableChargeLines =
    getFinalTableChargeLines(
      table,
      session,
      endedAt
    );
  const tableAmount =
    tableChargeLines.reduce(
      (total, line) => total + line.amount,
      0
    );
  const gameSettlement =
    table.id >= 1 && table.id <= 7 &&
    (session.sessionType === "single" || session.sessionType === "double")
      ? calculateFinalSettlement(session, tableChargeLines)
      : undefined;
  const settledTableAmount = gameSettlement
    ? gameSettlement.owners.reduce(
        (total, owner) =>
          total + getSettlementOwnerAmount(owner, gameSettlement.lines),
        0
      )
    : tableAmount;
  const bill = calculateBill({
    gameAmount: settledTableAmount,
    cafeAmount: session.cafeAmount,
    discount: session.discount,
  });
  const players = getSessionPlayers(session);
  const getPlayerCustomerId = (name?: string) => {
    if (!name) return undefined;

    const slots = [
      {
        name: session.player1,
        customerId: session.player1CustomerId,
      },
      {
        name: session.player2,
        customerId: session.player2CustomerId,
      },
      {
        name: session.player3,
        customerId: session.player3CustomerId,
      },
      {
        name: session.player4,
        customerId: session.player4CustomerId,
      },
    ];

    return slots.find(
      (slot) =>
        slot.name === name ||
        slot.customerId === name
    )?.customerId;
  };
  const now = new Date().toISOString();
  const paymentStatus =
    options.paymentStatus ?? "pending";

  useTableHistoryStore
    .getState()
    .addTableHistoryRecord({
      id: `HIST-${session.id}`,
      tableId: table.id,
      tableName: table.name,
      tableType: table.type,
      sessionId: session.id,
      billNo: staffBillNumber,
      displayToken: staffBillNumber,
      staffBillNumber,
      players,
      player1Name:
        session.player1 ||
        "Walk-in Customer",
      player1CustomerId:
        session.player1CustomerId,
      player2Name: session.player2,
      player2CustomerId:
        session.player2CustomerId,
      player3Name: session.player3,
      player3CustomerId:
        session.player3CustomerId,
      player4Name: session.player4,
      player4CustomerId:
        session.player4CustomerId,
      sessionType: session.sessionType,
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      durationMinutes:
        pricing.duration.totalMinutes,
      winnerName: session.winnerName,
      winnerCustomerId:
        getPlayerCustomerId(session.winnerName),
      loserName: session.loserName,
      loserCustomerId:
        getPlayerCustomerId(session.loserName),
      payerName: session.payerName,
      payerCustomerId:
        session.payerCustomerId ??
        getPlayerCustomerId(session.payerName),
      teamAPlayers: session.teamAPlayers,
      teamBPlayers: session.teamBPlayers,
      teamAOneNameEnough:
        session.teamAOneNameEnough,
      teamBOneNameEnough:
        session.teamBOneNameEnough,
      extraPlayers: session.extraPlayers,
      winningTeam: session.winningTeam,
      losingTeam: session.losingTeam,
      payerBreakdown:
        tableChargeLines.map((line) => ({
          playerName:
            line.payerName ??
            line.loserName ??
            session.payerName ??
            session.player1,
          customerId:
            line.payerCustomerId ??
            session.payerCustomerId,
          tableAmountShare: line.amount,
          note: line.label,
        })),
      tableChargeLines,
      tableAmount: settledTableAmount,
      originalGameCount: gameSettlement?.originalGameCount,
      originalTableAmount: gameSettlement?.originalTableAmount,
      advanceGamesEarned: gameSettlement?.owners.reduce((total, owner) => total + owner.advanceGames, 0),
      tableAmountAfterAdvance: settledTableAmount,
      cafeAmount: session.cafeAmount,
      discount: session.discount,
      grandTotal: bill.total,
      paymentStatus,
      pendingBillId:
        paymentStatus === "pending"
          ? options.pendingBillId ?? `BILL-${session.id}`
          : options.pendingBillId,
      cancelledAt: options.cancelledAt,
      cancelledReason: options.cancelledReason,
      cancelledNote: options.cancelledNote,
      createdAt: now,
      updatedAt: now,
      cafeItems: session.cafeOrders.map(
        (item) => ({
          ...item,
          itemId: item.menuItemId,
        })
      ),
      playerBreakdown: buildPlayerBreakdown(
        session,
        settledTableAmount,
        tableChargeLines
      ),
    });
}

export function addSessionGameChargesToCustomers(
  table: Table,
  session: Session
) {
  if (!session.endTime) return;

  const startedAt = new Date(
    session.startTime
  );
  const endedAt = new Date(
    session.endTime
  );
  const pricing = calculateGamePrice({
    sessionType: session.sessionType,
    tableType: table.type,
    startTime: startedAt,
    endTime: endedAt,
  });
  const tableChargeLines =
    getFinalTableChargeLines(
      table,
      session,
      endedAt
    );
  const usesGameSettlement =
    table.id >= 1 &&
    table.id <= 7 &&
    table.type === "table" &&
    (session.sessionType === "single" || session.sessionType === "double");

  if (usesGameSettlement) {
    const settlement = calculateFinalSettlement(session, tableChargeLines);
    const customerStore = useCustomerAccountStore.getState();
    const resolvedCustomerIds = new Map<string, string>();

    settlement.owners.forEach((owner) => {
      let customerId = owner.customerId;
      if (!customerId) {
        customerId = customerStore.getOrCreateActiveCustomerByIdOrName({
          customerName: owner.customerName,
        }).id;
      }
      if (customerId) {
        resolvedCustomerIds.set(owner.key, customerId);
        resolvedCustomerIds.set(owner.customerId ?? owner.key, customerId);
        if (owner.participantKey) {
          resolvedCustomerIds.set(owner.participantKey, customerId);
        }
      }

      if (owner.payableGames > 0) {
        const ownerAmount = getSettlementOwnerAmount(owner, settlement.lines);
        const ownerLineCharges = settlement.lines.flatMap((line) => {
          const effect = line.settlement?.find(
            (item) => settlementEffectMatchesOwner(item, owner)
          );
          if (!effect) return [];
          const rate = line.type === "doubleGame"
            ? (line.unitRate ?? line.amount) / 2
            : line.unitRate ?? line.amount;
          return [{
            id: line.id,
            sessionId: session.id,
            sessionType: line.type === "doubleGame" ? "double" as const : "single" as const,
            startedAt: line.startedAt,
            endedAt: line.endedAt,
            durationMinutes: line.durationMinutes,
            amount: effect.payableGamesDelta * rate,
            winnerName: line.winnerName,
            loserName: line.loserName,
            payerName: line.payerName ?? owner.customerName,
            payerCustomerId: line.payerCustomerId ?? customerId,
            winningTeam: line.winningTeam,
            losingTeam: line.losingTeam,
            isFinal: line.isFinal,
            finalGames: line.finalGames,
          }];
        });
        customerStore.addGameChargeToCustomer({
          customerName: owner.customerName,
          customerId,
          sessionId: session.id,
          tableId: table.id,
          tableName: table.name,
          tableType: table.type,
          sessionType: session.sessionType,
          startedAt: startedAt.toISOString(),
          endedAt: endedAt.toISOString(),
          durationMinutes: pricing.duration.totalMinutes,
          winnerName: session.winnerName,
          loserName: session.loserName,
          winningTeam: session.winningTeam,
          losingTeam: session.losingTeam,
          payerName: owner.customerName,
          amount: ownerAmount,
          shareType: settlement.owners.filter((item) => item.payableGames > 0).length > 1 ? "split" : "full",
          gameCount: owner.payableGames,
          originalAmount: ownerAmount,
          sourceFrameIds: owner.sourceFrameIds,
          lineCharges: ownerLineCharges,
        });
      }

    });

    const remainingAdvanceAwards = new Map(
      settlement.owners.map((owner) => [
        owner.customerId || owner.key,
        owner.advanceGames,
      ])
    );

    settlement.lines.forEach((line) => {
      (line.settlement ?? []).forEach((effect, index) => {
        if (effect.advanceGamesDelta === 0 || isWalkInName(effect.customerName)) return;
        const customerId =
          resolvedCustomerIds.get(effect.customerId) ??
          (effect.participantKey
            ? resolvedCustomerIds.get(effect.participantKey)
            : undefined);
        if (!customerId) return;
        const remainingAdvance =
          remainingAdvanceAwards.get(effect.customerId) ?? 0;
        const games =
          effect.advanceGamesDelta > 0
            ? Math.min(effect.advanceGamesDelta, remainingAdvance)
            : Math.abs(effect.advanceGamesDelta);
        if (games === 0) return;
        const input = {
          transactionId: `ADV-${effect.advanceGamesDelta > 0 ? "EARN" : "OFFSET"}-${session.id}-${line.id}-${index}`,
          customerId,
          customerName: effect.customerName,
          games,
          tableId: table.id,
          tableName: table.name,
          sessionId: session.id,
          frameId: line.id,
          finalGames: line.finalGames ?? 0,
          opponent: effect.role === "winner" ? line.loserName : line.winnerName,
        };
        if (effect.advanceGamesDelta > 0) {
          remainingAdvanceAwards.set(
            effect.customerId,
            Math.max(0, remainingAdvance - games)
          );
          useAdvanceGamesStore.getState().stageEarn({
            ...input,
            billId: `ADVANCE-SESSION:${session.id}`,
          });
        } else {
          useAdvanceGamesStore.getState().recordSessionOffset(input);
        }
      });
    });

    addTableBillCafeChargesToCustomer(table, session);
    return;
  }
  const payerBreakdown: Array<{
    line?: TableChargeLine;
    playerName: string;
    tableAmountShare: number;
    note?: string;
  }> =
    tableChargeLines.length > 0
      ? tableChargeLines.flatMap((line) =>
          calculateTableChargeLinePayerBreakdown({
            session,
            line,
          })
        )
      : calculateDoubleGamePayerBreakdown({
          session,
          tableAmount: pricing.gameAmount,
        });
  const customerStore =
    useCustomerAccountStore.getState();
  let sessionWalkInCustomerId:
    | string
    | undefined;
  const getCustomerIdForPayer = (
    playerName: string
  ) => {
    const payerKey = normalizePlayerName(playerName);
    const existingId =
      payerKey === normalizePlayerName(session.player1)
        ? session.player1CustomerId
        : payerKey === normalizePlayerName(session.player2)
          ? session.player2CustomerId
          : payerKey === normalizePlayerName(session.player3)
            ? session.player3CustomerId
            : payerKey === normalizePlayerName(session.player4)
              ? session.player4CustomerId
              : undefined;

    if (existingId) return existingId;

    if (!isWalkInName(playerName)) {
      return undefined;
    }

    if (sessionWalkInCustomerId) {
      return sessionWalkInCustomerId;
    }

    const account =
      customerStore.createCustomerAccount({
        customerName: playerName,
      });
    sessionWalkInCustomerId = account.id;

    return account.id;
  };

  payerBreakdown
    .filter((payer) => payer.tableAmountShare > 0)
    .forEach((payer) => {
      const teamPlayers =
        session.losingTeam
          ? getTeamPlayers(
              session,
              session.losingTeam
            )
          : undefined;

      customerStore.addGameChargeToCustomer({
        customerName: payer.playerName,
        customerId:
          (isWalkInName(payer.playerName)
            ? getCustomerIdForPayer(payer.playerName)
            : payer.line?.payerCustomerId ??
              getCustomerIdForPayer(payer.playerName)),
        sessionId: session.id,
        tableId: table.id,
        tableName: table.name,
        tableType: table.type,
        sessionType: payer.line
          ? payer.line.type === "doubleGame"
            ? "double"
            : payer.line.type === "tableBooking"
              ? session.sessionType === "century"
                ? "century"
                : table.type === "private-room"
                  ? "private"
                  : "time"
              : "single"
          : session.sessionType,
        startedAt:
          payer.line?.startedAt ??
          startedAt.toISOString(),
        endedAt:
          payer.line?.endedAt ??
          endedAt.toISOString(),
        durationMinutes:
          payer.line?.durationMinutes ??
          pricing.duration.totalMinutes,
        winnerName: session.winnerName,
        loserName:
          payer.line?.loserName ??
          session.loserName,
        winningTeam: session.winningTeam,
        losingTeam: session.losingTeam,
        payerName: payer.playerName,
        amount: payer.tableAmountShare,
        shareType:
          payerBreakdown.length > 1
            ? "split"
            : "full",
        teamName: session.losingTeam
          ? `Team ${session.losingTeam}`
          : undefined,
        teamPlayers,
        sourceFrameIds: payer.line
          ? [payer.line.id]
          : undefined,
      });
    });

  addTableBillCafeChargesToCustomer(table, session);
}

interface StartSessionData {
  tableId: number;
  sessionType: SessionType;
  player1: string;
  player1CustomerId?: string;
  player2?: string;
  player2CustomerId?: string;
  player3?: string;
  player3CustomerId?: string;
  player4?: string;
  player4CustomerId?: string;
  extraPlayers?: string[];
  extraPlayerCustomerIds?: string[];
  teamAOneNameEnough?: boolean;
  teamBOneNameEnough?: boolean;
  teamABillOwnerCustomerId?: string;
  teamABillOwnerName?: string;
  teamBBillOwnerCustomerId?: string;
  teamBBillOwnerName?: string;
  centuryTeamSize?: 2 | 3 | 4;
  startTime: Date;
  endTime?: Date;
  winnerName?: string;
  loserName?: string;
  payerName?: string;
  winningTeam?: "A" | "B";
  losingTeam?: "A" | "B";
  isFinal?: boolean;
  finalGames?: number;
}

interface UpdateSessionData {
  tableId: number;
  player1: string;
  player1CustomerId?: string;
  player2?: string;
  player2CustomerId?: string;
  player3?: string;
  player3CustomerId?: string;
  player4?: string;
  player4CustomerId?: string;
  extraPlayers?: string[];
  extraPlayerCustomerIds?: string[];
  teamAOneNameEnough?: boolean;
  teamBOneNameEnough?: boolean;
  teamABillOwnerCustomerId?: string;
  teamABillOwnerName?: string;
  teamBBillOwnerCustomerId?: string;
  teamBBillOwnerName?: string;
  sessionType: SessionType;
  startTime: Date;
  tableChargeLines?: TableChargeLine[];
}

interface ReceivePaymentData {
  tableId: number;
  paymentMethod: PaymentMethod;
  payerName?: string;
}

interface UpdateSessionCafeData {
  tableId: number;
  cafeOrders: CafeOrderItem[];
}

interface AddTableChargeLineData {
  tableId: number;
  type: TableChargeLineType;
  startedAt?: Date;
  payerName?: string;
  payerCustomerId?: string;
  loserName?: string;
  loserCustomerId?: string;
  loserParticipantKey?: string;
  winnerName?: string;
  winnerCustomerId?: string;
  winnerParticipantKey?: string;
  winningTeam?: "A" | "B";
  losingTeam?: "A" | "B";
  isFinal?: boolean;
  finalGames?: number;
}

interface EndSessionData {
  tableId: number;
  endTime?: Date;
  winnerName?: string;
  loserName?: string;
  payerName?: string;
  payerCustomerId?: string;
  winningTeam?: "A" | "B";
  losingTeam?: "A" | "B";
  loserCustomerId?: string;
  loserParticipantKey?: string;
  winnerCustomerId?: string;
  winnerParticipantKey?: string;
  isFinal?: boolean;
  finalGames?: number;
}

interface TableStore {
  tables: Table[];

  startSession: (
    data: StartSessionData
  ) => void;

  updateSession: (
    data: UpdateSessionData
  ) => void;

  pauseSession: (
    tableId: number
  ) => void;

  resumeSession: (
    tableId: number
  ) => void;

  endSession: (data: EndSessionData) => void;
  cancelSession: (tableId: number) => void;

  updateSessionCafe: (
    data: UpdateSessionCafeData
  ) => void;

  addTableChargeLine: (
    data: AddTableChargeLineData
  ) => void;

  receivePayment: (
    data: ReceivePaymentData
  ) => void;
  resetTableStoreToDefault: () => void;
}

function restorePersistedTables(
  persistedTables: Table[] | undefined
) {
  if (!persistedTables) return initialTables;

  return initialTables.map((initialTable) => {
    const persistedTable = persistedTables.find(
      (table) => table.id === initialTable.id
    );

    if (!persistedTable) return initialTable;

    const session = persistedTable.session;

    return {
      ...initialTable,
      status: persistedTable.status,
      session: session
        ? {
            ...session,
            startTime: new Date(session.startTime),
            endTime: session.endTime
              ? new Date(session.endTime)
              : undefined,
            pausedAt: session.pausedAt
              ? new Date(session.pausedAt)
              : undefined,
            cafeOrders: (session.cafeOrders ?? []).map(
              (item) => ({
                ...item,
                timeAdded: new Date(item.timeAdded),
              })
            ),
          }
        : undefined,
    };
  });
}

export const useTableStore =
  create<TableStore>()(
    persist(
      (set) => ({
        tables: initialTables,

    startSession: (data) =>
      set((state) => ({
        tables: state.tables.map((table) => {
          if (table.id !== data.tableId)
            return table;

          const player1 =
            normalizeWalkInPlayerName(
              data.player1,
              state.tables,
              table.id
            );

          useCafeStore
            .getState()
            .clearTableOrders(table.id);

          const sessionId = `SA-${Date.now()}`;
          let session: Session = {
            id: sessionId,
            tableId: table.id,
            sessionType: data.sessionType,
            tableChargeLines: [
              {
                ...createInitialChargeLine(
                sessionId,
                data.sessionType,
                table.type,
                data.startTime,
                { isFinal: data.isFinal, finalGames: data.finalGames }
                ),
                ...(data.endTime
                  ? {
                      loserName: data.loserName,
                      winnerName: data.winnerName,
                      payerName: data.payerName,
                      winningTeam: data.winningTeam,
                      losingTeam: data.losingTeam,
                    }
                  : {}),
              },
            ],
            frameTimerStartedAt:
              data.startTime.toISOString(),
            frameTimerPausedMilliseconds: 0,
            player1,
            player1CustomerId:
              data.player1CustomerId,
            player2: data.player2,
            player2CustomerId:
              data.player2CustomerId,
            player3: data.player3,
            player3CustomerId:
              data.player3CustomerId,
            player4: data.player4,
            player4CustomerId:
              data.player4CustomerId,
            extraPlayers:
              data.extraPlayers ?? [],
            extraPlayerCustomerIds:
              data.extraPlayerCustomerIds ?? [],
            teamAPlayers: [
              player1,
              data.player2,
              ...(data.sessionType === "century"
                ? (data.extraPlayers ?? []).slice(0, (data.centuryTeamSize ?? 2) - 2)
                : []),
            ].filter(Boolean) as string[],
            teamBPlayers: [
              data.player3,
              data.player4,
              ...(data.sessionType === "century"
                ? (data.extraPlayers ?? []).slice((data.centuryTeamSize ?? 2) - 2)
                : []),
            ].filter(Boolean) as string[],
            teamAOneNameEnough:
              data.teamAOneNameEnough,
            teamBOneNameEnough:
              data.teamBOneNameEnough,
            teamABillOwnerCustomerId: data.teamABillOwnerCustomerId,
            teamABillOwnerName: data.teamABillOwnerName,
            teamBBillOwnerCustomerId: data.teamBBillOwnerCustomerId,
            teamBBillOwnerName: data.teamBBillOwnerName,
            centuryTeamSize: data.centuryTeamSize,
            startTime: data.startTime,
            endTime: data.endTime,
            winnerName: data.winnerName,
            loserName: data.loserName,
            payerName: data.payerName,
            winningTeam: data.winningTeam,
            losingTeam: data.losingTeam,

            pausedAt: undefined,
            totalPausedMilliseconds: 0,

            cafeAmount: 0,
            cafeOrders: [],
            discount: 0,

            isPaid: false,
          };

          if (data.endTime) {
            session = {
              ...session,
              tableChargeLines: getFinalTableChargeLines(
                table,
                session,
                data.endTime
              ),
            };

            if (table.id >= 1 && table.id <= 7 && (session.sessionType === "single" || session.sessionType === "double")) {
              const settlement = calculateFinalSettlement(session);
              const settledAt = new Date().toISOString();
              session = {
                ...session,
                tableChargeLines: settlement.lines.map((line) => ({ ...line, settlementProcessedAt: settledAt })),
                settlementProcessedAt: settledAt,
                settlementId: `SETTLEMENT-${session.id}`,
                originalGameCount: settlement.originalGameCount,
                originalTableAmount: settlement.originalTableAmount,
                settledTableAmount: settlement.owners.reduce(
                  (total, owner) =>
                    total + getSettlementOwnerAmount(owner, settlement.lines),
                  0
                ),
                advanceGamesEarned: settlement.owners.reduce((total, owner) => total + owner.advanceGames, 0),
              };
            }
            const pendingTable: Table = {
              ...table,
              status: "payment-pending",
              session,
            };

            const pendingBill = useCheckoutStore
              .getState()
              .addPendingBill({
                table: pendingTable,
                session,
              });

            createTableHistoryRecord(
              pendingTable,
              session,
              pendingBill.staffBillNumber
            );
            addSessionGameChargesToCustomers(
              pendingTable,
              session
            );

            return {
              ...table,
              status: "available",
              session: undefined,
            };
          }

          return {
            ...table,
            status: "running",
            session,
          };
        }),
      })),

    updateSession: (data) =>
      set((state) => ({
        tables: state.tables.map((table) => {
          if (table.id !== data.tableId)
            return table;

          if (!table.session)
            return table;

          const existingSession =
            table.session;
          const player1 =
            isWalkInName(data.player1) &&
            isWalkInName(existingSession.player1)
              ? existingSession.player1
              : normalizeWalkInPlayerName(
                  data.player1,
                  state.tables,
                  table.id
                );

          return {
            ...table,
            session: {
              ...existingSession,
              player1,
              player1CustomerId:
                data.player1CustomerId,
              player2: data.player2,
              player2CustomerId:
                data.player2CustomerId,
              player3: data.player3,
              player3CustomerId:
                data.player3CustomerId,
              player4: data.player4,
              player4CustomerId:
                data.player4CustomerId,
              extraPlayers:
                data.extraPlayers ?? [],
              extraPlayerCustomerIds:
                data.extraPlayerCustomerIds ?? [],
              teamAPlayers: compactNames([
                player1,
                data.player2,
              ]),
              teamBPlayers: compactNames([
                data.player3,
                data.player4,
              ]),
              teamAOneNameEnough:
                data.teamAOneNameEnough,
              teamBOneNameEnough:
                data.teamBOneNameEnough,
              teamABillOwnerCustomerId: data.teamABillOwnerCustomerId,
              teamABillOwnerName: data.teamABillOwnerName,
              teamBBillOwnerCustomerId: data.teamBBillOwnerCustomerId,
              teamBBillOwnerName: data.teamBBillOwnerName,
              sessionType:
                data.sessionType,
              startTime:
                data.startTime,
              tableChargeLines:
                data.tableChargeLines ??
                existingSession.tableChargeLines,
              frameTimerStartedAt:
                data.tableChargeLines
                  ? data.tableChargeLines.at(-1)
                      ?.startedAt ??
                    existingSession.frameTimerStartedAt
                  : existingSession.frameTimerStartedAt,
              frameTimerPausedMilliseconds:
                data.tableChargeLines
                  ? existingSession
                      .totalPausedMilliseconds
                  : existingSession
                      .frameTimerPausedMilliseconds,
            },
          };
        }),
      })),

    pauseSession: (tableId) =>
      set((state) => ({
        tables: state.tables.map((table) => {
          if (table.id !== tableId)
            return table;

          if (!table.session)
            return table;

          return {
            ...table,
            status: "paused",
            session: {
              ...table.session,
              pausedAt: new Date(),
            },
          };
        }),
      })),

    resumeSession: (tableId) =>
      set((state) => ({
        tables: state.tables.map((table) => {
          if (table.id !== tableId)
            return table;

          if (
            !table.session ||
            !table.session.pausedAt
          )
            return table;

          const pausedTime =
            Date.now() -
            new Date(
              table.session.pausedAt
            ).getTime();

          return {
            ...table,
            status: "running",
            session: {
              ...table.session,
              pausedAt: undefined,
              totalPausedMilliseconds:
                table.session
                  .totalPausedMilliseconds +
                pausedTime,
            },
          };
        }),
      })),

    endSession: ({
      tableId,
      endTime: requestedEndTime,
      winnerName,
      loserName,
      payerName,
      payerCustomerId,
      loserCustomerId,
      loserParticipantKey,
      winnerCustomerId,
      winnerParticipantKey,
      winningTeam,
      losingTeam,
      isFinal,
      finalGames,
    }) =>
      set((state) => ({
        tables: state.tables.map((table) => {
          if (table.id !== tableId)
            return table;

          if (!table.session)
            return table;

          let totalPausedMilliseconds =
            table.session
              .totalPausedMilliseconds;

          const endTime = requestedEndTime
            ? new Date(requestedEndTime)
            : new Date();

          if (table.session.pausedAt) {
            totalPausedMilliseconds +=
              Math.max(
                0,
                endTime.getTime() -
                  new Date(
                    table.session.pausedAt
                  ).getTime()
              );
          }

          const tableChargeLines =
            getFinalTableChargeLines(
              table,
              table.session,
              endTime
            ).map((line, index, lines) => {
              const isLastLine =
                index === lines.length - 1;

              if (
                !isLastLine ||
                (!loserName && !payerName)
              ) {
                return line;
              }

              return {
                ...line,
                payerName,
                payerCustomerId,
                loserName,
                loserCustomerId,
                loserParticipantKey,
                winnerName,
                winnerCustomerId,
                winnerParticipantKey,
                winningTeam,
                losingTeam,
                isFinal:
                  isLastLine && isFinal
                    ? true
                    : line.isFinal,
                finalGames:
                  isLastLine && isFinal
                    ? finalGames
                    : line.finalGames,
              };
            });
          const settlement =
            table.id >= 1 &&
            table.id <= 7 &&
            (table.session.sessionType === "single" || table.session.sessionType === "double")
              ? calculateFinalSettlement(table.session, tableChargeLines)
              : undefined;
          const settledAt = new Date().toISOString();
          const tableBookingCafePayerName =
            payerName ?? loserName;
          const tableBookingCafePayerId =
            payerCustomerId ?? loserCustomerId;
          const tableBookingCafeParticipantKey =
            loserParticipantKey;
          const losingCenturyPlayers =
            table.session.sessionType === "century" && losingTeam
              ? getTeamPlayers(table.session, losingTeam)
              : [];
          const liveCafeOrders = useCafeStore
            .getState()
            .getTableOrderItems(table.id, table.session.id);
          const sourceCafeOrders =
            liveCafeOrders.length > 0
              ? liveCafeOrders
              : table.session.cafeOrders;
          const cafeOrders =
            table.session.sessionType === "century" &&
            losingCenturyPlayers.length > 0
              ? sourceCafeOrders.flatMap((item, itemIndex) => {
                  const isTableAttached = isTableAttachedCafeItem(
                    item,
                    table.session!,
                    table
                  );
                  if (
                    item.name.startsWith("[Accessory]") ||
                    (!isTableAttached &&
                      (item.playerId ||
                        item.participantKey ||
                        item.playerName ||
                        item.customerName))
                  ) {
                    return [item];
                  }

                  return losingCenturyPlayers.map((playerName, index) => {
                    const playerEntry = getSessionPlayerEntries(
                      table.session!
                    ).find(
                      (entry) =>
                        normalizePlayerName(entry.name) ===
                        normalizePlayerName(playerName)
                    );
                    const share = item.subtotal / losingCenturyPlayers.length;

                    return {
                      ...item,
                      lineId: `${item.lineId ?? item.menuItemId}-${itemIndex}-CENTURY-${index}`,
                      tableBill: true,
                      price: share,
                      quantity: 1,
                      subtotal: share,
                      customerName: playerName,
                      playerName,
                      playerId: playerEntry?.customerId,
                      participantKey: playerEntry
                        ? getSessionParticipantKey(
                            table.session!.id,
                            playerEntry.slot
                          )
                        : undefined,
                    };
                  });
                })
              :
            table.id >= 1 &&
            table.id <= 7 &&
              tableBookingCafePayerName &&
              table.session.sessionType !== "century"
              ? sourceCafeOrders.map((item) =>
                  item.name.startsWith("[Accessory]") ||
                  (!isTableAttachedCafeItem(item, table.session!, table) &&
                    (item.playerId ||
                      item.participantKey ||
                      item.playerName ||
                      item.customerName))
                    ? item
                    : {
                        ...item,
                        tableBill: true,
                        customerName:
                          tableBookingCafePayerName,
                        playerName:
                          tableBookingCafePayerName,
                        playerId:
                          tableBookingCafePayerId,
                        participantKey:
                          tableBookingCafeParticipantKey,
                      }
                )
              : sourceCafeOrders;
          const endedSession: Session = {
            ...table.session,
            pausedAt: undefined,
            totalPausedMilliseconds,
            endTime,
            cafeOrders,
            cafeAmount: cafeOrders
              .filter((item) => !item.name.startsWith("[Accessory]"))
              .reduce((total, item) => total + item.subtotal, 0),
            tableChargeLines: settlement
              ? settlement.lines.map((line) => ({ ...line, settlementProcessedAt: settledAt }))
              : tableChargeLines,
            settlementProcessedAt: settlement ? settledAt : undefined,
            settlementId: settlement ? `SETTLEMENT-${table.session.id}` : undefined,
            originalGameCount: settlement?.originalGameCount,
            originalTableAmount: settlement?.originalTableAmount,
            settledTableAmount: settlement?.owners.reduce(
              (total, owner) =>
                total + getSettlementOwnerAmount(owner, settlement.lines),
              0
            ),
            advanceGamesEarned: settlement?.owners.reduce((total, owner) => total + owner.advanceGames, 0),
            winnerName,
            loserName,
            payerName,
            payerCustomerId,
            winningTeam,
            losingTeam,
          };

          const pendingBill = useCheckoutStore
            .getState()
            .addPendingBill({
              table,
              session: endedSession,
            });

          createTableHistoryRecord(
            table,
            endedSession,
            pendingBill.staffBillNumber
          );
          addSessionGameChargesToCustomers(
            table,
            endedSession
          );

          return {
            ...table,
            status: "available",
            session: undefined,
          };
        }),
      })),

    cancelSession: (tableId) =>
      set((state) => ({
        tables: state.tables.map((table) => {
          if (table.id !== tableId) {
            return table;
          }

          if (table.session) {
            const cancelledAt = new Date().toISOString();
            createTableHistoryRecord(
              table,
              {
                ...table.session,
                endTime: new Date(cancelledAt),
              },
              undefined,
              {
                paymentStatus: "cancelled",
                cancelledAt,
                cancelledReason: "Session cancelled",
              }
            );
          }

          useCafeStore
            .getState()
            .clearTableOrders(tableId);

          return {
            ...table,
            status: "available",
            session: undefined,
          };
        }),
      })),

    addTableChargeLine: ({
      tableId,
      type,
      startedAt,
      payerName,
      payerCustomerId,
      loserName,
      loserCustomerId,
      loserParticipantKey,
      winnerName,
      winnerCustomerId,
      winnerParticipantKey,
      winningTeam,
      losingTeam,
      isFinal,
      finalGames,
    }) =>
      set((state) => ({
        tables: state.tables.map((table) => {
          if (table.id !== tableId || !table.session) {
            return table;
          }

          const now = startedAt
            ? new Date(startedAt)
            : new Date();
          const existingLines =
            table.session.tableChargeLines ?? [];
          const finalizedLines = existingLines.map((line, index) => {
            if (index !== existingLines.length - 1) return line;
            const finalized = finalizeChargeLine(line, table.type, now);
            return line.type === "tableBooking"
              ? finalized
              : {
                  ...finalized,
                  payerName,
                  payerCustomerId,
                  loserName,
                  loserCustomerId,
                  loserParticipantKey,
                  winnerName,
                  winnerCustomerId,
                  winnerParticipantKey,
                  winningTeam,
                  losingTeam,
                };
          });
          const settings = useClubSettingsStore.getState().settings;
          const unitRate =
            type === "singleGame"
              ? settings.singleGameRate
              : type === "doubleGame"
                ? settings.doubleGameRate
                : table.type === "private-room"
                  ? 25
                  : settings.tableBookingRatePerMinute;
          const nextLine: TableChargeLine = {
            id: `TCL-${table.session.id}-${Date.now()}`,
            sessionId: table.session.id,
            type,
            label: getChargeLineLabel(
              type,
              table.type
            ),
            startedAt: now.toISOString(),
            endedAt: undefined,
            durationMinutes: undefined,
            amount:
              type === "tableBooking"
                ? 0
                : unitRate,
            unitRate,
            isFinal: Boolean(isFinal),
            finalGames: isFinal ? finalGames : undefined,
          };

          return {
            ...table,
            session: {
              ...table.session,
              tableChargeLines: [
                ...finalizedLines,
                nextLine,
              ],
              frameTimerStartedAt:
                now.toISOString(),
              frameTimerPausedMilliseconds:
                table.session.totalPausedMilliseconds,
            },
          };
        }),
      })),

    updateSessionCafe: ({
      tableId,
      cafeOrders,
    }) =>
      set((state) => {
        let changed = false;

        const tables = state.tables.map((table) => {
          if (table.id !== tableId) {
            return table;
          }

          if (!table.session) {
            return table;
          }

          const cafeAmount =
            cafeOrders.reduce(
              (total, item) =>
                item.menuItemId.startsWith(
                  "ACC-"
                ) ||
                item.name.startsWith(
                  "[Accessory]"
                )
                  ? total
                  : total + item.subtotal,
              0
            );

          const existingSignature =
            JSON.stringify(
              table.session.cafeOrders
            );
          const nextSignature =
            JSON.stringify(cafeOrders);

          if (
            table.session.cafeAmount ===
              cafeAmount &&
            existingSignature === nextSignature
          ) {
            return table;
          }

          changed = true;

          return {
            ...table,
            session: {
              ...table.session,
              cafeOrders,
              cafeAmount,
            },
          };
        });

        if (!changed) {
          return state;
        }

        return { tables };
      }),

    receivePayment: ({
      tableId,
      paymentMethod,
      payerName,
    }) =>
      set((state) => ({
        tables: state.tables.map((table) => {
          if (table.id !== tableId)
            return table;

          if (!table.session)
            return table;

          const salesStore =
            useSalesStore.getState();
          const activeDay =
            useBusinessDayStore
              .getState()
              .getActiveBusinessDay();

          if (!activeDay) {
            alert(
              "Please start the day before receiving payment."
            );
            return table;
          }
          const invoiceNumber =
            salesStore.getNextInvoiceNumber();
          const tableForSale = {
            ...table,
            session: {
              ...table.session,
              payerName:
                payerName ??
                table.session.payerName,
            },
          };
          const sale = createSaleFromTable({
            table: tableForSale,
            paymentMethod,
            invoiceNumber,
          });

          if (sale) {
            salesStore.addSale({
              ...sale,
              activeBusinessDayId:
                activeDay.id,
            });
          }

          console.log("Paid Session", {
            ...tableForSale.session,
            paymentMethod,
            isPaid: true,
          });

          useCafeStore
            .getState()
            .clearTableOrders(tableId);

          return {
            ...table,
            status: "available",
            session: undefined,
          };
        }),
      })),

    resetTableStoreToDefault: () =>
      set({
        tables: initialTables.map((table) => ({
          ...table,
          status: "available",
          session: undefined,
        })),
      }),
      }),
      {
        name: "snooker-arena-tables",
        partialize: (state) => ({
          tables: state.tables,
        }),
        merge: (persistedState, currentState) => ({
          ...currentState,
          tables: restorePersistedTables(
            (persistedState as Partial<TableStore>).tables
          ),
        }),
      }
    )
  );
