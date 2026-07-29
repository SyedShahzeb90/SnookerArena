import { useState } from "react";

import {
  ChevronDown,
  Clock,
  Coffee,
  CircleDollarSign,
  Package,
  Trophy,
  Users,
} from "lucide-react";

import type { Session } from "@/types/session";
import type { Table } from "@/types/table";
import { calculateBill } from "@/features/pricing/utils/calculateBill";
import { calculateGamePrice } from "@/features/pricing/utils/calculateGamePrice";
import {
  getSessionPlayerEntries,
  getSessionPlayers,
} from "@/features/sessions/utils/sessionPlayers";
import { useCustomerAccountStore } from "@/features/customers/store/customerAccountStore";
import type { CustomerAccount } from "@/features/customers/types/customerAccount";
import { getRunningBillTotals } from "@/features/dashboard/utils/runningBillTotals";
import { getDoubleGameTeams } from "@/features/sessions/utils/doubleGameBilling";
import { calculateFinalSettlement } from "@/features/advance-games/utils/finalSettlement";
import { normalizePlayerName } from "@/features/cafe/utils/playerIdentity";
import { formatAppTime, useAppDateTimeFormats } from "@/lib/dateTime";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  session: Session;
  tableId?: number;
  tableType: Table["type"];
  now: Date;
  compactRunning?: boolean;
  summaryOnly?: boolean;
  onCafeBillClick?: () => void;
  onAccessoriesClick?: () => void;
}

interface PlayerGameCounter {
  key: string;
  name: string;
  games: number;
  advanceGames: number;
}

function GameCounterBadges({
  games,
  advanceGames,
}: Pick<PlayerGameCounter, "games" | "advanceGames">) {
  return (
    <span className="flex shrink-0 flex-wrap items-center justify-end gap-1">
      <span className="whitespace-nowrap rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-slate-700">
        {games} {games === 1 ? "game" : "games"}
      </span>
      {advanceGames > 0 && (
        <span className="whitespace-nowrap rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-emerald-700">
          +{advanceGames} advance
        </span>
      )}
    </span>
  );
}

function TableInfo({
  session,
  tableId,
  tableType,
  now,
  compactRunning = false,
  summaryOnly = false,
  onCafeBillClick,
  onAccessoriesClick,
}: Props) {
  const [showCafeItems, setShowCafeItems] =
    useState(false);
  const [showFrameHistory, setShowFrameHistory] =
    useState(false);
  const { timeFormat } = useAppDateTimeFormats();
  const getGameCountLabel = () => {
    const chargeLines = (session.tableChargeLines ?? []).filter(
      (line) =>
        line.type === "singleGame" ||
        line.type === "doubleGame"
    );

    const singleCount = chargeLines.filter(
      (line) => line.type === "singleGame"
    ).length;
    const doubleCount = chargeLines.filter(
      (line) => line.type === "doubleGame"
    ).length;

    if (singleCount > 0 && doubleCount > 0) {
      return `Single x${singleCount} \u00b7 Double x${doubleCount}`;
    }

    if (singleCount > 0) {
      return `Single Game x${singleCount}`;
    }

    if (doubleCount > 0) {
      return `Double Game x${doubleCount}`;
    }

    if (session.sessionType === "single") {
      return "Single Game x1";
    }

    if (session.sessionType === "double") {
      return "Double Game x1";
    }

    return undefined;
  };

  const customerAccounts =
    useCustomerAccountStore(
      (state) => state.accounts
    );
  const sessionPlayers =
    getSessionPlayers(session);
  const isBooking =
    session.sessionType === "time" ||
    session.sessionType === "private";
  const bookingLabel =
    isBooking && sessionPlayers.length > 1
      ? `${sessionPlayers[0]} + ${
          sessionPlayers.length - 1
        } players`
      : sessionPlayers[0];
  const doubleTeams =
    session.sessionType === "double"
      ? getDoubleGameTeams(session)
      : undefined;
  const sessionCustomerIds = [
    session.player1CustomerId,
    session.player2CustomerId,
    session.player3CustomerId,
    session.player4CustomerId,
  ].filter(
    (id): id is string => Boolean(id)
  );
  const accountBelongsToSession = (
    account: CustomerAccount
  ) =>
    sessionCustomerIds.includes(account.id) ||
    [
      ...account.gameCharges,
      ...account.cafeCharges,
      ...(account.accessoryCharges ?? []),
    ].some(
      (charge) => charge.sessionId === session.id
    );
  const activeSessionAccounts =
    customerAccounts.filter(
      (account) =>
        account.paymentStatus === "unpaid" &&
        accountBelongsToSession(account)
    );
  const openBillTotal = activeSessionAccounts.reduce(
    (total, account) => total + account.grandTotal,
    0
  );
  const isAccessoryOrder = (item: {
    menuItemId?: string;
    name: string;
  }) =>
    item.menuItemId?.startsWith("ACC-") ||
    item.name.startsWith("[Accessory]");
  const billedCafeTotal =
    activeSessionAccounts.reduce(
      (total, account) =>
        total +
        account.cafeCharges
          .filter(
            (charge) =>
              !charge.name.startsWith("[Accessory]") &&
              (tableId === undefined ||
                charge.tableId === tableId ||
                !charge.tableId)
          )
          .reduce(
            (sum, charge) =>
              sum + charge.subtotal,
            0
          ),
      0
    );
  const billedAccessoriesTotal =
    activeSessionAccounts.reduce(
      (total, account) =>
        total +
        (account.accessoryCharges ?? [])
          .filter(
            (charge) =>
              tableId === undefined ||
              charge.tableId === tableId ||
              !charge.tableId
          )
          .reduce(
            (sum, charge) =>
              sum + charge.subtotal,
            0
          ),
      0
    );
  const currentSessionBilledCafeTotal =
    activeSessionAccounts.reduce(
      (total, account) =>
        total +
        account.cafeCharges
          .filter(
            (charge) =>
              charge.sessionId === session.id &&
              !charge.name.startsWith("[Accessory]")
          )
          .reduce((sum, charge) => sum + charge.subtotal, 0),
      0
    );
  const currentSessionBilledAccessoriesTotal =
    activeSessionAccounts.reduce(
      (total, account) =>
        total +
        (account.accessoryCharges ?? [])
          .filter((charge) => charge.sessionId === session.id)
          .reduce((sum, charge) => sum + charge.subtotal, 0),
      0
    );
  const sessionAccessoriesTotal =
    session.cafeOrders
    .filter(
      isAccessoryOrder
    )
    .reduce(
      (total, item) => total + item.subtotal,
      0
    );
  const sessionCafeTotal = session.cafeOrders
    .filter(
      (item) => !isAccessoryOrder(item)
    )
    .reduce(
      (total, item) => total + item.subtotal,
      0
    );
  const latestSessionCafeItem = session.cafeOrders
    .filter((item) => !isAccessoryOrder(item))
    .at(-1);
  const latestBilledCafeItem = activeSessionAccounts
    .flatMap((account) =>
      account.cafeCharges.filter(
        (charge) =>
          charge.sessionId === session.id &&
          !charge.name.startsWith("[Accessory]")
      )
    )
    .sort(
      (a, b) =>
        new Date(a.orderedAt).getTime() -
        new Date(b.orderedAt).getTime()
    )
    .at(-1);
  const latestCafeItem = latestSessionCafeItem
    ? {
        name: latestSessionCafeItem.name,
        quantity: latestSessionCafeItem.quantity,
        subtotal: latestSessionCafeItem.subtotal,
      }
    : latestBilledCafeItem
      ? {
          name: latestBilledCafeItem.name,
          quantity: latestBilledCafeItem.quantity,
          subtotal: latestBilledCafeItem.subtotal,
        }
      : undefined;
  const sessionCafeItems = session.cafeOrders
    .filter((item) => !isAccessoryOrder(item))
    .map((item) => ({
      id: item.menuItemId,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      subtotal: item.subtotal,
      playerId: item.playerId,
      playerName:
        item.playerName ??
        item.customerName ??
        (sessionPlayers.length === 1
          ? sessionPlayers[0]
          : "Shared / Unassigned"),
    }));
  const billedCafeItems = activeSessionAccounts.flatMap(
    (account) =>
      account.cafeCharges
        .filter(
          (charge) =>
            !charge.name.startsWith("[Accessory]") &&
            (tableId === undefined ||
              charge.tableId === tableId ||
              !charge.tableId)
        )
        .map((charge) => ({
          id: charge.itemId,
          name: charge.name,
          price: charge.price,
          quantity: charge.quantity,
          subtotal: charge.subtotal,
          playerId: charge.customerId,
          playerName:
            charge.customerName ||
            account.customerName,
        }))
  );
  const cafeItemsSource =
    billedCafeTotal >= sessionCafeTotal &&
    billedCafeItems.length > 0
      ? billedCafeItems
      : sessionCafeItems;
  const cafeItems = Array.from(
    cafeItemsSource
      .reduce(
        (items, item) => {
          const playerKey =
            item.playerId ??
            `name:${normalizePlayerName(
              item.playerName
            )}`;
          const key = `${playerKey}-${item.id}-${item.price}`;
          const existing = items.get(key);

          items.set(
            key,
            existing
              ? {
                  ...existing,
                  quantity:
                    existing.quantity + item.quantity,
                  subtotal:
                    existing.subtotal + item.subtotal,
                }
              : { ...item }
          );

          return items;
        },
        new Map<
          string,
          {
            id: string;
            name: string;
            price: number;
            quantity: number;
            subtotal: number;
            playerId?: string;
            playerName: string;
          }
        >()
      )
      .values()
  );
  const cafeItemsByPlayer = Array.from(
    cafeItems
      .reduce(
        (players, item) => {
          const key =
            item.playerId ??
            `name:${normalizePlayerName(
              item.playerName
            )}`;
          const existing = players.get(key);

          if (existing) {
            existing.items.push(item);
            existing.subtotal += item.subtotal;
          } else {
            players.set(key, {
              key,
              name: item.playerName,
              subtotal: item.subtotal,
              items: [item],
            });
          }

          return players;
        },
        new Map<
          string,
          {
            key: string;
            name: string;
            subtotal: number;
            items: typeof cafeItems;
          }
        >()
      )
      .values()
  );
  const cafeBillOwners = new Set(
    session.cafeOrders
      .filter((item) => !isAccessoryOrder(item))
      .map(
        (item) =>
          item.playerId ??
          item.playerName ??
          item.customerName
      )
      .filter(Boolean)
  );
  const hasSeparatePlayerBills =
    sessionPlayers.length > 1 &&
    (activeSessionAccounts.length > 1 ||
      cafeBillOwners.size > 1);
  const billTotals = getRunningBillTotals({
    tableBill: 0,
    billedCafeTotal,
    sessionCafeTotal,
    billedAccessoriesTotal,
    sessionAccessoriesTotal,
    separatePlayerBills: hasSeparatePlayerBills,
  });
  const accessoriesTotal =
    billTotals.accessoriesTotal;
  const cafeTotal = billTotals.cafeTotal;
  const currentEndTime = session.pausedAt
    ? new Date(session.pausedAt)
    : session.endTime
      ? new Date(session.endTime)
      : now;
  const pricing = calculateGamePrice({
    sessionType: session.sessionType,
    tableType,
    startTime: new Date(session.startTime),
    endTime: currentEndTime,
  });
  const tableChargeLines =
    session.tableChargeLines ?? [];
  const gameChargeLines = tableChargeLines.filter(
    (line) =>
      line.type === "singleGame" ||
      line.type === "doubleGame"
  );
  const gameSettlement = calculateFinalSettlement(
    session,
    gameChargeLines
  );
  const sessionPlayerEntries =
    getSessionPlayerEntries(session);
  const getOwnerCounter = (
    name: string,
    customerId?: string
  ) => {
    const ownerById = customerId
      ? gameSettlement.owners.find(
          (owner) =>
            owner.customerId === customerId ||
            owner.key === customerId
        )
      : undefined;
    const owner =
      ownerById ??
      gameSettlement.owners.find(
        (candidate) =>
          normalizePlayerName(candidate.customerName) ===
          normalizePlayerName(name)
      );

    return {
      games: owner?.payableGames ?? 0,
      advanceGames: owner?.advanceGames ?? 0,
    };
  };
  const playerGameCounters: PlayerGameCounter[] =
    sessionPlayerEntries.map((player, index) => ({
      key:
        player.customerId ??
        `${player.slot}-${index}-${player.name}`,
      name: player.name,
      ...getOwnerCounter(player.name, player.customerId),
    }));
  const frameRunningBalances = new Map<
    string,
    { name: string; games: number; advanceGames: number }
  >();
  const getFrameOwnerKey = (
    customerId: string | undefined,
    name: string
  ) =>
    customerId && !customerId.startsWith("name:")
      ? `id:${customerId}`
      : `name:${normalizePlayerName(name)}`;
  const frameHistory = gameSettlement.lines.map(
    (line, index) => {
      (line.settlement ?? []).forEach((effect) => {
        const key = getFrameOwnerKey(
          effect.customerId,
          effect.customerName
        );
        const current =
          frameRunningBalances.get(key) ?? {
            name: effect.customerName,
            games: 0,
            advanceGames: 0,
          };
        frameRunningBalances.set(key, {
          name: effect.customerName,
          games: Math.max(
            0,
            current.games + effect.payableGamesDelta
          ),
          advanceGames: Math.max(
            0,
            current.advanceGames +
              effect.advanceGamesDelta
          ),
        });
      });

      const playerTotals = sessionPlayerEntries.map(
        (player) => {
          const key = getFrameOwnerKey(
            player.customerId,
            player.name
          );
          const direct = frameRunningBalances.get(key);
          const byName = Array.from(
            frameRunningBalances.values()
          ).find(
            (balance) =>
              normalizePlayerName(balance.name) ===
              normalizePlayerName(player.name)
          );
          const balance = direct ?? byName;
          return {
            key:
              player.customerId ??
              `${player.slot}-${player.name}`,
            name: player.name,
            games: balance?.games ?? 0,
            advanceGames: balance?.advanceGames ?? 0,
          };
        }
      );
      const winnerEffect = line.settlement?.find(
        (effect) => effect.role === "winner"
      );
      const loserEffect = line.settlement?.find(
        (effect) => effect.role === "loser"
      );
      const losingTeam =
        line.losingTeam ??
        (line.winningTeam
          ? line.winningTeam === "A"
            ? "B"
            : "A"
          : undefined);
      const winningTeam =
        line.winningTeam ??
        (losingTeam
          ? losingTeam === "A"
            ? "B"
            : "A"
          : undefined);
      const teamLabel = (team: "A" | "B") => {
        const names =
          team === "A"
            ? doubleTeams?.teamAPlayers
            : doubleTeams?.teamBPlayers;
        return names && names.length > 0
          ? `${names.join(" / ")} (Team ${team})`
          : `Team ${team}`;
      };
      const inferredWinner =
        line.type === "singleGame"
          ? sessionPlayers.find(
              (name) =>
                normalizePlayerName(name) !==
                normalizePlayerName(
                  line.loserName ??
                    loserEffect?.customerName ??
                    ""
                )
            )
          : undefined;
      const storedStartedAt = new Date(
        line.startedAt
      ).getTime();
      const storedEndedAt = line.endedAt
        ? new Date(line.endedAt).getTime()
        : Number.NaN;
      const effectiveEndedAt =
        Number.isFinite(storedEndedAt) &&
        storedEndedAt > storedStartedAt
          ? line.endedAt
          : gameSettlement.lines[index + 1]?.startedAt ??
            (session.endTime
              ? new Date(session.endTime).toISOString()
              : undefined);

      return {
        ...line,
        endedAt: effectiveEndedAt,
        frameNumber: index + 1,
        winner:
          line.type === "doubleGame" && winningTeam
            ? teamLabel(winningTeam)
            : line.winnerName ??
              winnerEffect?.customerName ??
              inferredWinner,
        loser:
          line.type === "doubleGame" && losingTeam
            ? teamLabel(losingTeam)
            : line.loserName ?? loserEffect?.customerName,
        playerTotals,
      };
    }
  );
  const totalGames = gameChargeLines.length;
  const tableChargeTotal =
    tableChargeLines.length > 0
      ? tableChargeLines.reduce(
          (total, line) => {
            if (
              line.type === "tableBooking" &&
              !line.endedAt
            ) {
              const rate =
                line.unitRate ??
                (tableType === "private-room"
                  ? 25
                  : 20);
              const startedAt = new Date(
                line.startedAt
              );
              const minutes = Math.max(
                1,
                Math.ceil(
                  (currentEndTime.getTime() -
                    startedAt.getTime()) /
                    60000
                )
              );
              return total + minutes * rate;
            }

            return total + line.amount;
          },
          0
        )
      : pricing.gameAmount;
  const tableBill = calculateBill({
    gameAmount: tableChargeTotal,
    cafeAmount: 0,
    discount: session.discount,
  }).total;
  const currentBill = getRunningBillTotals({
    tableBill,
    billedCafeTotal,
    sessionCafeTotal,
    billedAccessoriesTotal,
    sessionAccessoriesTotal,
    separatePlayerBills: hasSeparatePlayerBills,
    openBillTotal,
    currentSessionBilledCafeTotal,
    currentSessionBilledAccessoriesTotal,
    openBillIncludesBilledTotals: true,
  }).currentBill;
  const displayedTableTotal = hasSeparatePlayerBills
    ? tableBill
    : Math.max(
        0,
        currentBill - cafeTotal - accessoriesTotal
      );

  if (summaryOnly) {
    const identityLabel = doubleTeams
      ? `${doubleTeams.teamAPlayers.join(" / ")} vs ${doubleTeams.teamBPlayers.join(" / ")}`
      : isBooking
        ? bookingLabel
        : sessionPlayers.join(" / ");

    return (
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 rounded-md border border-slate-200 bg-white px-2.5 py-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
            <Users className="h-3.5 w-3.5 shrink-0" />
            {doubleTeams ? "Teams" : "Player / Customer"}
          </div>
          <p
            className="mt-0.5 truncate text-sm font-semibold text-slate-950"
            title={identityLabel}
          >
            {identityLabel}
          </p>
          {!isBooking && playerGameCounters.length > 0 && (
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              {playerGameCounters.map((player) => (
                <span
                  key={player.key}
                  className="flex min-w-0 items-center gap-1 text-[11px]"
                  title={`${player.name}: ${player.games} payable games${player.advanceGames > 0 ? `, +${player.advanceGames} advance games` : ""}`}
                >
                  <span className="max-w-24 truncate font-medium text-slate-600">
                    {player.name}
                  </span>
                  <strong className="whitespace-nowrap tabular-nums text-slate-900">
                    {player.games}
                  </strong>
                  {player.advanceGames > 0 && (
                    <strong className="whitespace-nowrap tabular-nums text-emerald-700">
                      +{player.advanceGames}
                    </strong>
                  )}
                </span>
              ))}
              <span
                key={totalGames}
                className="motion-value-change whitespace-nowrap text-[11px] font-medium text-slate-500"
              >
                Total {totalGames}
              </span>
            </div>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[11px] font-medium text-slate-500">Current Bill</p>
          <p
            key={Math.round(currentBill)}
            className="motion-value-change whitespace-nowrap rounded px-1 text-lg font-bold tabular-nums text-slate-950"
          >
            Rs. {Math.round(currentBill).toLocaleString()}
          </p>
        </div>
      </div>
    );
  }

  if (!compactRunning) {
    return (
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-slate-50 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-500">
            <Users className="h-4 w-4" />
            Players
          </div>
          {isBooking ? (
            <p className="font-semibold text-slate-950">{bookingLabel}</p>
          ) : (
            sessionPlayers.map((player) => (
              <p key={player} className="font-semibold text-slate-950">
                {player}
              </p>
            ))
          )}
        </div>

        <div className="rounded-lg bg-slate-50 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-500">
            <Clock className="h-4 w-4" />
            Started
          </div>
          <p className="font-semibold text-slate-950">
            {formatAppTime(session.startTime, timeFormat)}
          </p>
          <p className="text-sm capitalize text-slate-500">
            {getGameCountLabel() ?? session.sessionType}
          </p>
        </div>

        <button
          type="button"
          className="rounded-lg bg-emerald-50 p-3 text-left transition hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          onClick={(event) => {
            event.stopPropagation();
            onCafeBillClick?.();
          }}
        >
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-emerald-700">
            <Coffee className="h-4 w-4" />
            Cafe Bill
          </div>
          <p className="font-semibold text-emerald-800">Rs. {cafeTotal}</p>
        </button>

        <button
          type="button"
          className="rounded-lg bg-indigo-50 p-3 text-left transition hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          onClick={(event) => {
            event.stopPropagation();
            onAccessoriesClick?.();
          }}
        >
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-indigo-700">
            <Package className="h-4 w-4" />
            Accessories
          </div>
          <p className="font-semibold text-indigo-800">Rs. {accessoriesTotal}</p>
        </button>

        <div className="col-span-2 rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="mb-1 flex items-center gap-2 text-sm font-medium text-black">
                <CircleDollarSign className="h-4 w-4" />
                Current Bill
              </div>
              <p className="text-xs font-medium text-black">
                {hasSeparatePlayerBills
                  ? "Table bill only; cafe bills separate"
                  : "Open bill + current table"}
              </p>
            </div>
            <p
              key={Math.round(currentBill)}
              className="motion-value-change rounded px-1 text-xl font-bold text-black"
            >
              Rs. {currentBill}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2.5">
      <div className="col-span-2 rounded-lg bg-slate-50 p-3">
        <div className="mb-2 flex items-center justify-between gap-2 text-xs font-medium text-slate-500">
          <span className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {doubleTeams ? "Teams" : "Players"}
          </span>
          {!isBooking && (
            <span
              key={totalGames}
              className="motion-value-change whitespace-nowrap font-semibold tabular-nums text-slate-600"
            >
              Total games: {totalGames}
            </span>
          )}
        </div>

        {isBooking ? (
          <p className="font-semibold text-slate-950">
            {bookingLabel}
          </p>
        ) : doubleTeams ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-slate-500">Team A</p>
              <div className="mt-0.5 space-y-1">
                {playerGameCounters
                  .slice(0, doubleTeams.teamAPlayers.length)
                  .map((player) => (
                    <div
                      key={player.key}
                      className="min-w-0"
                    >
                      <p
                        className="truncate font-semibold text-slate-950"
                        title={player.name}
                      >
                        {player.name}
                      </p>
                      <div className="mt-1 flex">
                        <GameCounterBadges {...player} />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-500">Team B</p>
              <div className="mt-0.5 space-y-1">
                {playerGameCounters
                  .slice(doubleTeams.teamAPlayers.length)
                  .map((player) => (
                    <div
                      key={player.key}
                      className="min-w-0"
                    >
                      <p
                        className="truncate font-semibold text-slate-950"
                        title={player.name}
                      >
                        {player.name}
                      </p>
                      <div className="mt-1 flex">
                        <GameCounterBadges {...player} />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {sessionPlayers.map((player, index) => (
              <div key={`${index}-${player}`}>
                <p className="text-xs text-slate-500">
                  Player {index + 1}
                </p>
                <div className="mt-0.5 min-w-0">
                  <p
                    className="truncate font-semibold text-slate-950"
                    title={player}
                  >
                    {player}
                  </p>
                  <div className="mt-1 flex">
                    <GameCounterBadges
                      games={playerGameCounters[index]?.games ?? 0}
                      advanceGames={
                        playerGameCounters[index]?.advanceGames ?? 0
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg bg-slate-50 p-3">
        <div className="mb-1 flex items-center gap-2 text-xs font-medium text-slate-500">
          <Clock className="h-4 w-4" />
          Started
        </div>

        <p className="font-semibold text-slate-950">
          {formatAppTime(session.startTime, timeFormat)}
        </p>

      </div>

      <div className="rounded-lg bg-slate-50 p-3">
        <p className="text-xs font-medium text-slate-500">Current game</p>
        <p
          key={totalGames}
          className="motion-value-change mt-1 font-semibold text-slate-950"
        >
          {getGameCountLabel() ?? session.sessionType}
        </p>
      </div>

      {frameHistory.length > 0 && (
        <div className="col-span-2">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-2 text-left text-xs text-blue-800 transition hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200 dark:hover:bg-blue-950/60"
            onClick={(event) => {
              event.stopPropagation();
              setShowFrameHistory(true);
            }}
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5 shrink-0" />
              <strong>Frame history</strong>
              <span className="truncate">
                {frameHistory.length}{" "}
                {frameHistory.length === 1
                  ? "frame"
                  : "frames"}
              </span>
            </span>
            <span className="shrink-0 font-semibold">
              View details
            </span>
          </button>

          <Dialog
            open={showFrameHistory}
            onOpenChange={setShowFrameHistory}
          >
            <DialogContent
              className="flex max-h-[min(82vh,720px)] w-[min(94vw,680px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <DialogHeader className="border-b px-5 py-4 pr-12">
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <Trophy className="h-5 w-5 text-blue-700" />
                  Frame History
                </DialogTitle>
                <DialogDescription>
                  Winners, losers, Finals, and player totals
                  after every frame.
                </DialogDescription>
              </DialogHeader>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
                {frameHistory.map((frame) => (
                  <section
                    key={frame.id}
                    className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950"
                  >
                    <div className="flex items-start justify-between gap-3 border-b bg-slate-50 px-3 py-2.5 dark:bg-slate-900">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="text-slate-950 dark:text-white">
                            Frame {frame.frameNumber}
                          </strong>
                          <span className="text-sm text-slate-600 dark:text-slate-300">
                            {frame.type === "doubleGame"
                              ? "Double Game"
                              : "Single Game"}
                          </span>
                          {frame.isFinal &&
                            Number(frame.finalGames) > 0 && (
                              <span className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[11px] font-bold text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                                Final {frame.finalGames}
                              </span>
                            )}
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatAppTime(
                            frame.startedAt,
                            timeFormat
                          )}{" "}
                          –{" "}
                          {frame.endedAt
                            ? formatAppTime(
                                frame.endedAt,
                                timeFormat
                              )
                            : "In progress"}
                        </p>
                      </div>
                      <strong className="shrink-0 whitespace-nowrap tabular-nums text-slate-950 dark:text-white">
                        Rs.{" "}
                        {Math.round(
                          frame.amount
                        ).toLocaleString()}
                      </strong>
                    </div>

                    <div className="grid gap-2 px-3 py-2.5 text-sm sm:grid-cols-2">
                      <p>
                        <span className="text-slate-500">
                          Winner:
                        </span>{" "}
                        <strong className="text-emerald-700 dark:text-emerald-300">
                          {frame.winner ??
                            (frame.winningTeam
                              ? `Team ${frame.winningTeam}`
                              : "—")}
                        </strong>
                      </p>
                      <p>
                        <span className="text-slate-500">
                          Loser:
                        </span>{" "}
                        <strong className="text-red-700 dark:text-red-300">
                          {frame.loser ??
                            (frame.losingTeam
                              ? `Team ${frame.losingTeam}`
                              : "—")}
                        </strong>
                      </p>
                    </div>

                    <div className="border-t border-slate-100 bg-slate-50/70 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/60">
                      <p className="mb-2 text-[11px] font-semibold uppercase text-slate-500">
                        Totals after frame {frame.frameNumber}
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {frame.playerTotals.map((player) => (
                          <div
                            key={player.key}
                            className="flex min-w-0 items-center justify-between gap-2"
                          >
                            <span
                              className="truncate font-medium text-slate-800 dark:text-slate-100"
                              title={player.name}
                            >
                              {player.name}
                            </span>
                            <GameCounterBadges
                              games={player.games}
                              advanceGames={
                                player.advanceGames
                              }
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-blue-50 px-5 py-3 dark:bg-blue-950/30">
                <span className="font-semibold text-blue-800 dark:text-blue-200">
                  Current player totals
                </span>
                <div className="flex flex-wrap justify-end gap-2">
                  {playerGameCounters.map((player) => (
                    <span
                      key={player.key}
                      className="flex items-center gap-1.5"
                    >
                      <strong className="text-sm text-slate-900 dark:text-white">
                        {player.name}
                      </strong>
                      <GameCounterBadges {...player} />
                    </span>
                  ))}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      <div className="col-span-2 rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2 text-sm font-medium text-black">
              <CircleDollarSign className="h-4 w-4" />
              Current Bill
            </div>

            <p className="text-xs font-medium text-black">
              {hasSeparatePlayerBills
                ? "Table bill only; cafe bills separate"
                : "Open bill + current table"}
            </p>
          </div>

          <p
            key={Math.round(currentBill)}
            className="motion-value-change rounded px-1 text-2xl font-bold tabular-nums text-slate-950"
          >
            Rs. {Math.round(currentBill).toLocaleString()}
          </p>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 border-t pt-2 text-sm text-slate-500">
          <span className="min-w-0">Table <strong className="block truncate text-base font-bold tabular-nums text-slate-800">Rs. {Math.round(displayedTableTotal).toLocaleString()}</strong></span>
          <span className="min-w-0">Cafe <strong className="block truncate text-base font-bold tabular-nums text-slate-800">Rs. {Math.round(cafeTotal).toLocaleString()}</strong></span>
          <span className="min-w-0">Accessories <strong className="block truncate text-base font-bold tabular-nums text-slate-800">Rs. {Math.round(accessoriesTotal).toLocaleString()}</strong></span>
        </div>
        {latestCafeItem && (
          <div className="mt-2">
            <button
              type="button"
              aria-expanded={showCafeItems}
              className="flex w-full items-center justify-between gap-3 rounded-md bg-emerald-50 px-2.5 py-2 text-left text-xs text-emerald-800 transition hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-950/60"
              onClick={(event) => {
                event.stopPropagation();
                setShowCafeItems((visible) => !visible);
              }}
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <Coffee className="h-3.5 w-3.5 shrink-0" />
                <span className="shrink-0 font-medium">
                  Last cafe:
                </span>
                <strong className="truncate">
                  {latestCafeItem.name} x
                  {latestCafeItem.quantity}
                </strong>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <strong className="tabular-nums">
                  Rs.{" "}
                  {Math.round(
                    latestCafeItem.subtotal
                  ).toLocaleString()}
                </strong>
                <ChevronDown className="h-3.5 w-3.5" />
              </span>
            </button>

            <Dialog
              open={showCafeItems}
              onOpenChange={setShowCafeItems}
            >
              <DialogContent
                className="flex max-h-[min(78vh,620px)] w-[min(92vw,520px)] flex-col gap-3 overflow-hidden p-0 sm:max-w-lg"
                onClick={(event) =>
                  event.stopPropagation()
                }
              >
                <DialogHeader className="border-b px-5 py-4 pr-12">
                  <DialogTitle className="flex items-center gap-2 text-lg">
                    <Coffee className="h-5 w-5 text-emerald-700" />
                    Cafe Items
                  </DialogTitle>
                  <DialogDescription>
                    Items currently attached to each
                    player&apos;s bill.
                  </DialogDescription>
                </DialogHeader>

                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 pb-2">
                  {cafeItemsByPlayer.map((player) => (
                    <section
                      key={player.key}
                      className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950"
                    >
                      <div className="flex items-center justify-between gap-3 border-b bg-slate-50 px-3 py-2.5 dark:bg-slate-900">
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium uppercase text-slate-500">
                            Player / Customer
                          </p>
                          <p
                            className="truncate font-bold text-slate-950 dark:text-white"
                            title={player.name}
                          >
                            {player.name}
                          </p>
                        </div>
                        <strong className="shrink-0 whitespace-nowrap tabular-nums text-emerald-700 dark:text-emerald-300">
                          Rs.{" "}
                          {Math.round(
                            player.subtotal
                          ).toLocaleString()}
                        </strong>
                      </div>

                      <div>
                        {player.items.map((item) => (
                          <div
                            key={`${player.key}-${item.id}-${item.price}`}
                            className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-slate-100 px-3 py-2.5 text-sm last:border-b-0 dark:border-slate-800"
                          >
                            <span
                              className="truncate font-medium text-slate-800 dark:text-slate-100"
                              title={item.name}
                            >
                              {item.name}
                            </span>
                            <span className="whitespace-nowrap text-slate-500 dark:text-slate-400">
                              x{item.quantity}
                            </span>
                            <strong className="whitespace-nowrap tabular-nums text-slate-950 dark:text-white">
                              Rs.{" "}
                              {Math.round(
                                item.subtotal
                              ).toLocaleString()}
                            </strong>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>

                <div className="flex items-center justify-between border-t bg-emerald-50 px-5 py-3 dark:bg-emerald-950/30">
                  <span className="font-semibold text-emerald-800 dark:text-emerald-200">
                    Cafe total
                  </span>
                  <strong className="text-lg tabular-nums text-emerald-800 dark:text-emerald-200">
                    Rs.{" "}
                    {Math.round(cafeTotal).toLocaleString()}
                  </strong>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>
    </div>
  );
}

export default TableInfo;
