import type { CafeOrderItem, Session } from "@/types/session";
import {
  isSamePlayerIdentity,
  normalizePlayerName,
} from "@/features/cafe/utils/playerIdentity";
import {
  getSessionParticipantKey,
  getSessionPlayerEntries,
} from "@/features/sessions/utils/sessionPlayers";

type PayerBreakdownLine = {
  playerName: string;
  tableAmountShare: number;
};

export interface SessionPlayerBillingIdentity {
  playerName: string;
  customerId?: string;
  participantKey?: string;
}

export function getSessionPlayerCustomerId(
  session: Session,
  playerName: string
) {
  const targetName = normalizePlayerName(playerName);
  const players = [
    {
      name: session.player1,
      customerId: session.player1CustomerId,
    },
    {
      name: session.player2,
      customerId: session.player2CustomerId,
    },
    {
      name: session.player3,
      customerId: session.player3CustomerId,
    },
    {
      name: session.player4,
      customerId: session.player4CustomerId,
    },
  ];

  return players.find(
    (player) =>
      normalizePlayerName(player.name) === targetName
  )?.customerId;
}

export function hasPlayerName(
  playerNames: string[],
  playerName: string
) {
  const targetName = normalizePlayerName(playerName);

  return playerNames.some(
    (name) => normalizePlayerName(name) === targetName
  );
}

export function cafeItemBelongsToPlayer({
  item,
  session,
  player,
}: {
  item: CafeOrderItem;
  session: Session;
  player: string | SessionPlayerBillingIdentity;
}) {
  const playerName =
    typeof player === "string"
      ? player
      : player.playerName;
  const customerId =
    typeof player === "string"
      ? getSessionPlayerCustomerId(session, playerName)
      : player.customerId ??
        getSessionPlayerCustomerId(session, playerName);
  const participantKey =
    typeof player === "string"
      ? undefined
      : player.participantKey;
  const itemPlayerId = item.playerId?.trim();
  const matchingPlayers = getSessionPlayerEntries(session).filter(
    (entry) =>
      normalizePlayerName(entry.name) ===
      normalizePlayerName(playerName)
  );

  if (item.participantKey && participantKey) {
    return item.participantKey === participantKey;
  }

  if (itemPlayerId && customerId) {
    if (itemPlayerId === customerId) return true;

    // A bill/customer can be legitimately reattached while the session slot
    // remains the same. Name fallback is safe only when the name is unique.
    return (
      matchingPlayers.length === 1 &&
      normalizePlayerName(
        item.playerName ?? item.customerName
      ) === normalizePlayerName(playerName)
    );
  }

  if (itemPlayerId && !customerId) {
    return (
      matchingPlayers.length === 1 &&
      normalizePlayerName(
        item.playerName ?? item.customerName
      ) === normalizePlayerName(playerName)
    );
  }

  return isSamePlayerIdentity(
    {
      playerId: item.playerId,
      playerName:
        item.playerName ?? item.customerName,
    },
    {
      customerId,
      playerName,
    }
  ) && matchingPlayers.length <= 1;
}

export function getPlayerCafeItems(
  session: Session,
  player: string | SessionPlayerBillingIdentity
) {
  return session.cafeOrders.filter((item) =>
    cafeItemBelongsToPlayer({
      item,
      session,
      player,
    })
  );
}

export function getPlayerCafeAmount(
  session: Session,
  player: string | SessionPlayerBillingIdentity
) {
  return getPlayerCafeItems(
    session,
    player
  ).reduce(
    (total, item) => total + item.subtotal,
    0
  );
}

export function getSessionPlayerBillingIdentities(
  session: Session
): SessionPlayerBillingIdentity[] {
  return getSessionPlayerEntries(session).map((entry) => ({
    playerName: entry.name,
    customerId: entry.customerId,
    participantKey: getSessionParticipantKey(
      session.id,
      entry.slot
    ),
  }));
}

export function findPayerBreakdownForPlayer(
  payerBreakdown: PayerBreakdownLine[],
  playerName: string
) {
  const targetName = normalizePlayerName(playerName);

  return payerBreakdown.find(
    (payer) =>
      normalizePlayerName(payer.playerName) ===
      targetName
  );
}
