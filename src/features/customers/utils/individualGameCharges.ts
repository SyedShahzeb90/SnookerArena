import { normalizePlayerName } from "@/features/cafe/utils/playerIdentity";
import type { TableChargeLine } from "@/types/session";
import type {
  CustomerGameCharge,
  CustomerGameChargeLine,
} from "../types/customerAccount";

interface ChargeLineSource {
  sessionId: string;
  tableChargeLines?: TableChargeLine[];
}

function sessionTypeForLine(line: TableChargeLine): CustomerGameChargeLine["sessionType"] {
  if (line.type === "singleGame") return "single";
  if (line.type === "doubleGame") return "double";
  return "time";
}

function attributedAmount(charge: CustomerGameCharge, line: TableChargeLine) {
  const effect = line.settlement?.find(
    (item) =>
      (charge.payerCustomerId && item.customerId === charge.payerCustomerId) ||
      normalizePlayerName(item.customerName) === normalizePlayerName(charge.payerName)
  );
  if (!effect) return line.amount;

  const rate = line.type === "doubleGame"
    ? (line.unitRate ?? line.amount) / 2
    : line.unitRate ?? line.amount;
  return effect.payableGamesDelta * rate;
}

function fromTableLine(
  charge: CustomerGameCharge,
  line: TableChargeLine
): CustomerGameChargeLine {
  return {
    id: line.id,
    sessionId: charge.sessionId,
    sessionType: sessionTypeForLine(line),
    startedAt: line.startedAt,
    endedAt: line.endedAt,
    durationMinutes: line.durationMinutes,
    amount: attributedAmount(charge, line),
    winnerName: line.winnerName,
    loserName: line.loserName,
    payerName: line.payerName ?? charge.payerName,
    payerCustomerId: line.payerCustomerId ?? charge.payerCustomerId,
    winningTeam: line.winningTeam,
    losingTeam: line.losingTeam,
    isFinal: line.isFinal,
    finalGames: line.finalGames,
  };
}

function fromCombinedCharge(charge: CustomerGameCharge): CustomerGameChargeLine {
  return {
    id: charge.id,
    sessionId: charge.sessionId,
    sessionType: charge.sessionType,
    startedAt: charge.startedAt,
    endedAt: charge.endedAt,
    durationMinutes: charge.durationMinutes,
    amount: charge.amount,
    winnerName: charge.winnerName,
    loserName: charge.loserName,
    payerName: charge.payerName,
    payerCustomerId: charge.payerCustomerId,
    winningTeam: charge.winningTeam,
    losingTeam: charge.losingTeam,
    isFinal: charge.isFinal,
    finalGames: charge.finalGames,
  };
}

export function getIndividualGameCharges(
  charges: CustomerGameCharge[],
  sources: ChargeLineSource[] = []
) {
  return charges.flatMap((charge) => {
    if (charge.lineCharges?.length) return charge.lineCharges;

    if (charge.sourceFrameIds?.length) {
      const source = sources.find((item) => item.sessionId === charge.sessionId);
      const frameIds = new Set(charge.sourceFrameIds);
      const sourceLines = source?.tableChargeLines?.filter((line) => frameIds.has(line.id));
      if (sourceLines?.length) return sourceLines.map((line) => fromTableLine(charge, line));
    }

    return [fromCombinedCharge(charge)];
  });
}
