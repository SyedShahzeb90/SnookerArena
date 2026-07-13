import type { Session } from "@/types/session";

export function getSessionPlayers(
  session: Session
) {
  if (
    session.sessionType === "time" ||
    session.sessionType === "private"
  ) {
    const players = [
      session.player1,
      ...(session.extraPlayers ?? []),
    ]
      .map((player) => player?.trim())
      .filter(Boolean) as string[];

    return players.length > 0
      ? players
      : ["Walk-in Customer"];
  }

  const players = [
    session.player1,
    session.player2,
    session.player3,
    session.player4,
  ]
    .map((player) => player?.trim())
    .filter(Boolean) as string[];

  return players.length > 0
    ? players
    : ["Walk-in Customer"];
}
