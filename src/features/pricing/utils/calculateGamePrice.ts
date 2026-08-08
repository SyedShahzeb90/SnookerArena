import { calculateDuration } from "@/features/pricing/utils/calculateDuration";

import type { Session, SessionType } from "@/types/session";
import type { Table } from "@/types/table";

const SINGLE_FRAME_PRICE = 300;
const DOUBLE_FRAME_PRICE = 600;

const TABLE_RATE_PER_MINUTE = 20;
const PRIVATE_ROOM_RATE_PER_MINUTE = 25;

interface Props {
  sessionType: SessionType;
  tableType: Table["type"];
  startTime: Date;
  endTime: Date;
}

export interface PricingResult {
  duration: ReturnType<typeof calculateDuration>;
  gameAmount: number;
}

export function calculateGamePrice({
  sessionType,
  tableType,
  startTime,
  endTime,
}: Props): PricingResult {
  const duration = calculateDuration(
    startTime,
    endTime
  );

  let gameAmount = 0;
  const tableRate =
    tableType === "private-room"
      ? PRIVATE_ROOM_RATE_PER_MINUTE
      : TABLE_RATE_PER_MINUTE;

  switch (sessionType) {
    case "single":
      gameAmount = SINGLE_FRAME_PRICE;
      break;

    case "double":
      gameAmount = DOUBLE_FRAME_PRICE;
      break;

    case "time":
    case "century":
      gameAmount =
        duration.totalMinutes *
        tableRate;
      break;

    case "private":
      gameAmount =
        duration.totalMinutes *
        PRIVATE_ROOM_RATE_PER_MINUTE;
      break;
  }

  return {
    duration,
    gameAmount,
  };
}

export function getStoredSessionGameAmount(
  session: Session,
  tableType: Table["type"],
  endTime = session.endTime ? new Date(session.endTime) : new Date()
) {
  if (session.settledTableAmount !== undefined) {
    return session.settledTableAmount;
  }
  const lines = session.tableChargeLines ?? [];
  if (lines.length > 0) {
    return lines.reduce((total, line) => {
      if (line.type !== "tableBooking" || line.endedAt) {
        return total + line.amount;
      }
      const minutes = Math.max(
        1,
        Math.ceil(
          (endTime.getTime() - new Date(line.startedAt).getTime()) / 60000
        )
      );
      return total + minutes * (line.unitRate ?? (tableType === "private-room" ? 25 : 20));
    }, 0);
  }
  return calculateGamePrice({
    sessionType: session.sessionType,
    tableType,
    startTime: new Date(session.startTime),
    endTime,
  }).gameAmount;
}
