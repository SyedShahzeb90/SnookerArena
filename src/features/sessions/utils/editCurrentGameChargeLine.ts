import type {
  TableChargeLine,
  TableChargeLineType,
} from "@/types/session";

interface EditCurrentGameChargeLineInput {
  lines: TableChargeLine[];
  type: Extract<TableChargeLineType, "singleGame" | "doubleGame">;
  singleGameRate: number;
  doubleGameRate: number;
  isFinal: boolean;
  finalGames: number;
}

export function editCurrentGameChargeLine({
  lines,
  type,
  singleGameRate,
  doubleGameRate,
  isFinal,
  finalGames,
}: EditCurrentGameChargeLineInput): TableChargeLine[] {
  const normalizedFinalGames = Number(finalGames);

  if (
    isFinal &&
    (!Number.isInteger(normalizedFinalGames) || normalizedFinalGames < 1)
  ) {
    return lines;
  }

  return lines.map((line, index) => {
    if (
      index !== lines.length - 1 ||
      (line.type !== "singleGame" && line.type !== "doubleGame")
    ) {
      return line;
    }

    const typeChanged = line.type !== type;
    const nextRate =
      type === "doubleGame" ? doubleGameRate : singleGameRate;
    const editableLine = { ...line };

    delete editableLine.settlement;
    delete editableLine.settlementProcessedAt;

    return {
      ...editableLine,
      type,
      label: type === "doubleGame" ? "Double Game" : "Single Game",
      unitRate: typeChanged ? nextRate : line.unitRate,
      amount: typeChanged ? nextRate : line.amount,
      isFinal,
      finalGames: isFinal ? normalizedFinalGames : undefined,
    };
  });
}
