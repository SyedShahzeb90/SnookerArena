import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  CircleDot,
  DoorOpen,
  History,
} from "lucide-react";

import type { Table } from "@/types/table";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import useCurrentTime from "@/features/dashboard/hooks/useCurrentTime";
import { useTableStore } from "@/store/tableStore";
import { useCustomerAccountStore } from "@/features/customers/store/customerAccountStore";
import { getBillPrimaryLabel } from "@/features/customers/utils/billDisplay";
import { getSessionPlayers } from "@/features/sessions/utils/sessionPlayers";
import { getDoubleGameTeams } from "@/features/sessions/utils/doubleGameBilling";
import { isWalkInName } from "@/features/sessions/utils/walkInLabel";
import type {
  TableChargeLineType,
} from "@/types/session";

import TableHeader from "./TableHeader";
import TableInfo from "./TableInfo";
import RunningPanel from "./RunningPanel";
import PendingPaymentPanel from "./PendingPaymentPanel";
import EditSessionDialog from "./EditSessionDialog";
import EndSessionDialog from "./EndSessionDialog";
import TableStatusBadge from "./TableStatusBadge";
import OutsidePurchaseDialog from "@/features/outside-purchases/components/OutsidePurchaseDialog";
import { useClubSettingsStore } from "@/features/settings/store/clubSettingsStore";
import type { OutsidePurchaseOwner } from "@/features/outside-purchases/components/OutsidePurchaseDialog";

type Props = {
  table: Table;
  onClick: () => void;
  onHistoryClick?: () => void;
  onCafeBillClick?: () => void;
  onAccessoriesClick?: () => void;
};

export interface TableCardHandle {
  focusCard: () => void;
  openAddFrame: () => void;
  openEndSession: () => void;
}

function formatDuration(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(
    (totalSeconds % 3600) / 60
  );
  const seconds = totalSeconds % 60;

  return `${String(hours).padStart(
    2,
    "0"
  )}:${String(minutes).padStart(
    2,
    "0"
  )}:${String(seconds).padStart(
    2,
    "0"
  )}`;
}

function getElapsedMilliseconds(
  table: Table,
  now: Date
) {
  if (!table.session) return 0;

  return (
    (
      table.session.pausedAt
        ? new Date(
            table.session.pausedAt
          ).getTime()
        : now.getTime()
    ) -
    new Date(
      table.session.startTime
    ).getTime() -
    table.session.totalPausedMilliseconds
  );
}

function formatDateTimeLocal(date: Date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000)
    .toISOString()
    .slice(0, 16);
}

function getFrameTimerStart(table: Table) {
  const session = table.session;

  if (!session) {
    return {
      startedAt: new Date(),
      pausedMilliseconds: 0,
      sessionId: undefined,
    };
  }

  const latestLine =
    session.tableChargeLines?.at(-1);

  return {
    startedAt:
      session.frameTimerStartedAt ??
      latestLine?.startedAt ??
      session.startTime,
    pausedMilliseconds:
      session.frameTimerPausedMilliseconds ??
      session.totalPausedMilliseconds,
    sessionId: session.id,
  };
}

const TableCard = forwardRef<TableCardHandle, Props>(function TableCard({
  table,
  onClick,
  onHistoryClick,
  onCafeBillClick,
  onAccessoriesClick,
}, ref) {
  const now = useCurrentTime();
  const frameWarningMinutes = useClubSettingsStore(
    (state) => state.settings.frameWarningMinutes
  );
  const frameDangerMinutes = useClubSettingsStore(
    (state) => state.settings.frameDangerMinutes
  );
  const singleGameRate = useClubSettingsStore(
    (state) => state.settings.singleGameRate
  );
  const doubleGameRate = useClubSettingsStore(
    (state) => state.settings.doubleGameRate
  );
  const tableBookingRate = useClubSettingsStore(
    (state) => state.settings.tableBookingRatePerMinute
  );
  const cardRef = useRef<HTMLDivElement>(null);

  const [editOpen, setEditOpen] =
    useState(false);
  const [endOpen, setEndOpen] =
    useState(false);
  const [addChargeOpen, setAddChargeOpen] =
    useState(false);
  const [outsidePurchaseOpen, setOutsidePurchaseOpen] =
    useState(false);
  const [
    chargeType,
    setChargeType,
  ] = useState<TableChargeLineType>("singleGame");
  const [finalEnabled, setFinalEnabled] =
    useState(false);
  const [finalValue, setFinalValue] =
    useState("");
  const [manualChargeStartEnabled, setManualChargeStartEnabled] =
    useState(false);
  const [manualChargeStart, setManualChargeStart] =
    useState("");
  const [payerName, setPayerName] =
    useState("");
  const [
    payerCustomerId,
    setPayerCustomerId,
  ] = useState("");
  const [
    losingTeam,
    setLosingTeam,
  ] = useState<"A" | "B">("A");
  const [
    frameTimerStart,
    setFrameTimerStart,
  ] = useState(() => getFrameTimerStart(table));

  const endSession = useTableStore(
    (state) => state.endSession
  );

  const pauseSession = useTableStore(
    (state) => state.pauseSession
  );

  const resumeSession = useTableStore(
    (state) => state.resumeSession
  );
  const cancelSession = useTableStore(
    (state) => state.cancelSession
  );
  const addTableChargeLine =
    useTableStore(
      (state) => state.addTableChargeLine
    );
  const customerAccounts =
    useCustomerAccountStore(
      (state) => state.accounts
    );

  const elapsedMilliseconds =
    getElapsedMilliseconds(table, now);
  const elapsed = table.session
    ? formatDuration(elapsedMilliseconds)
    : "00:00:00";
  const frameElapsedMilliseconds = table.session
    ? Math.max(
        0,
        (table.session.pausedAt
          ? new Date(
              table.session.pausedAt
            ).getTime()
          : now.getTime()) -
          new Date(
            frameTimerStart.startedAt
          ).getTime() -
          (table.session
            .totalPausedMilliseconds -
            frameTimerStart.pausedMilliseconds)
      )
    : 0;
  const frameElapsed = table.session
    ? formatDuration(frameElapsedMilliseconds)
    : "00:00:00";
  const frameElapsedMinutes =
    frameElapsedMilliseconds / 60000;
  const usesFrameTimeWarning =
    table.session?.sessionType === "single" ||
    table.session?.sessionType === "double";
  const isRunningOrPaused =
    table.status === "running" ||
    table.status === "paused";
  const runningTimeWarningClass =
    table.status === "running" &&
    usesFrameTimeWarning &&
    frameElapsedMinutes >= frameDangerMinutes
      ? "border-red-300 bg-red-50 shadow-red-100 hover:shadow-red-200"
      : table.status === "running" &&
          usesFrameTimeWarning &&
          frameElapsedMinutes >= frameWarningMinutes
        ? "border-amber-300 bg-amber-50 shadow-amber-100 hover:shadow-amber-200"
        : table.status === "running"
          ? "border-red-200 bg-white"
          : table.status === "paused"
            ? "border-amber-200 bg-white"
            : "border-slate-200 bg-white";
  const sessionPlayers = table.session
    ? getSessionPlayers(table.session)
    : [];
  const sessionPlayerOptions = table.session
    ? [
        {
          name: table.session.player1,
          customerId:
            table.session.player1CustomerId ?? "",
        },
        ...(table.session.player2
          ? [
              {
                name: table.session.player2,
                customerId:
                  table.session.player2CustomerId ??
                  "",
              },
            ]
          : []),
        ...(table.session.player3
          ? [
              {
                name: table.session.player3,
                customerId:
                  table.session.player3CustomerId ??
                  "",
              },
            ]
          : []),
        ...(table.session.player4
          ? [
              {
                name: table.session.player4,
                customerId:
                  table.session.player4CustomerId ??
                  "",
              },
            ]
          : []),
      ].filter((player) => player.name.trim())
    : [];
  const outsidePurchaseOwners: OutsidePurchaseOwner[] =
    sessionPlayerOptions.reduce<OutsidePurchaseOwner[]>((owners, player) => {
      const account = customerAccounts.find(
        (item) => item.id === player.customerId
      );
      const key = account?.id || player.customerId || player.name.toLowerCase();
      if (owners.some((owner) =>
        (owner.customerAccountId || owner.customerId || owner.customerName.toLowerCase()) === key
      )) {
        return owners;
      }
      owners.push({
        customerId: player.customerId || undefined,
        customerAccountId: account?.id,
        customerToken: account?.customerToken,
        customerName: account ? getBillPrimaryLabel(account) : player.name,
      });
      return owners;
    }, []);
  const getPlayerOptionLabel = (player: {
    name: string;
    customerId: string;
  }) => {
    const account = customerAccounts.find(
      (candidate) =>
        candidate.id === player.customerId
    );

    if (account) {
      const sequence =
        account.customerToken.match(/\d+/)?.[0];

      if (sequence) {
        return `${account.customerName} - T${table.id}-${sequence.padStart(
          3,
          "0"
        )}`;
      }

      return getBillPrimaryLabel(account);
    }

    return player.name;
  };

  const openAddFrame = () => {
    if (
      !table.session ||
      (table.status !== "running" &&
        table.status !== "paused") ||
      (table.session.sessionType !== "single" &&
        table.session.sessionType !== "double") ||
      addChargeOpen
    ) {
      return;
    }

    setChargeType(
      table.session.sessionType === "double"
        ? "doubleGame"
        : "singleGame"
    );
    setLosingTeam("A");
    setPayerName(sessionPlayerOptions[0]?.name ?? "");
    setPayerCustomerId(
      sessionPlayerOptions[0]?.customerId ?? ""
    );
    setManualChargeStartEnabled(false);
    setManualChargeStart("");
    setAddChargeOpen(true);
  };

  useImperativeHandle(ref, () => ({
    focusCard: () => {
      cardRef.current?.focus({ preventScroll: true });
      cardRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    },
    openAddFrame,
    openEndSession: () => {
      if (table.status === "running" && !endOpen) {
        setEndOpen(true);
      }
    },
  }));

  useEffect(() => {
    const session = table.session;
    if (!session) return;

    setFrameTimerStart((current) =>
      current.sessionId === session.id &&
      current.startedAt ===
        (session.frameTimerStartedAt ??
          session.tableChargeLines?.at(-1)
            ?.startedAt ??
          session.startTime) &&
      current.pausedMilliseconds ===
        (session.frameTimerPausedMilliseconds ??
          session.totalPausedMilliseconds)
        ? current
        : getFrameTimerStart(table)
    );
  }, [table.session]);

  const getSelectedPayerCustomerId = (
    selectedPayerCustomerId: string
  ) => {
    return selectedPayerCustomerId.trim() || undefined;
  };
  const currentChargeLine =
    table.session?.tableChargeLines?.at(-1);
  const currentFrameType =
    currentChargeLine?.type ??
    (table.session?.sessionType === "double"
      ? "doubleGame"
      : table.session?.sessionType === "single"
        ? "singleGame"
        : "tableBooking");
  const currentFrameIsDouble =
    currentFrameType === "doubleGame";
  const shouldChooseLoser =
    currentFrameType === "doubleGame" ||
    (currentFrameType === "singleGame" &&
      sessionPlayerOptions.length >= 2);
  const hasNamedSessionPlayer =
    sessionPlayerOptions.some(
      (player) => !isWalkInName(player.name)
    );
  const showFinalInput =
    table.id >= 1 &&
    table.id <= 7 &&
    hasNamedSessionPlayer &&
    (chargeType === "singleGame" ||
      chargeType === "doubleGame");
  const currentFrameNumber = Math.max(
    1,
    table.session?.tableChargeLines?.length ?? 1
  );
  const nextFrameNumber = currentFrameNumber + 1;
  const doubleTeams = table.session
    ? getDoubleGameTeams(table.session)
    : undefined;
  const teamALabel =
    doubleTeams?.teamAPlayers.join(" - ") ||
    "Team A";
  const teamBLabel =
    doubleTeams?.teamBPlayers.join(" - ") ||
    "Team B";
  const submitChargeLine = () => {
    if (!table.session) return;
    const parsedChargeStart =
      chargeType === "tableBooking" && manualChargeStartEnabled
        ? new Date(manualChargeStart)
        : undefined;
    const currentLineStartedAt = new Date(
      currentChargeLine?.startedAt ?? table.session.startTime
    );

    if (
      parsedChargeStart &&
      (!manualChargeStart ||
        Number.isNaN(parsedChargeStart.getTime()) ||
        parsedChargeStart < currentLineStartedAt ||
        parsedChargeStart > new Date())
    ) {
      window.alert(
        "Start time must be after the current frame started and not later than the current time."
      );
      return;
    }
    const parsedFinalGames = Number(finalValue);
    if (
      showFinalInput &&
      finalEnabled &&
      (!Number.isInteger(parsedFinalGames) || parsedFinalGames < 1)
    ) {
      window.alert("Final Games must be a positive whole number.");
      return;
    }
    const isDoubleFrame = currentFrameIsDouble;
    const selectedPlayer =
      sessionPlayerOptions.find(
        (player) =>
          player.customerId ===
          (payerCustomerId ||
            sessionPlayerOptions[0]?.customerId)
      ) ?? sessionPlayerOptions[0];

    const selectedPayer =
      isDoubleFrame
        ? losingTeam === "A"
          ? doubleTeams?.teamAPlayers[0] ?? teamALabel
          : doubleTeams?.teamBPlayers[0] ?? teamBLabel
        : shouldChooseLoser
        ? selectedPlayer?.name || payerName || ""
        : table.session.player1;
    const selectedLoserName = isDoubleFrame
      ? losingTeam === "A"
        ? teamALabel
        : teamBLabel
      : selectedPayer;
    const selectedWinnerName = isDoubleFrame
      ? losingTeam === "A"
        ? teamBLabel
        : teamALabel
      : sessionPlayers.find(
          (player) => player !== selectedPayer
        );

    addTableChargeLine({
      tableId: table.id,
      type:
        table.type === "private-room"
          ? "tableBooking"
          : chargeType,
      payerName: selectedPayer,
      payerCustomerId:
        isDoubleFrame
          ? undefined
          : getSelectedPayerCustomerId(
              shouldChooseLoser
                ? payerCustomerId ||
                    sessionPlayerOptions[0]
                      ?.customerId ||
                    ""
                : table.session.player1CustomerId || ""
            ),
      loserName:
        currentFrameType === "singleGame" ||
        currentFrameType === "doubleGame"
          ? selectedLoserName
          : undefined,
      winnerName:
        currentFrameType === "singleGame" ||
        currentFrameType === "doubleGame"
          ? selectedWinnerName
          : undefined,
      losingTeam: isDoubleFrame
        ? losingTeam
        : undefined,
      winningTeam: isDoubleFrame
        ? losingTeam === "A"
          ? "B"
          : "A"
        : undefined,
      isFinal: showFinalInput && finalEnabled,
      finalGames:
        showFinalInput && finalEnabled
          ? parsedFinalGames
          : undefined,
      startedAt: parsedChargeStart,
    });
    const now = parsedChargeStart ?? new Date();
    setFrameTimerStart({
      startedAt: now.toISOString(),
      pausedMilliseconds:
        table.session.totalPausedMilliseconds,
      sessionId: table.session.id,
    });
    setAddChargeOpen(false);
    setChargeType("singleGame");
    setPayerName("");
    setPayerCustomerId("");
    setFinalEnabled(false);
    setFinalValue("");
    setManualChargeStartEnabled(false);
    setManualChargeStart("");
  };

  if (table.status === "available" && !table.session) {
    const AvailableIcon =
      table.type === "private-room"
        ? DoorOpen
        : CircleDot;

    return (
      <Card
        ref={cardRef}
        tabIndex={-1}
        title={table.type === "table" && table.id <= 7 ? `${table.name} - F${table.id}` : table.name}
        onClick={onClick}
        className="flex min-h-[176px] cursor-pointer flex-col rounded-lg border-slate-200 bg-white p-4 shadow-none transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
              <AvailableIcon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate font-bold text-slate-950">
                {table.name}
              </h2>
              <p className="text-xs font-medium text-slate-500">
                {table.type === "private-room"
                  ? "Private Room"
                  : "Standard Table"}
              </p>
            </div>
          </div>
          <TableStatusBadge status={table.status} />
        </div>

        <p className="mt-4 text-sm text-slate-500">
          Ready for a new session
        </p>

        <div className="mt-auto flex items-center gap-2 pt-4">
          <Button
            type="button"
            className="h-9 flex-1"
            onClick={(event) => {
              event.stopPropagation();
              onClick();
            }}
          >
            Start Session
          </Button>
          {onHistoryClick && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 px-3 text-xs text-slate-600"
              onClick={(event) => {
                event.stopPropagation();
                onHistoryClick();
              }}
            >
              <History className="h-3.5 w-3.5" />
              History
            </Button>
          )}
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card
        ref={cardRef}
        tabIndex={-1}
        title={table.type === "table" && table.id <= 7 ? `${table.name} - F${table.id}` : table.name}
        onClick={onClick}
        className={`flex min-h-[230px] cursor-pointer flex-col rounded-lg shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
          isRunningOrPaused ? "p-4" : "p-5"
        } ${runningTimeWarningClass}`}
      >
        {isRunningOrPaused ? (
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
                table.status === "paused"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-red-50 text-red-700"
              }`}>
                {table.type === "private-room" ? (
                  <DoorOpen className="h-4 w-4" />
                ) : (
                  <CircleDot className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate font-bold text-slate-950">
                    {table.name}
                  </h2>
                  <TableStatusBadge status={table.status} />
                </div>
                <p className="text-xs font-medium text-slate-500">
                  {table.type === "private-room" ? "Private Room" : "Standard Table"}
                </p>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[11px] font-medium text-slate-500">Elapsed</p>
              <p className={`font-mono text-2xl font-bold tabular-nums leading-tight ${
                table.status === "paused" ? "text-amber-700" : "text-red-700"
              }`}>
                {elapsed}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <TableHeader table={table} />

            {onHistoryClick && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1 px-2 text-xs"
                onClick={(event) => {
                  event.stopPropagation();
                  onHistoryClick();
                }}
              >
                <History className="h-3.5 w-3.5" />
                History
              </Button>
            )}
          </div>
        )}

        <div className={`${isRunningOrPaused ? "mt-3 space-y-3" : "mt-5 space-y-4"} flex flex-1 flex-col`}>
          {table.session && (
            <>
              <TableInfo
                session={table.session}
                tableId={table.id}
                tableType={table.type}
                now={now}
                compactRunning={isRunningOrPaused}
                onCafeBillClick={onCafeBillClick}
                onAccessoriesClick={onAccessoriesClick}
              />

              {table.type !== "private-room" &&
                ["singleGame", "doubleGame"].includes(
                  table.session.tableChargeLines?.at(-1)?.type ?? ""
                ) &&
                table.session.tableChargeLines?.at(-1)?.isFinal && (
                <div className="self-start rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">
                  Final {table.session.tableChargeLines.at(-1)?.finalGames}
                </div>
              )}

              {(table.status ===
                "running" ||
                table.status ===
                  "paused") && (
                <RunningPanel
                  frameElapsed={frameElapsed}
                  timerLabel={
                    currentFrameType === "tableBooking"
                      ? "Current booking"
                      : "Current frame"
                  }
                  showFrameFeatures
                  isPaused={
                    table.status ===
                    "paused"
                  }
                  onPause={() => {
                    if (
                      table.status ===
                      "running"
                    ) {
                      pauseSession(
                        table.id
                      );
                    } else {
                      resumeSession(
                        table.id
                      );
                    }
                  }}
                  onAddCharge={
                    table.type !== "private-room"
                      ? openAddFrame
                      : undefined
                  }
                  onEdit={() =>
                    setEditOpen(true)
                  }
                  onCafe={onCafeBillClick}
                  onAccessories={onAccessoriesClick}
                  onHistory={onHistoryClick}
                  onOutsidePurchase={() => setOutsidePurchaseOpen(true)}
                  onCancelSession={() => {
                    const confirmed =
                      window.confirm(
                        `Cancel the running session on ${table.name}? This will remove the mistaken start and no bill will be created.`
                      );

                    if (confirmed) {
                      cancelSession(table.id);
                    }
                  }}
                  onEndSession={() => setEndOpen(true)}
                />
              )}

              {table.status ===
                "payment-pending" && (
                <PendingPaymentPanel
                  onOpenBill={onClick}
                />
              )}
            </>
          )}

          {!table.session && (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
              <p className="text-sm font-medium text-slate-500">
                Ready for a new session
              </p>

              <p className="mt-1 text-sm text-slate-400">
                Click to start play
              </p>
            </div>
          )}
        </div>
      </Card>

      <EditSessionDialog
        open={editOpen}
        table={table}
        onOpenChange={setEditOpen}
      />

      {table.session && (
        <EndSessionDialog
          open={endOpen}
          table={table}
          onOpenChange={setEndOpen}
          onConfirm={(result) => {
            const currentLine = table.session?.tableChargeLines?.at(-1);
            if (currentLine?.isFinal || result.isFinal) {
              const winnerNames = result.winningTeam
                ? getDoubleGameTeams(table.session!).teamAPlayers
                    .filter(() => result.winningTeam === "A")
                    .concat(getDoubleGameTeams(table.session!).teamBPlayers.filter(() => result.winningTeam === "B"))
                : [result.winnerName];
              if (winnerNames.some((name) => isWalkInName(name))) {
                window.alert("A Final winner must have a proper customer name. Edit the session and link the walk-in before ending it.");
                return;
              }
            }
            endSession({
              tableId: table.id,
              ...result,
            });
            setEndOpen(false);
          }}
        />
      )}

      {table.session && (
        <OutsidePurchaseDialog
          open={outsidePurchaseOpen}
          tableId={table.id}
          tableName={table.name}
          sessionId={table.session.id}
          owners={outsidePurchaseOwners}
          onOpenChange={setOutsidePurchaseOpen}
        />
      )}

      {table.session && (
        <Dialog
          open={addChargeOpen}
          onOpenChange={setAddChargeOpen}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                Add Frame
              </DialogTitle>
            </DialogHeader>

            <div className="grid gap-4">
              {shouldChooseLoser &&
                currentFrameType === "singleGame" && (
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  Who lost Frame {currentFrameNumber}?
                  <select
                    className="rounded-md border bg-white p-2"
                    value={
                      payerCustomerId ||
                      sessionPlayerOptions[0]
                        ?.customerId ||
                      ""
                    }
                    onChange={(event) =>
                      {
                        const selected =
                          sessionPlayerOptions.find(
                            (player) =>
                              player.customerId ===
                              event.target.value
                          );
                        setPayerCustomerId(
                          event.target.value
                        );
                        setPayerName(
                          selected?.name ?? ""
                        );
                      }
                    }
                  >
                    {sessionPlayerOptions.map((player) => (
                      <option
                        key={
                          player.customerId ||
                          player.name
                        }
                        value={player.customerId}
                      >
                        {getPlayerOptionLabel(player)} lost
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {shouldChooseLoser &&
                currentFrameType === "doubleGame" && (
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  Who lost Frame {currentFrameNumber}?
                  <select
                    className="rounded-md border bg-white p-2"
                    value={losingTeam}
                    onChange={(event) =>
                      setLosingTeam(
                        event.target
                          .value as "A" | "B"
                      )
                    }
                  >
                    <option value="A">
                      {teamALabel} lost
                    </option>
                    <option value="B">
                      {teamBLabel} lost
                    </option>
                  </select>
                </label>
              )}

              <div className="grid gap-3 border-t pt-4">
                <p className="text-sm font-semibold text-slate-900">
                  Next Frame - Frame {nextFrameNumber}
                </p>

                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  Select next frame type
                  <select
                    className="rounded-md border bg-white p-2"
                    value={
                      table.type === "private-room"
                        ? "tableBooking"
                        : chargeType
                    }
                    onChange={(event) => {
                      setChargeType(
                        event.target.value as TableChargeLineType
                      );
                      setLosingTeam("A");
                      setFinalEnabled(false);
                      setFinalValue("");
                      setManualChargeStartEnabled(false);
                      setManualChargeStart("");
                    }}
                    disabled={table.type === "private-room"}
                  >
                    <option value="singleGame">
                      Single Game - Rs. {singleGameRate.toLocaleString()}
                    </option>
                    <option value="doubleGame">
                      Double Game - Rs. {doubleGameRate.toLocaleString()}
                    </option>
                    <option value="tableBooking">
                      Table Booking - Rs. {tableBookingRate.toLocaleString()}/min
                    </option>
                  </select>
                </label>

                {showFinalInput && (
                  <div className="flex items-center justify-between gap-2 rounded-lg border bg-slate-50 p-3">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={finalEnabled}
                        onChange={(event) => {
                          const enabled = event.target.checked;
                          setFinalEnabled(enabled);
                          setFinalValue(
                            enabled
                              ? finalValue || "1"
                              : ""
                          );
                        }}
                      />
                      Is Frame {nextFrameNumber} final?
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
                          event.target.value.replace(/\D/g, "")
                        );
                      }}
                      placeholder="1"
                    />
                  </div>
                )}
              </div>

              {chargeType === "tableBooking" && (
                <div className="grid gap-3 rounded-lg bg-slate-50 p-3">
                  <p className="text-sm text-slate-600">
                    Time charge starts now and finalizes
                    when the session ends or another
                    charge is added.
                  </p>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={manualChargeStartEnabled}
                      onChange={(event) => {
                        const enabled = event.target.checked;
                        setManualChargeStartEnabled(enabled);
                        setManualChargeStart(
                          enabled ? formatDateTimeLocal(new Date()) : ""
                        );
                      }}
                    />
                    Start time manually
                  </label>
                  {manualChargeStartEnabled && (
                    <Input
                      type="datetime-local"
                      value={manualChargeStart}
                      min={formatDateTimeLocal(
                        new Date(
                          currentChargeLine?.startedAt ?? table.session.startTime
                        )
                      )}
                      max={formatDateTimeLocal(new Date())}
                      onChange={(event) =>
                        setManualChargeStart(event.target.value)
                      }
                    />
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    setAddChargeOpen(false)
                  }
                >
                  Cancel
                </Button>
                <Button onClick={submitChargeLine}>
                  Add Frame
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
});

export default TableCard;
