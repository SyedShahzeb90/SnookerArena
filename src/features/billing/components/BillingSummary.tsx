import type { Session } from "@/types/session";
import type { Table } from "@/types/table";
import { getSessionPlayers } from "@/features/sessions/utils/sessionPlayers";

import { calculateGamePrice } from "@/features/pricing/utils/calculateGamePrice";
import { calculateBill } from "@/features/pricing/utils/calculateBill";
import type { CafeOrderItem } from "@/types/session";
import {
  calculateDoubleGamePayerBreakdown,
} from "@/features/sessions/utils/doubleGameBilling";
import { getWalkInDisplayName } from "@/features/sessions/utils/walkInLabel";

interface Props {
  session: Session;
  tableType: Table["type"];
  tableName?: string;
  billNumber?: string;
  status?: string;
  payerName?: string;
  playerName?: string;
}

function BillingSummary({
  session,
  tableType,
  tableName,
  billNumber,
  status,
  payerName,
  playerName,
}: Props) {
  if (!session.endTime) return null;

  const pricing = calculateGamePrice({
    sessionType: session.sessionType,
    tableType,
    startTime: new Date(session.startTime),
    endTime: new Date(session.endTime),
  });

  const bill = calculateBill({
    gameAmount: pricing.gameAmount,
    cafeAmount: session.cafeAmount,
    discount: session.discount,
  });
  const sessionTypeLabel =
    session.sessionType === "single"
      ? "Single Game"
      : session.sessionType === "double"
        ? "Double Game"
        : session.sessionType === "time"
          ? "Table Booking"
          : "Private Room Booking";
  const tableLabel =
    tableName ?? `Table ${session.tableId}`;
  const cafeItems = session.cafeOrders;
  const cafeItemsTotal =
    cafeItems.reduce(
      (total, item) =>
        total + item.subtotal,
      0
    );
  const showMissingCafeWarning =
    session.cafeAmount > 0 &&
    cafeItems.length === 0;

  const players =
    getSessionPlayers(session);

  const getItemPlayerName = (
    item: CafeOrderItem
  ) =>
    item.playerName ??
    item.customerName ??
    "";

  const payerBreakdown =
    calculateDoubleGamePayerBreakdown({
      session: {
        ...session,
        payerName:
          payerName ??
          session.payerName,
      },
      tableAmount: pricing.gameAmount,
    });

  const playerBreakdown = players
    .map((currentPlayerName) => {
      const cafeItems =
        session.cafeOrders.filter(
          (item) =>
            getItemPlayerName(item) ===
            currentPlayerName
        );
      const cafeAmount =
        cafeItems.reduce(
          (total, item) =>
            total + item.subtotal,
          0
        );
      const tableAmountShare =
        payerBreakdown.find(
          (payer) =>
            payer.playerName ===
            currentPlayerName
        )?.tableAmountShare ?? 0;

      return {
        playerName: currentPlayerName,
        cafeItems,
        cafeAmount,
        tableAmountShare,
        totalAmount:
          cafeAmount +
          tableAmountShare,
      };
    })
    .filter(
      (player) =>
        !playerName ||
        player.playerName === playerName
    );
  const displayTotal = playerName
    ? Math.max(
        playerBreakdown.reduce(
          (total, player) =>
            total + player.totalAmount,
          0
        ) - session.discount,
        0
      )
    : bill.total;
  const displayCustomer =
    getWalkInDisplayName({
      name:
        playerName ??
        payerName ??
        session.payerName ??
        session.loserName ??
        session.player1,
      tableId: session.tableId,
      tableName,
      tableType,
      time: session.startTime,
    });
  const displayPlayers =
    players.length > 0
      ? players
          .map((player) =>
            getWalkInDisplayName({
              name: player,
              tableId: session.tableId,
              tableName,
              tableType,
              time: session.startTime,
            })
          )
          .join(", ")
      : displayCustomer;

  return (
    <div className="space-y-4 rounded-lg border bg-white p-4">
      <section className="rounded-lg bg-slate-50 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">
              Customer
            </p>
            <h3 className="mt-1 text-lg font-bold text-slate-950">
              {displayCustomer}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {tableLabel}
              {billNumber ? ` | ${billNumber}` : ""}
            </p>
          </div>

          {status && (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-200">
              {status}
            </span>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <p className="text-sm font-semibold text-slate-950">
          Snooker
        </p>

        <div className="rounded-lg border border-slate-200 p-3">
          <div className="flex justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-950">
                {sessionTypeLabel}
              </p>
              <p className="text-sm text-slate-500">
                {tableLabel} | {displayPlayers}
              </p>
            </div>
            <p className="font-bold text-slate-950">
              Rs. {pricing.gameAmount}
            </p>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 rounded-md bg-slate-50 p-3 text-center text-xs text-slate-500">
            <div>
              <p>In</p>
              <p className="mt-1 font-semibold text-slate-950">
                {new Date(session.startTime).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <div>
              <p>Out</p>
              <p className="mt-1 font-semibold text-slate-950">
                {new Date(session.endTime).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <div>
              <p>Duration</p>
              <p className="mt-1 font-semibold text-slate-950">
                {pricing.duration.formatted}
              </p>
            </div>
          </div>
        </div>

        {session.sessionType === "double" &&
          payerBreakdown.length > 1 && (
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-700">
                Split Amount
              </p>
              <div className="mt-2 space-y-1">
                {payerBreakdown.map((payer) => (
                  <div
                    key={payer.playerName}
                    className="flex justify-between text-sm"
                  >
                    <span>
                      {getWalkInDisplayName({
                        name: payer.playerName,
                        tableId: session.tableId,
                        tableName,
                        tableType,
                        time: session.startTime,
                      })}
                    </span>
                    <span className="font-semibold">
                      Rs. {payer.tableAmountShare}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
      </section>

      <section className="space-y-3">
        <p className="text-sm font-semibold text-slate-950">
          Cafe
        </p>

        {cafeItems.length > 0 ? (
          <div className="overflow-hidden rounded-lg border">
            {cafeItems.map((item, index) => (
              <div
                key={`${item.menuItemId}-${item.name}-${index}`}
                className="flex justify-between gap-3 border-b px-3 py-2 text-sm last:border-b-0"
              >
                <span>
                  {item.name} x{item.quantity}
                </span>
                <span className="font-semibold">
                  Rs. {item.subtotal}
                </span>
              </div>
            ))}
          </div>
        ) : showMissingCafeWarning ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">
            Cafe item details are missing.
          </p>
        ) : (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">
            No cafe items.
          </p>
        )}
      </section>

      <section className="space-y-2 rounded-lg bg-slate-950 p-4 text-white">
        <div className="flex justify-between text-sm">
          <span>Snooker</span>
          <span>Rs. {pricing.gameAmount}</span>
        </div>

        <div className="flex justify-between text-sm">
          <span>Cafe</span>
          <span>Rs. {cafeItemsTotal || session.cafeAmount}</span>
        </div>

        {session.discount > 0 && (
          <div className="flex justify-between text-sm">
            <span>Discount</span>
            <span>- Rs. {session.discount}</span>
          </div>
        )}

        <div className="flex justify-between border-t border-white/20 pt-3 text-xl font-bold">
          <span>Total</span>
          <span>Rs. {displayTotal}</span>
        </div>
      </section>
    </div>
  );
}

export default BillingSummary;
