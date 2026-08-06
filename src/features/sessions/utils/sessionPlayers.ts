import type { Session } from "@/types/session";

export function getSessionParticipantKey(
  sessionId: string,
  slot: string
) {
  return `${sessionId}:${slot}`;
}

export function getSessionPlayerEntries(session: Session) {
  if (
    session.sessionType === "time" ||
    session.sessionType === "private"
  ) {
    return [
      {
        slot: "player1" as const,
        name: session.player1?.trim() || "Walk-in Customer",
        customerId: session.player1CustomerId,
      },
      ...(session.extraPlayers ?? []).map((name, index) => ({
        slot: `extra-${index}` as const,
        name: name.trim(),
        customerId:
          session.extraPlayerCustomerIds?.[index] ||
          undefined,
      })),
    ].filter((player) => player.name);
  }

  return [
    { slot: "player1" as const, name: session.player1, customerId: session.player1CustomerId },
    { slot: "player2" as const, name: session.player2, customerId: session.player2CustomerId },
    { slot: "player3" as const, name: session.player3, customerId: session.player3CustomerId },
    { slot: "player4" as const, name: session.player4, customerId: session.player4CustomerId },
  ]
    .map((player) => ({ ...player, name: player.name?.trim() ?? "" }))
    .filter((player) => player.name);
}

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

  const players = getSessionPlayerEntries(session).map(
    (player) => player.name
  );

  return players.length > 0
    ? players
    : ["Walk-in Customer"];
}
