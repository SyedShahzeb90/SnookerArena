export function normalizePlayerName(value?: string | null) {
  return (value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function getPlayerIdentityKey(input: {
  customerId?: string;
  playerName?: string | null;
}) {
  const customerId = input.customerId?.trim();

  if (customerId) {
    return `customer:${customerId}`;
  }

  return `name:${normalizePlayerName(input.playerName)}`;
}

export function isSamePlayerIdentity(
  first: {
    customerId?: string;
    playerId?: string;
    playerKey?: string;
    playerName?: string | null;
  },
  second: {
    customerId?: string;
    playerId?: string;
    playerKey?: string;
    playerName?: string | null;
  }
) {
  const firstId =
    first.customerId?.trim() || first.playerId?.trim();
  const secondId =
    second.customerId?.trim() || second.playerId?.trim();

  if (firstId && secondId) {
    return firstId === secondId;
  }

  const firstKey =
    first.playerKey ??
    getPlayerIdentityKey({
      customerId: firstId,
      playerName: first.playerName,
    });
  const secondKey =
    second.playerKey ??
    getPlayerIdentityKey({
      customerId: secondId,
      playerName: second.playerName,
    });

  return firstKey === secondKey;
}
