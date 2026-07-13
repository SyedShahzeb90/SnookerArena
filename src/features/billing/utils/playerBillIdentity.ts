import type { CafeOrderItem, Session } from "@/types/session";
import {
  isSamePlayerIdentity,
  normalizePlayerName,
} from "@/features/cafe/utils/playerIdentity";

type PayerBreakdownLine = {
  playerName: string;
  tableAmountShare: number;
};

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
  playerName,
}: {
  item: CafeOrderItem;
  session: Session;
  playerName: string;
}) {
  return isSamePlayerIdentity(
    {
      playerId: item.playerId,
      playerName:
        item.playerName ?? item.customerName,
    },
    {
      customerId: getSessionPlayerCustomerId(
        session,
        playerName
      ),
      playerName,
    }
  );
}

export function getPlayerCafeItems(
  session: Session,
  playerName: string
) {
  return session.cafeOrders.filter((item) =>
    cafeItemBelongsToPlayer({
      item,
      session,
      playerName,
    })
  );
}

export function getPlayerCafeAmount(
  session: Session,
  playerName: string
) {
  return getPlayerCafeItems(
    session,
    playerName
  ).reduce(
    (total, item) => total + item.subtotal,
    0
  );
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
