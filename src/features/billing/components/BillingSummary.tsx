import type { Session } from "@/types/session";

import { calculateGamePrice } from "@/features/pricing/utils/calculateGamePrice";
import { calculateBill } from "@/features/pricing/utils/calculateBill";
import type { CafeOrderItem } from "@/types/session";

interface Props {
  session: Session;
  payerName?: string;
}

function BillingSummary({
  session,
  payerName,
}: Props) {
  if (!session.endTime) return null;

  const pricing = calculateGamePrice({
    sessionType: session.sessionType,
    tableType: "table", // Temporary, we'll replace this with the actual table type later
    startTime: new Date(session.startTime),
    endTime: new Date(session.endTime),
  });

  const bill = calculateBill({
    gameAmount: pricing.gameAmount,
    cafeAmount: session.cafeAmount,
    discount: session.discount,
  });

  const players = [
    session.player1?.trim() ||
      "Walk-in Customer",
    session.player2?.trim(),
  ].filter(Boolean) as string[];

  const getItemPlayerName = (
    item: CafeOrderItem
  ) =>
    item.playerName ??
    item.customerName ??
    "";

  const playerBreakdown = players.map(
    (playerName) => {
      const cafeItems =
        session.cafeOrders.filter(
          (item) =>
            getItemPlayerName(item) ===
            playerName
        );
      const cafeAmount =
        cafeItems.reduce(
          (total, item) =>
            total + item.subtotal,
          0
        );
      const tableAmountShare =
        (payerName ??
          session.payerName ??
          "Walk-in Customer") ===
        playerName
          ? pricing.gameAmount
          : 0;

      return {
        playerName,
        cafeItems,
        cafeAmount,
        tableAmountShare,
        totalAmount:
          cafeAmount +
          tableAmountShare,
      };
    }
  );

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex justify-between">
        <span>Started</span>
        <span>
          {new Date(session.startTime).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>

      <div className="flex justify-between">
        <span>Ended</span>
        <span>
          {new Date(session.endTime).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>

      <div className="flex justify-between">
        <span>Duration</span>
        <span>{pricing.duration.formatted}</span>
      </div>

      <hr />

      <div className="flex justify-between">
        <span>Player 1</span>
        <span>
          {session.player1 || "Walk-in Customer"}
        </span>
      </div>

      {session.player2 && (
        <div className="flex justify-between">
          <span>Player 2</span>
          <span>{session.player2}</span>
        </div>
      )}

      <div className="flex justify-between">
        <span>Winner</span>
        <span>{session.winnerName ?? "-"}</span>
      </div>

      <div className="flex justify-between">
        <span>Loser</span>
        <span>{session.loserName ?? "-"}</span>
      </div>

      <div className="flex justify-between font-semibold">
        <span>Payer</span>
        <span>{payerName ?? session.payerName ?? "-"}</span>
      </div>

      <hr />

      <div className="space-y-3">
        <p className="font-semibold">
          Player-wise breakdown
        </p>

        {playerBreakdown.map((player) => (
          <div
            key={player.playerName}
            className="rounded-lg border bg-slate-50 p-3"
          >
            <div className="mb-2 flex justify-between font-semibold">
              <span>{player.playerName}</span>
              <span>
                Rs. {player.totalAmount}
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span>Game/Table Bill</span>
              <span>
                Rs. {player.tableAmountShare}
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span>Cafe Bill</span>
              <span>
                Rs. {player.cafeAmount}
              </span>
            </div>

            {player.cafeItems.length > 0 && (
              <div className="mt-2 space-y-1 border-t pt-2">
                {player.cafeItems.map((item) => (
                  <div
                    key={`${player.playerName}-${item.menuItemId}-${item.name}`}
                    className="flex justify-between text-sm text-slate-600"
                  >
                    <span>
                      {item.name} x{item.quantity}
                    </span>
                    <span>
                      Rs. {item.subtotal}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <hr />

      <div className="flex justify-between">
        <span>Table bill</span>
        <span>Rs. {pricing.gameAmount}</span>
      </div>

      <div className="flex justify-between">
        <span>Cafe bill</span>
        <span>Rs. {session.cafeAmount}</span>
      </div>

      <div className="flex justify-between">
        <span>Discount</span>
        <span>- Rs. {session.discount}</span>
      </div>

      <hr />

      <div className="flex justify-between text-xl font-bold">
        <span>Total</span>
        <span>Rs. {bill.total}</span>
      </div>
    </div>
  );
}

export default BillingSummary;
