import { normalizePlayerName } from "@/features/cafe/utils/playerIdentity";
import { getTeamPlayers } from "@/features/sessions/utils/doubleGameBilling";
import type { FrameSettlementEffect, Session, TableChargeLine } from "@/types/session";

export interface FinalSettlementOwner {
  key: string;
  customerId?: string;
  participantKey?: string;
  customerName: string;
  payableGames: number;
  advanceGames: number;
  sourceFrameIds: string[];
}

export interface FinalSettlementResult {
  owners: FinalSettlementOwner[];
  lines: TableChargeLine[];
  originalGameCount: number;
  originalTableAmount: number;
}

interface OwnerPosition {
  key: string;
  customerId?: string;
  participantKey?: string;
  customerName: string;
  positions: number;
}

function customerForName(session: Session, name: string) {
  const normalized = normalizePlayerName(name);
  return [
    [session.player1, session.player1CustomerId],
    [session.player2, session.player2CustomerId],
    [session.player3, session.player3CustomerId],
    [session.player4, session.player4CustomerId],
    ...(session.extraPlayers ?? []).map((player, index) => [
      player,
      session.extraPlayerCustomerIds?.[index],
    ]),
  ].find(([candidate]) => normalizePlayerName(candidate) === normalized);
}

function owner(
  name: string,
  customerId?: string,
  positions = 1,
  participantKey?: string
): OwnerPosition {
  return {
    key:
      customerId ||
      participantKey ||
      `name:${normalizePlayerName(name)}`,
    customerId,
    participantKey,
    customerName: name,
    positions,
  };
}

function teamEntries(session: Session, team: "A" | "B") {
  const extraPerTeam = (session.centuryTeamSize ?? 2) - 2;
  const entries = team === "A"
      ? [
        { name: session.player1, customerId: session.player1CustomerId },
        { name: session.player2, customerId: session.player2CustomerId },
        ...(session.sessionType === "century"
          ? (session.extraPlayers ?? []).slice(0, extraPerTeam).map((name, index) => ({
              name,
              customerId: session.extraPlayerCustomerIds?.[index],
            }))
          : []),
      ]
    : [
        { name: session.player3, customerId: session.player3CustomerId },
        { name: session.player4, customerId: session.player4CustomerId },
        ...(session.sessionType === "century"
          ? (session.extraPlayers ?? []).slice(extraPerTeam).map((name, index) => ({
              name,
              customerId: session.extraPlayerCustomerIds?.[extraPerTeam + index],
            }))
          : []),
      ];

  return entries.filter(
    (entry): entry is { name: string; customerId: string | undefined } =>
      Boolean(entry.name?.trim())
  );
}

function teamOwners(session: Session, team: "A" | "B"): OwnerPosition[] {
  const names = getTeamPlayers(session, team);
  const entries = teamEntries(session, team);
  const oneName = team === "A" ? session.teamAOneNameEnough : session.teamBOneNameEnough;
  const combinedId = team === "A" ? session.teamABillOwnerCustomerId : session.teamBBillOwnerCustomerId;
  const combinedName = team === "A" ? session.teamABillOwnerName : session.teamBBillOwnerName;

  if (combinedId || combinedName) {
    return [owner(combinedName || names[0] || "Walk-in Customer", combinedId, 2)];
  }
  if (oneName || entries.length <= 1) {
    const representativeName =
      entries[0]?.name || names[0] || "Walk-in Customer";
    return [owner(representativeName, entries[0]?.customerId, 2)];
  }
  return entries.map((entry) =>
    owner(entry.name, entry.customerId, 1)
  );
}

function singleOwners(session: Session, line: TableChargeLine) {
  const loserName = line.loserName || line.payerName || session.loserName || session.player1;
  const loserMatch = customerForName(session, loserName);
  const loser = owner(
    loserName,
    line.loserCustomerId ||
      line.payerCustomerId ||
      loserMatch?.[1],
    1,
    line.loserParticipantKey
  );
  const winnerName = line.winnerName || [session.player1, session.player2]
    .filter(Boolean)
    .find((name) => normalizePlayerName(name) !== normalizePlayerName(loserName));
  const winnerMatch = winnerName ? customerForName(session, winnerName) : undefined;
  return {
    loser,
    winner: winnerName
      ? owner(
          winnerName,
          line.winnerCustomerId ||
            winnerMatch?.[1],
          1,
          line.winnerParticipantKey
        )
      : undefined,
  };
}

export function calculateFinalSettlement(session: Session, sourceLines?: TableChargeLine[]): FinalSettlementResult {
  const lines = (Array.isArray(sourceLines) ? sourceLines : session.tableChargeLines ?? [])
    .filter((line) => line.type === "singleGame" || line.type === "doubleGame")
    .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
  const balances = new Map<string, FinalSettlementOwner>();

  const getBalance = (item: OwnerPosition) => {
    const existing = balances.get(item.key);
    if (existing) return existing;
    const created: FinalSettlementOwner = { ...item, payableGames: 0, advanceGames: 0, sourceFrameIds: [] };
    balances.set(item.key, created);
    return created;
  };
  const addPayable = (item: OwnerPosition, games: number, frameId: string) => {
    const balance = getBalance(item);
    const advanceReduction = Math.min(balance.advanceGames, games);
    const payableIncrease = games - advanceReduction;
    balance.advanceGames -= advanceReduction;
    balance.payableGames += payableIncrease;
    if (!balance.sourceFrameIds.includes(frameId)) balance.sourceFrameIds.push(frameId);
    return {
      payableGamesDelta: payableIncrease,
      advanceGamesDelta: -advanceReduction,
    };
  };
  const reducePayable = (item: OwnerPosition, games: number, frameId: string) => {
    const balance = getBalance(item);
    const reduction = Math.min(balance.payableGames, games);
    balance.payableGames -= reduction;
    balance.advanceGames += games - reduction;
    if (!balance.sourceFrameIds.includes(frameId)) balance.sourceFrameIds.push(frameId);
    return { payableGamesDelta: -reduction, advanceGamesDelta: games - reduction };
  };

  const settledLines = lines.map((line) => {
    if (!line.loserName && !line.losingTeam) return line;
    const parsedFinalGames = Number(line.finalGames);
    const finalGames =
      line.isFinal &&
      Number.isInteger(parsedFinalGames) &&
      parsedFinalGames > 0
        ? parsedFinalGames
        : 0;
    const effects: FrameSettlementEffect[] = [];
    if (line.type === "singleGame") {
      const { loser, winner } = singleOwners(session, line);
      const loss = addPayable(loser, 1 + finalGames, line.id);
      effects.push({ customerId: loser.customerId || loser.key, participantKey: loser.participantKey, customerName: loser.customerName, role: "loser", ...loss });
      if (finalGames > 0 && winner) {
        const win = reducePayable(winner, finalGames, line.id);
        effects.push({ customerId: winner.customerId || winner.key, participantKey: winner.participantKey, customerName: winner.customerName, role: "winner", ...win });
      }
    } else {
      const losingTeam = line.losingTeam || (line.winningTeam === "A" ? "B" : "A");
      const winningTeam = losingTeam === "A" ? "B" : "A";
      teamOwners(session, losingTeam).forEach((loser) => {
        const loss = addPayable(loser, loser.positions * (1 + finalGames), line.id);
        effects.push({ customerId: loser.customerId || loser.key, customerName: loser.customerName, role: "loser", ...loss });
      });
      if (finalGames > 0) {
        teamOwners(session, winningTeam).forEach((winner) => {
          const isCombined = Boolean(winningTeam === "A" ? session.teamABillOwnerCustomerId || session.teamABillOwnerName : session.teamBBillOwnerCustomerId || session.teamBBillOwnerName);
          const win = reducePayable(winner, finalGames * (isCombined ? 1 : winner.positions), line.id);
          effects.push({ customerId: winner.customerId || winner.key, customerName: winner.customerName, role: "winner", ...win });
        });
      }
    }
    return { ...line, settlement: effects };
  });

  return {
    owners: [...balances.values()],
    lines: settledLines,
    originalGameCount: lines.reduce((sum, line) => sum + (line.type === "doubleGame" ? 2 : 1), 0),
    originalTableAmount: lines.reduce((sum, line) => sum + line.amount, 0),
  };
}
