import type {
  Session,
  TableChargeLine,
} from "@/types/session";

export interface PayerBreakdownItem {
  playerName: string;
  tableAmountShare: number;
  note?: string;
}

export function getTeamPlayers(
  session: Session,
  team: "A" | "B"
) {
  const stored =
    team === "A"
      ? session.teamAPlayers
      : session.teamBPlayers;

  if (stored?.length) {
    return stored
      .map((name) => name.trim())
      .filter(Boolean);
  }

  const players =
    team === "A"
      ? [session.player1, session.player2]
      : [session.player3, session.player4];

  return players
    .map((name) => name?.trim())
    .filter(Boolean) as string[];
}

export function getDoubleGameTeams(
  session: Session
) {
  return {
    teamAPlayers: getTeamPlayers(session, "A"),
    teamBPlayers: getTeamPlayers(session, "B"),
    teamAOneNameEnough:
      session.teamAOneNameEnough ??
      !session.player2,
    teamBOneNameEnough:
      session.teamBOneNameEnough ??
      !session.player4,
  };
}

export function calculateDoubleGamePayerBreakdown({
  session,
  tableAmount,
}: {
  session: Session;
  tableAmount: number;
}): PayerBreakdownItem[] {
  if (session.sessionType !== "double") {
    const payerName =
      session.payerName ??
      session.loserName ??
      session.player1 ??
      "Walk-in Customer";

    return [
      {
        playerName: payerName,
        tableAmountShare: tableAmount,
      },
    ];
  }

  const teams = getDoubleGameTeams(session);
  const losingTeam =
    session.losingTeam ??
    (session.winningTeam === "A" ? "B" : "A");
  const losingPlayers =
    losingTeam === "A"
      ? teams.teamAPlayers
      : teams.teamBPlayers;
  const oneNameEnough =
    losingTeam === "A"
      ? teams.teamAOneNameEnough
      : teams.teamBOneNameEnough;
  const billablePlayers =
    losingPlayers.length > 0
      ? losingPlayers
      : [
          session.loserName ??
            session.payerName ??
            session.player1 ??
            "Walk-in Customer",
        ];

  if (
    oneNameEnough ||
    billablePlayers.length === 1
  ) {
    return [
      {
        playerName: billablePlayers[0],
        tableAmountShare: tableAmount,
        note: oneNameEnough
          ? "One name represents the team"
          : undefined,
      },
    ];
  }

  const share =
    tableAmount / billablePlayers.length;

  return billablePlayers.map((playerName) => ({
    playerName,
    tableAmountShare: share,
  }));
}

export function calculateTableChargeLinePayerBreakdown({
  session,
  line,
}: {
  session: Session;
  line: TableChargeLine;
}): Array<PayerBreakdownItem & { line: TableChargeLine }> {
  if (line.type !== "doubleGame") {
    return [
      {
        line,
        playerName:
          line.payerName ??
          line.loserName ??
          session.payerName ??
          session.loserName ??
          session.player1,
        tableAmountShare: line.amount,
        note: line.label,
      },
    ];
  }

  return calculateDoubleGamePayerBreakdown({
    session: {
      ...session,
      winnerName:
        line.winnerName ?? session.winnerName,
      loserName:
        line.loserName ?? session.loserName,
      payerName:
        line.payerName ?? session.payerName,
      payerCustomerId:
        line.payerCustomerId ??
        session.payerCustomerId,
      winningTeam:
        line.winningTeam ??
        session.winningTeam,
      losingTeam:
        line.losingTeam ??
        session.losingTeam,
    },
    tableAmount: line.amount,
  }).map((payer) => ({
    ...payer,
    line,
    note: payer.note ?? line.label,
  }));
}

export function getPlayerTableShare(
  session: Session,
  playerName: string,
  tableAmount: number
) {
  return calculateDoubleGamePayerBreakdown({
    session,
    tableAmount,
  }).find(
    (payer) =>
      payer.playerName === playerName
  )?.tableAmountShare ?? 0;
}
