import type { Session } from "@/types/session";

import { calculateGamePrice } from "@/features/pricing/utils/calculateGamePrice";
import { calculateBill } from "@/features/pricing/utils/calculateBill";

interface Props {
  session: Session;
}

function BillingSummary({
  session,
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
        <span>Game</span>
        <span>Rs. {pricing.gameAmount}</span>
      </div>

      <div className="flex justify-between">
        <span>Cafe</span>
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
