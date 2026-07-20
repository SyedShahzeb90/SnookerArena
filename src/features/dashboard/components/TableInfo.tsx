import {
  Clock,
  Coffee,
  CircleDollarSign,
  Package,
  Users,
} from "lucide-react";

import type { Session } from "@/types/session";
import type { Table } from "@/types/table";
import { calculateBill } from "@/features/pricing/utils/calculateBill";
import { calculateGamePrice } from "@/features/pricing/utils/calculateGamePrice";
import { getSessionPlayers } from "@/features/sessions/utils/sessionPlayers";
import { useCustomerAccountStore } from "@/features/customers/store/customerAccountStore";
import type { CustomerAccount } from "@/features/customers/types/customerAccount";
import { getRunningBillTotals } from "@/features/dashboard/utils/runningBillTotals";
import { getDoubleGameTeams } from "@/features/sessions/utils/doubleGameBilling";

interface Props {
  session: Session;
  tableId?: number;
  tableType: Table["type"];
  now: Date;
  compactRunning?: boolean;
  onCafeBillClick?: () => void;
  onAccessoriesClick?: () => void;
}

function TableInfo({
  session,
  tableId,
  tableType,
  now,
  compactRunning = false,
  onCafeBillClick,
  onAccessoriesClick,
}: Props) {
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
        account.status === "active" &&
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
  const tableChargeTotal =
    tableChargeLines.length > 0
      ? tableChargeLines.reduce(
          (total, line) => {
            if (
              line.type === "tableBooking" &&
              !line.endedAt
            ) {
              const rate =
                tableType === "private-room"
                  ? 25
                  : 20;
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
            {new Date(session.startTime).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
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
            <p className="text-xl font-bold text-black">Rs. {currentBill}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2.5">
      <div className="col-span-2 rounded-lg bg-slate-50 p-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-500">
          <Users className="h-4 w-4" />
          {doubleTeams ? "Teams" : "Players"}
        </div>

        {isBooking ? (
          <p className="font-semibold text-slate-950">
            {bookingLabel}
          </p>
        ) : doubleTeams ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-slate-500">Team A</p>
              <p className="truncate font-semibold text-slate-950">
                {doubleTeams.teamAPlayers.join(" / ")}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Team B</p>
              <p className="truncate font-semibold text-slate-950">
                {doubleTeams.teamBPlayers.join(" / ")}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {sessionPlayers.map((player, index) => (
              <div key={player}>
                <p className="text-xs text-slate-500">
                  Player {index + 1}
                </p>
                <p className="truncate font-semibold text-slate-950">
                  {player}
                </p>
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
          {new Date(
            session.startTime
          ).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>

      </div>

      <div className="rounded-lg bg-slate-50 p-3">
        <p className="text-xs font-medium text-slate-500">Current game</p>
        <p className="mt-1 font-semibold text-slate-950">
          {getGameCountLabel() ?? session.sessionType}
        </p>
      </div>

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

          <p className="text-2xl font-bold tabular-nums text-slate-950">
            Rs. {Math.round(currentBill).toLocaleString()}
          </p>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 border-t pt-2 text-sm text-slate-500">
          <span className="min-w-0">Table <strong className="block truncate text-base font-bold tabular-nums text-slate-800">Rs. {Math.round(tableBill).toLocaleString()}</strong></span>
          <span className="min-w-0">Cafe <strong className="block truncate text-base font-bold tabular-nums text-slate-800">Rs. {Math.round(cafeTotal).toLocaleString()}</strong></span>
          <span className="min-w-0">Accessories <strong className="block truncate text-base font-bold tabular-nums text-slate-800">Rs. {Math.round(accessoriesTotal).toLocaleString()}</strong></span>
        </div>
        {latestCafeItem && (
          <div className="mt-2 flex items-center justify-between gap-3 rounded-md bg-emerald-50 px-2.5 py-2 text-xs text-emerald-800">
            <span className="flex min-w-0 items-center gap-1.5">
              <Coffee className="h-3.5 w-3.5 shrink-0" />
              <span className="shrink-0 font-medium">Last cafe:</span>
              <strong className="truncate">{latestCafeItem.name} x{latestCafeItem.quantity}</strong>
            </span>
            <strong className="shrink-0 tabular-nums">
              Rs. {Math.round(latestCafeItem.subtotal).toLocaleString()}
            </strong>
          </div>
        )}
      </div>
    </div>
  );
}

export default TableInfo;
