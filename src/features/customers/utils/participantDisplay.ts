import type { TableHistoryRecord } from "@/features/table-history/types/tableHistory";
import type { Session } from "@/types/session";

import { getSessionPlayerEntries } from "@/features/sessions/utils/sessionPlayers";

type ParticipantIdentity = {
  slot: string;
  name: string;
  customerId?: string;
};

function compareParticipantSlots(a: ParticipantIdentity, b: ParticipantIdentity) {
  const getSlotRank = (slot: string) => {
    const playerMatch = /^player(\d+)$/i.exec(slot);
    if (playerMatch) return Number(playerMatch[1]);
    return Number.MAX_SAFE_INTEGER;
  };

  const rankDifference = getSlotRank(a.slot) - getSlotRank(b.slot);
  return rankDifference || a.slot.localeCompare(b.slot);
}

export function normalizeParticipantDisplayName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function formatDuplicateParticipantLabel(
  participant: ParticipantIdentity,
  participants: ParticipantIdentity[]
) {
  const cleanName = participant.name.trim().replace(/\s+/g, " ");
  const normalizedName = normalizeParticipantDisplayName(cleanName);
  const duplicates = participants.filter(
    (candidate) =>
      normalizeParticipantDisplayName(candidate.name) === normalizedName
  ).sort(compareParticipantSlots);

  if (duplicates.length < 2) return cleanName;

  const duplicateIndex = duplicates.findIndex(
    (candidate) => candidate.slot === participant.slot
  );

  return duplicateIndex >= 0
    ? `${cleanName} #${duplicateIndex + 1}`
    : cleanName;
}

export function getSessionParticipantDisplayLabel(
  session: Session,
  slot: string
) {
  const participants = getSessionPlayerEntries(session);
  const participant = participants.find((item) => item.slot === slot);

  if (!participant) return "";

  return formatDuplicateParticipantLabel(participant, participants);
}

export function getHistoryParticipants(
  record: TableHistoryRecord
): ParticipantIdentity[] {
  return [
    {
      slot: "player1",
      name: record.player1Name,
      customerId: record.player1CustomerId,
    },
    {
      slot: "player2",
      name: record.player2Name ?? "",
      customerId: record.player2CustomerId,
    },
    {
      slot: "player3",
      name: record.player3Name ?? "",
      customerId: record.player3CustomerId,
    },
    {
      slot: "player4",
      name: record.player4Name ?? "",
      customerId: record.player4CustomerId,
    },
  ].filter((participant) => participant.name.trim());
}

export function getHistoryParticipantDisplayLabel(
  record: TableHistoryRecord,
  customerId?: string
) {
  if (!customerId) return undefined;

  const participants = getHistoryParticipants(record);
  const participant = participants.find(
    (item) => item.customerId === customerId
  );

  if (!participant) return undefined;

  return formatDuplicateParticipantLabel(participant, participants);
}

export function getStableParticipantDisplayLabel({
  name,
  customerId,
  sessionId,
  historyRecords,
}: {
  name: string;
  customerId?: string;
  sessionId?: string;
  historyRecords: TableHistoryRecord[];
}) {
  if (!customerId || !sessionId) return name;

  const record = historyRecords.find(
    (item) => item.sessionId === sessionId
  );

  return (
    (record &&
      getHistoryParticipantDisplayLabel(record, customerId)) ||
    name
  );
}

export function getHistoryChargeParticipantDisplayLabel({
  name,
  role,
  chargeId,
  sessionId,
  fallbackCustomerId,
  historyRecords,
}: {
  name?: string;
  role: "winner" | "loser" | "payer";
  chargeId: string;
  sessionId: string;
  fallbackCustomerId?: string;
  historyRecords: TableHistoryRecord[];
}) {
  if (!name) return undefined;

  const record = historyRecords.find(
    (item) => item.sessionId === sessionId
  );
  const line = record?.tableChargeLines?.find(
    (item) => item.id === chargeId
  );
  const customerId =
    role === "winner"
      ? line?.winnerCustomerId
      : role === "loser"
        ? line?.loserCustomerId
        : line?.payerCustomerId ?? fallbackCustomerId;

  if (!record || !customerId) return name;

  return (
    getHistoryParticipantDisplayLabel(record, customerId) ??
    name
  );
}
