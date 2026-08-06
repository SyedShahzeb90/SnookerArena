import {
  CircleX,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Table } from "@/types/table";
import { useCustomerAccountStore } from "@/features/customers/store/customerAccountStore";
import {
  getSessionParticipantKey,
  getSessionPlayerEntries,
  getSessionPlayers,
} from "@/features/sessions/utils/sessionPlayers";
import { getDoubleGameTeams } from "@/features/sessions/utils/doubleGameBilling";
import { isWalkInName } from "@/features/sessions/utils/walkInLabel";

interface Props {
  open: boolean;
  table: Table;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: {
    winnerName?: string;
    winnerCustomerId?: string;
    winnerParticipantKey?: string;
    loserName?: string;
    loserCustomerId?: string;
    loserParticipantKey?: string;
    payerName?: string;
    payerCustomerId?: string;
    winningTeam?: "A" | "B";
    losingTeam?: "A" | "B";
    isFinal?: boolean;
    finalGames?: number;
    endTime?: Date;
  }) => void;
}

interface LoserOption {
  slot: string;
  slotLabel: string;
  name: string;
  customerId?: string;
}

function formatDateTimeLocal(date: Date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000)
    .toISOString()
    .slice(0, 16);
}

function EndSessionDialog({
  open,
  table,
  onOpenChange,
  onConfirm,
}: Props) {
  const session = table.session;
  const [finalEnabled, setFinalEnabled] =
    useState(false);
  const [finalValue, setFinalValue] =
    useState("");
  const [manualEndEnabled, setManualEndEnabled] =
    useState(false);
  const [manualEndTime, setManualEndTime] =
    useState("");
  const customerAccounts =
    useCustomerAccountStore(
      (state) => state.accounts
    );

  useEffect(() => {
    if (!open) {
      setFinalEnabled(false);
      setFinalValue("");
      setManualEndEnabled(false);
      setManualEndTime("");
    }
  }, [open]);

  if (!session) return null;

  const currentChargeLine =
    session.tableChargeLines?.at(-1);
  const currentFrameType =
    currentChargeLine?.type ??
    (session.sessionType === "double"
      ? "doubleGame"
      : session.sessionType === "single"
        ? "singleGame"
        : "tableBooking");
  const hasNamedSessionPlayer = [
    session.player1,
    session.player2,
    session.player3,
    session.player4,
  ].some(
    (name) =>
      Boolean(name?.trim()) &&
      !isWalkInName(name)
  );
  const showFinalInput =
    table.id >= 1 &&
    table.id <= 7 &&
    hasNamedSessionPlayer &&
    !currentChargeLine?.isFinal &&
    (currentFrameType === "singleGame" ||
      currentFrameType === "doubleGame");
  const players =
    getSessionPlayers(session);
  const isDouble =
    currentFrameType === "doubleGame";
  const isTimeBased =
    session.sessionType === "time" ||
    session.sessionType === "private";
  const bookingPlayerOptions: LoserOption[] =
    session.sessionType === "time"
      ? getSessionPlayerEntries(session).map(
          (player, index) => ({
            ...player,
            slotLabel:
              index === 0
                ? "Main Customer"
                : `Extra Player ${index}`,
          })
        )
      : [];
  const shouldAskBookingLoser =
    session.sessionType === "time" &&
    bookingPlayerOptions.length > 1 &&
    bookingPlayerOptions.some(
      (player) => !isWalkInName(player.name)
    );
  const shouldAskLoser =
    !isTimeBased || shouldAskBookingLoser;
  const teams = getDoubleGameTeams(session);
  const teamALabel =
    teams.teamAPlayers.join(", ") ||
    "Team A";
  const teamBLabel =
    teams.teamBPlayers.join(", ") ||
    "Team B";

  const handleLoser = (
    loser: LoserOption,
    options: LoserOption[]
  ) => {
    const finalData = getFinalData();
    if (!finalData) return;
    const endTime = isTimeBased
      ? getManualEndTime()
      : undefined;
    if (endTime === null) return;
    const winner =
      options.length === 2
        ? options.find(
            (player) =>
              player.slot !== loser.slot
          )
        : undefined;
    const winnerName =
      winner?.name ??
      (!isTimeBased
        ? players.find(
            (player) => player !== loser.name
          ) ?? loser.name
        : undefined);

    onConfirm({
      winnerName,
      winnerCustomerId: winner?.customerId,
      winnerParticipantKey: winner
        ? getSessionParticipantKey(session.id, winner.slot)
        : undefined,
      loserName: loser.name,
      loserCustomerId: loser.customerId,
      loserParticipantKey: getSessionParticipantKey(
        session.id,
        loser.slot
      ),
      payerName: loser.name,
      payerCustomerId: loser.customerId,
      endTime,
      ...finalData,
    });
  };

  const getFinalData = () => {
    const parsedFinalGames = Number(finalValue);

    if (
      showFinalInput &&
      finalEnabled &&
      (!Number.isInteger(parsedFinalGames) ||
        parsedFinalGames < 1)
    ) {
      window.alert(
        "Final Games must be a positive whole number."
      );
      return undefined;
    }

    return {
      isFinal: showFinalInput && finalEnabled,
      finalGames:
        showFinalInput && finalEnabled
          ? parsedFinalGames
          : undefined,
    };
  };

  const getManualEndTime = () => {
    if (!manualEndEnabled) return undefined;

    const parsed = new Date(manualEndTime);
    const startedAt = new Date(session.startTime);
    const now = new Date();

    if (
      !manualEndTime ||
      Number.isNaN(parsed.getTime()) ||
      parsed <= startedAt ||
      parsed > now
    ) {
      window.alert(
        "End time must be after the session start and not later than the current time."
      );
      return null;
    }

    return parsed;
  };

  const getPlayerLabel = (player: {
    name: string;
    customerId?: string;
  }) => {
    const account = customerAccounts.find(
      (candidate) =>
        candidate.id === player.customerId
    );
    const sequence =
      account?.customerToken.match(/\d+/)?.[0];

    if (account && sequence) {
      return `${account.customerName} - T${table.id}-${sequence.padStart(
        3,
        "0"
      )}`;
    }

    return player.name;
  };

  const singlePlayerOptions = [
    {
      slot: "player1",
      slotLabel: "Player 1",
      name:
        session.player1?.trim() ||
        "Walk-in Customer",
      customerId: session.player1CustomerId,
    },
    {
      slot: "player2",
      slotLabel: "Player 2",
      name: session.player2?.trim(),
      customerId: session.player2CustomerId,
    },
  ].filter((player) => player.name) as {
    slot: string;
    slotLabel: string;
    name: string;
    customerId?: string;
  }[];

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {shouldAskLoser
              ? "Who lost?"
              : "End Session"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-500">
              {!shouldAskLoser
                ? "End this booking now or enter the actual end time manually."
                : shouldAskBookingLoser
                  ? "Select the loser before ending this booking."
                  : "Select the loser before ending this session."}
            </p>
            {shouldAskLoser && (
              <p className="mt-1 text-sm text-slate-500">
                The loser will be selected as payer by default.
              </p>
            )}
          </div>

          {showFinalInput && (
            <div className="flex items-center justify-end gap-2 rounded-lg border bg-slate-50 p-3">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={finalEnabled}
                  onChange={(event) => {
                    const enabled =
                      event.target.checked;

                    setFinalEnabled(enabled);
                    setFinalValue(
                      enabled
                        ? finalValue || "1"
                        : ""
                    );
                  }}
                />
                Final
              </label>
              <Input
                className="h-9 w-24 bg-white"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={finalValue}
                disabled={!finalEnabled}
                onChange={(event) => {
                  setFinalValue(
                    event.target.value.replace(
                      /\D/g,
                      ""
                    )
                  );
                }}
                placeholder="1"
              />
            </div>
          )}

          {isTimeBased && (
            <div className="grid gap-3 rounded-lg border bg-slate-50 p-3">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={manualEndEnabled}
                  onChange={(event) => {
                    const enabled = event.target.checked;
                    setManualEndEnabled(enabled);
                    setManualEndTime(
                      enabled ? formatDateTimeLocal(new Date()) : ""
                    );
                  }}
                />
                End time manually
              </label>
              {manualEndEnabled && (
                <Input
                  type="datetime-local"
                  value={manualEndTime}
                  min={formatDateTimeLocal(new Date(session.startTime))}
                  max={formatDateTimeLocal(new Date())}
                  onChange={(event) =>
                    setManualEndTime(event.target.value)
                  }
                />
              )}
            </div>
          )}

          {isTimeBased && !shouldAskBookingLoser ? (
            <Button
              size="lg"
              className="h-12 w-full"
              onClick={() => {
                const endTime = getManualEndTime();
                if (endTime === null) return;
                onConfirm({ endTime });
              }}
            >
              End Session
            </Button>
          ) : shouldAskBookingLoser ? (
            <div className="grid gap-3">
              {bookingPlayerOptions.map(
                (player) => (
                  <Button
                    key={`${player.slot}-${player.customerId ?? player.name}`}
                    size="lg"
                    className="h-14 justify-start gap-3 text-base"
                    onClick={() =>
                      handleLoser(
                        player,
                        bookingPlayerOptions
                      )
                    }
                  >
                    <CircleX className="h-5 w-5" />
                    <span className="flex flex-col items-start leading-tight">
                      <span>
                        {getPlayerLabel(player)} Lost
                      </span>
                      <span className="text-xs font-normal opacity-80">
                        {player.slotLabel}
                      </span>
                    </span>
                  </Button>
                )
              )}
            </div>
          ) : isDouble && !hasNamedSessionPlayer ? (
            <div className="grid gap-3">
              <Button
                size="lg"
                className="h-14 justify-start gap-3 text-base"
                onClick={() => {
                  const finalData = getFinalData();
                  if (!finalData) return;
                  onConfirm({
                    loserName: "Walk-in Customer",
                    payerName:
                      session.player1?.trim() ||
                      "Walk-in Customer",
                    payerCustomerId:
                      session.player1CustomerId,
                    losingTeam: "A",
                    winningTeam: "B",
                    ...finalData,
                  });
                }}
              >
                <CircleX className="h-5 w-5" />
                Walk-in Customer Lost
              </Button>
            </div>
          ) : isDouble ? (
            <div className="grid gap-3">
              <Button
                size="lg"
                className="h-14 justify-start gap-3 text-base"
                onClick={() => {
                  const finalData =
                    getFinalData();
                  if (!finalData) return;
                  onConfirm({
                    winnerName: teamBLabel,
                    loserName: teamALabel,
                    winningTeam: "B",
                    losingTeam: "A",
                    payerName:
                      teams.teamAPlayers[0],
                    ...finalData,
                  });
                }}
              >
                <CircleX className="h-5 w-5" />
                {teamALabel} Lost
              </Button>
              <Button
                size="lg"
                className="h-14 justify-start gap-3 text-base"
                onClick={() => {
                  const finalData =
                    getFinalData();
                  if (!finalData) return;
                  onConfirm({
                    winnerName: teamALabel,
                    loserName: teamBLabel,
                    winningTeam: "A",
                    losingTeam: "B",
                    payerName:
                      teams.teamBPlayers[0],
                    ...finalData,
                  });
                }}
              >
                <CircleX className="h-5 w-5" />
                {teamBLabel} Lost
              </Button>
            </div>
          ) : (
            <div className="grid gap-3">
              {singlePlayerOptions.map((player) => (
                <Button
                  key={`${player.slot}-${player.customerId ?? player.name}`}
                  size="lg"
                  className="h-14 justify-start gap-3 text-base"
                  onClick={() =>
                    handleLoser(
                      player,
                      singlePlayerOptions
                    )
                  }
                >
                  <CircleX className="h-5 w-5" />
                  <span className="flex flex-col items-start leading-tight">
                    <span>
                      {getPlayerLabel(player)} Lost
                    </span>
                    {player.customerId && (
                      <span className="text-xs font-normal opacity-80">
                        {player.slotLabel}
                      </span>
                    )}
                  </span>
                </Button>
              ))}
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}

export default EndSessionDialog;
