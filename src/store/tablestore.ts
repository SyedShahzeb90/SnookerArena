import { create } from "zustand";

import { initialTables } from "@/data/initialTables";
import { useCheckoutStore } from "@/features/billing/store/checkoutStore";
import { useCafeStore } from "@/features/cafe/store/cafeStore";
import { useBusinessDayStore } from "@/features/business-day/store/businessDayStore";
import { calculateBill } from "@/features/pricing/utils/calculateBill";
import { calculateGamePrice } from "@/features/pricing/utils/calculateGamePrice";
import { useCustomerAccountStore } from "@/features/customers/store/customerAccountStore";
import { useSalesStore } from "@/features/sales/store/salesStore";
import { createSaleFromTable } from "@/features/sales/utils/createSale";
import { getSessionPlayers } from "@/features/sessions/utils/sessionPlayers";
import {
  calculateDoubleGamePayerBreakdown,
  getTeamPlayers,
} from "@/features/sessions/utils/doubleGameBilling";
import {
  findPayerBreakdownForPlayer,
  getPlayerCafeItems,
} from "@/features/billing/utils/playerBillIdentity";
import { useTableHistoryStore } from "@/features/table-history/store/tableHistoryStore";

import type {
  CafeOrderItem,
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

function buildPlayerBreakdown(
  session: Session,
  tableAmount: number
) {
  const players = getSessionPlayers(session);
  const payerBreakdown: Array<{
    line?: TableChargeLine;
    playerName: string;
    tableAmountShare: number;
    note?: string;
  }> =
    calculateDoubleGamePayerBreakdown({
      session,
      tableAmount,
    });
  return players.map((playerName) => {
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
}: {
  type: TableChargeLineType;
  tableType: Table["type"];
  startedAt: Date;
  endedAt: Date;
}) {
  if (type === "singleGame") return 300;
  if (type === "doubleGame") return 600;

  const rate =
    tableType === "private-room" ? 25 : 20;
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
    sessionType === "private"
  ) {
    return "tableBooking";
  }

  return "singleGame";
}

function createInitialChargeLine(
  sessionId: string,
  sessionType: SessionType,
  tableType: Table["type"],
  startedAt: Date
): TableChargeLine {
  const type =
    sessionTypeToChargeLineType(sessionType);
  const endedAt =
    type === "tableBooking" ? undefined : startedAt;

  return {
    id: `TCL-${sessionId}-${Date.now()}`,
    sessionId,
    type,
    label: getChargeLineLabel(type, tableType),
    startedAt: startedAt.toISOString(),
    endedAt: endedAt?.toISOString(),
    durationMinutes:
      type === "tableBooking" ? undefined : 0,
    amount:
      type === "tableBooking"
        ? 0
        : getChargeLineAmount({
            type,
            tableType,
            startedAt,
            endedAt: endedAt!,
          }),
  };
}

function finalizeChargeLine(
  line: TableChargeLine,
  tableType: Table["type"],
  endedAt: Date
): TableChargeLine {
  if (line.endedAt && line.type !== "tableBooking") {
    return line;
  }

  const startedAt = new Date(line.startedAt);
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
          })
        : line.amount,
  };
}

function getFinalTableChargeLines(
  table: Table,
  session: Session,
  endedAt: Date
) {
  const existingLines =
    session.tableChargeLines ?? [];

  if (existingLines.length > 0) {
    return existingLines.map((line) =>
      finalizeChargeLine(line, table.type, endedAt)
    );
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
  staffBillNumber?: string
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
  const bill = calculateBill({
    gameAmount: tableAmount,
    cafeAmount: session.cafeAmount,
    discount: session.discount,
  });
  const players = getSessionPlayers(session);
  const now = new Date().toISOString();

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
      player2Name: session.player2,
      player3Name: session.player3,
      player4Name: session.player4,
      sessionType: session.sessionType,
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      durationMinutes:
        pricing.duration.totalMinutes,
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
      payerBreakdown:
        calculateDoubleGamePayerBreakdown({
          session,
          tableAmount: pricing.gameAmount,
        }),
      tableAmount,
      cafeAmount: session.cafeAmount,
      discount: session.discount,
      grandTotal: bill.total,
      paymentStatus: "pending",
      pendingBillId: `BILL-${session.id}`,
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
        tableAmount
      ),
    });
}

function addSessionGameChargesToCustomers(
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
  const payerBreakdown: Array<{
    line?: TableChargeLine;
    playerName: string;
    tableAmountShare: number;
    note?: string;
  }> =
    tableChargeLines.length > 0
      ? tableChargeLines.map((line) => ({
          line,
          playerName:
            line.payerName ??
            line.loserName ??
            session.payerName ??
            session.player1,
          tableAmountShare: line.amount,
          note: line.label,
        }))
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
    const existingId =
      playerName === session.player1
        ? session.player1CustomerId
        : playerName === session.player2
          ? session.player2CustomerId
          : playerName === session.player3
            ? session.player3CustomerId
            : playerName === session.player4
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
          session.payerCustomerId ??
          getCustomerIdForPayer(
            payer.playerName
          ),
        sessionId: payer.line
          ? `${session.id}-${payer.line.id}`
          : session.id,
        tableId: table.id,
        tableName: table.name,
        tableType: table.type,
        sessionType: payer.line
          ? payer.line.type === "doubleGame"
            ? "double"
            : payer.line.type === "tableBooking"
              ? table.type === "private-room"
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
        loserName: session.loserName,
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
      });
    });
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
  teamAOneNameEnough?: boolean;
  teamBOneNameEnough?: boolean;
  startTime: Date;
  endTime?: Date;
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
  teamAOneNameEnough?: boolean;
  teamBOneNameEnough?: boolean;
  sessionType: SessionType;
  startTime: Date;
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
  payerName?: string;
  payerCustomerId?: string;
  loserName?: string;
  winnerName?: string;
}

interface EndSessionData {
  tableId: number;
  winnerName?: string;
  loserName?: string;
  payerName?: string;
  payerCustomerId?: string;
  winningTeam?: "A" | "B";
  losingTeam?: "A" | "B";
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

export const useTableStore =
  create<TableStore>((set) => ({
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
          const session: Session = {
            id: sessionId,
            tableId: table.id,
            sessionType: data.sessionType,
            tableChargeLines: [
              createInitialChargeLine(
                sessionId,
                data.sessionType,
                table.type,
                data.startTime
              ),
            ],
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
            teamAPlayers: [
              player1,
              data.player2,
            ].filter(Boolean) as string[],
            teamBPlayers: [
              data.player3,
              data.player4,
            ].filter(Boolean) as string[],
            teamAOneNameEnough:
              data.teamAOneNameEnough,
            teamBOneNameEnough:
              data.teamBOneNameEnough,
            startTime: data.startTime,
            endTime: data.endTime,

            pausedAt: undefined,
            totalPausedMilliseconds: 0,

            cafeAmount: 0,
            cafeOrders: [],
            discount: 0,

            isPaid: false,
          };

          if (data.endTime) {
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
              sessionType:
                data.sessionType,
              startTime:
                data.startTime,
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
      winnerName,
      loserName,
      payerName,
      payerCustomerId,
      winningTeam,
      losingTeam,
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

          if (table.session.pausedAt) {
            totalPausedMilliseconds +=
              Date.now() -
              new Date(
                table.session.pausedAt
              ).getTime();
          }

          const endTime = new Date();
          const tableChargeLines =
            getFinalTableChargeLines(
              table,
              table.session,
              endTime
            );
          const endedSession: Session = {
            ...table.session,
            pausedAt: undefined,
            totalPausedMilliseconds,
            endTime,
            tableChargeLines,
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
      payerName,
      payerCustomerId,
      loserName,
      winnerName,
    }) =>
      set((state) => ({
        tables: state.tables.map((table) => {
          if (table.id !== tableId || !table.session) {
            return table;
          }

          const now = new Date();
          const existingLines =
            table.session.tableChargeLines ?? [];
          const finalizedLines = existingLines.map(
            (line) =>
              line.type === "tableBooking" &&
              !line.endedAt
                ? finalizeChargeLine(
                    line,
                    table.type,
                    now
                  )
                : line
          );
          const endedAt =
            type === "tableBooking" ? undefined : now;
          const nextLine: TableChargeLine = {
            id: `TCL-${table.session.id}-${Date.now()}`,
            sessionId: table.session.id,
            type,
            label: getChargeLineLabel(
              type,
              table.type
            ),
            startedAt: now.toISOString(),
            endedAt: endedAt?.toISOString(),
            durationMinutes:
              type === "tableBooking"
                ? undefined
                : 0,
            amount:
              type === "tableBooking"
                ? 0
                : getChargeLineAmount({
                    type,
                    tableType: table.type,
                    startedAt: now,
                    endedAt: endedAt!,
                  }),
            payerName,
            payerCustomerId,
            loserName,
            winnerName,
          };

          return {
            ...table,
            session: {
              ...table.session,
              tableChargeLines: [
                ...finalizedLines,
                nextLine,
              ],
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
  }));
