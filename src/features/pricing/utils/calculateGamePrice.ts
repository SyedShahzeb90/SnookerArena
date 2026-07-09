import { calculateDuration } from "@/features/pricing/utils/calculateDuration";

import type { SessionType } from "@/types/session";
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
