import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCustomerAccountStore } from "@/features/customers/store/customerAccountStore";
import { useAdvanceGamesStore } from "@/features/advance-games/store/advanceGamesStore";
import {
  formatOpenCustomerOption,
  getBillPrimaryLabel,
} from "@/features/customers/utils/billDisplay";
import { isWalkInName } from "@/features/sessions/utils/walkInLabel";
import { useClubSettingsStore } from "@/features/settings/store/clubSettingsStore";

import type {
  Session,
  SessionType,
} from "@/types/session";
import type { Table } from "@/types/table";
import type { CustomerAccount } from "@/features/customers/types/customerAccount";

type CustomerEntryMode = "quick" | "existing";

interface Props {
  tableId: number;
  tableType: Table["type"];

  session?: Session;

  allowManualEndTime?: boolean;

  submitLabel?: string;
  onUndoLastFrame?: () => void;
  canUndoLastFrame?: boolean;
  undoLastFrameBusy?: boolean;

  onSubmit: (data: {
    player1: string;
    player1CustomerId?: string;
    player1Mode: CustomerEntryMode;
    player2: string;
    player2CustomerId?: string;
    player2Mode: CustomerEntryMode;
    player3: string;
    player3CustomerId?: string;
    player3Mode: CustomerEntryMode;
    player4: string;
    player4CustomerId?: string;
    player4Mode: CustomerEntryMode;
    extraPlayers: string[];
    teamAOneNameEnough: boolean;
    teamBOneNameEnough: boolean;
    sessionType: SessionType;
    startTime: Date;
    endTime?: Date;
    winnerName?: string;
    loserName?: string;
    payerName?: string;
    winningTeam?: "A" | "B";
    losingTeam?: "A" | "B";
    isFinal: boolean;
    finalGames: number;
  }) => void;
}

function formatDateTimeLocal(
  date: Date
) {
  const d = new Date(date);

  d.setMinutes(
    d.getMinutes() -
      d.getTimezoneOffset()
  );

  return d
    .toISOString()
    .slice(0, 16);
}

function getOpenCustomerOptionKey(
  account: CustomerAccount
) {
  return [
    getBillPrimaryLabel(account),
    account.customerName.trim().toLowerCase(),
    account.lastTableName ?? "",
    account.grandTotal,
  ].join("|");
}

function dedupeActiveCustomers(
  accounts: CustomerAccount[]
) {
  const seen = new Set<string>();

  return accounts.filter((account) => {
    const key = getOpenCustomerOptionKey(account);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function SessionForm({
  tableId,
  tableType,
  session,
  allowManualEndTime = false,
  submitLabel = "Start Session",
  onUndoLastFrame,
  canUndoLastFrame = false,
  undoLastFrameBusy = false,
  onSubmit,
}: Props) {
  const settings = useClubSettingsStore((state) => state.settings);
  const [player1, setPlayer1] =
    useState("");
  const [player1CustomerId, setPlayer1CustomerId] =
    useState("");
  const [player1Mode, setPlayer1Mode] =
    useState<CustomerEntryMode>("quick");

  const [player2, setPlayer2] =
    useState("");
  const [player2CustomerId, setPlayer2CustomerId] =
    useState("");
  const [player2Mode, setPlayer2Mode] =
    useState<CustomerEntryMode>("quick");
  const [player3, setPlayer3] =
    useState("");
  const [player3CustomerId, setPlayer3CustomerId] =
    useState("");
  const [player3Mode, setPlayer3Mode] =
    useState<CustomerEntryMode>("quick");
  const [player4, setPlayer4] =
    useState("");
  const [player4CustomerId, setPlayer4CustomerId] =
    useState("");
  const [player4Mode, setPlayer4Mode] =
    useState<CustomerEntryMode>("quick");
  const [extraPlayers, setExtraPlayers] =
    useState<string[]>([]);
  const [teamAOneName, setTeamAOneName] =
    useState(false);
  const [teamBOneName, setTeamBOneName] =
    useState(false);

  const [sessionType, setSessionType] =
    useState<SessionType>(
      tableType === "private-room"
        ? "private"
        : "single"
    );

  const [startTime, setStartTime] =
    useState(
      formatDateTimeLocal(
        new Date()
      )
    );
  const [startTimeEdited, setStartTimeEdited] =
    useState(false);
  const [manualEndEnabled, setManualEndEnabled] =
    useState(false);
  const [endTime, setEndTime] =
    useState("");
  const [endTimeEdited, setEndTimeEdited] =
    useState(false);
  const [finalEnabled, setFinalEnabled] =
    useState(false);
  const [finalValue, setFinalValue] =
    useState("");
  const [timeError, setTimeError] =
    useState("");
  const [manualLoser, setManualLoser] =
    useState("");
  const customerAccounts =
    useCustomerAccountStore(
      (state) => state.accounts
    );
  const advanceTransactions = useAdvanceGamesStore(
    (state) => state.transactions
  );
  const safeAdvanceTransactions = Array.isArray(advanceTransactions)
    ? advanceTransactions
    : [];
  const getAdvanceBalance = (customerId: string) =>
    safeAdvanceTransactions
      .filter((item) => item.customerId === customerId)
      .reduce((total, item) => total + item.balanceDelta, 0);
  const activeCustomers =
    dedupeActiveCustomers(customerAccounts.filter(
      (account) =>
        ((account.status === "active" &&
        account.paymentStatus === "unpaid" &&
        (account.gameCharges.length > 0 ||
          account.cafeCharges.length > 0 ||
          (account.accessoryCharges ?? [])
            .length > 0)) || getAdvanceBalance(account.id) > 0)
    ));
  const hasNamedPlayer = [
    player1,
    player2,
    player3,
    player4,
  ].some(
    (name) =>
      name.trim().length > 0 &&
      !isWalkInName(name)
  );
  const showFinalInput =
    tableId >= 1 &&
    tableId <= 7 &&
    hasNamedPlayer &&
    (sessionType === "single" ||
      sessionType === "double");

  useEffect(() => {
    if (
      manualEndEnabled &&
      (!endTime || !endTimeEdited)
    ) {
      setEndTime(startTime);
    }
  }, [
    manualEndEnabled,
    startTime,
    endTime,
    endTimeEdited,
  ]);

  const chooseCustomer = (
    customerId: string,
    setCustomerId: (value: string) => void,
    setName: (value: string) => void
  ) => {
    setCustomerId(customerId);

    const customer = activeCustomers.find(
      (account) => account.id === customerId
    );

    if (customer) {
      setName(customer.customerName);
    }
  };

  const renderCustomerEntry = (
    label: string,
    namePlaceholder: string,
    nameValue: string,
    setName: (value: string) => void,
    value: string,
    setCustomerId: (value: string) => void,
    mode: CustomerEntryMode,
    setMode: (value: CustomerEntryMode) => void,
    required = false
  ) => {
    const selectedCustomerIds = [
      player1CustomerId,
      player2CustomerId,
      player3CustomerId,
      player4CustomerId,
    ].filter(Boolean);
    const availableCustomers =
      activeCustomers.filter(
        (customer) =>
          customer.id === value ||
          !selectedCustomerIds.includes(customer.id)
      );
    const selectedCustomer =
      activeCustomers.find(
        (customer) => customer.id === value
      );

    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <select
          className="w-full rounded-md border bg-white p-2 text-sm"
          value={mode}
          onChange={(event) => {
            const nextMode =
              event.target.value as CustomerEntryMode;
            setMode(nextMode);

            if (nextMode === "quick") {
              setCustomerId("");
            }
          }}
        >
          <option value="quick">
            New / quick name
          </option>
          <option value="existing">
            Existing open customer
          </option>
        </select>

        {mode === "existing" ? (
          <div className="space-y-2 rounded-md border bg-slate-50 p-3">
            <select
              className="w-full rounded-md border bg-white p-2 text-sm"
              value={value}
              required={required}
              onChange={(event) =>
                chooseCustomer(
                  event.target.value,
                  setCustomerId,
                  setName
                )
              }
            >
              <option value="">
                Select open customer bill
              </option>
              {availableCustomers.map((customer) => (
                <option
                  key={customer.id}
                  value={customer.id}
                >
                  {formatOpenCustomerOption(
                    customer
                  )} - {getAdvanceBalance(customer.id) > 0 ? `${getAdvanceBalance(customer.id)} advance games` : "No advance games"}
                </option>
              ))}
            </select>
            {selectedCustomer ? (
              <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200">
                <p className="font-medium">
                  Charges will be added to{" "}
                  {getBillPrimaryLabel(
                    selectedCustomer
                  )}
                  .
                </p>
                <p>
                  Current unpaid amount: Rs.{" "}
                  {selectedCustomer.grandTotal}
                </p>
                {getAdvanceBalance(selectedCustomer.id) > 0 && (
                  <p className="font-medium">
                    {selectedCustomer.customerName} has {getAdvanceBalance(selectedCustomer.id)} advance games available.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                Charges will be added to this bill.
              </p>
            )}
          </div>
        ) : (
          <>
            <Input
              value={nameValue}
              onChange={(event) =>
                setName(event.target.value)
              }
              placeholder={namePlaceholder}
              required={required}
            />
            <p className="text-xs text-slate-500">
              Leave blank to create a walk-in bill automatically.
            </p>
          </>
        )}
      </div>
    );
  };

  useEffect(() => {
    const getCustomerName = (
      customerId?: string,
      fallback = ""
    ) =>
      activeCustomers.find(
        (customer) => customer.id === customerId
      )?.customerName ?? fallback;

    if (session) {
      setPlayer1(
        getCustomerName(
          session.player1CustomerId,
          session.player1
        )
      );
      setPlayer1CustomerId(
        session.player1CustomerId ?? ""
      );
      setPlayer1Mode(
        session.player1CustomerId
          ? "existing"
          : "quick"
      );

      setPlayer2(
        getCustomerName(
          session.player2CustomerId,
          session.player2 ?? ""
        )
      );
      setPlayer2CustomerId(
        session.player2CustomerId ?? ""
      );
      setPlayer2Mode(
        session.player2CustomerId
          ? "existing"
          : "quick"
      );
      setPlayer3(
        getCustomerName(
          session.player3CustomerId,
          session.player3 ?? ""
        )
      );
      setPlayer3CustomerId(
        session.player3CustomerId ?? ""
      );
      setPlayer3Mode(
        session.player3CustomerId
          ? "existing"
          : "quick"
      );
      setPlayer4(
        getCustomerName(
          session.player4CustomerId,
          session.player4 ?? ""
        )
      );
      setPlayer4CustomerId(
        session.player4CustomerId ?? ""
      );
      setPlayer4Mode(
        session.player4CustomerId
          ? "existing"
          : "quick"
      );
      setExtraPlayers(
        session.extraPlayers ??
          (session.sessionType === "time" ||
          session.sessionType === "private"
            ? [
                session.player2,
                session.player3,
                session.player4,
              ]
                .map((name) => name?.trim())
                .filter(Boolean) as string[]
            : [])
      );
      setTeamAOneName(
        session.teamAOneNameEnough ??
          !session.player2
      );
      setTeamBOneName(
        session.teamBOneNameEnough ??
          !session.player4
      );

      setSessionType(
        session.sessionType
      );

      setStartTime(
        formatDateTimeLocal(
          new Date(
            session.startTime
          )
        )
      );
      setStartTimeEdited(false);
      setManualEndEnabled(false);
      setEndTime("");
      const currentLine = session.tableChargeLines?.at(-1);
      setFinalEnabled(Boolean(currentLine?.isFinal));
      setFinalValue(currentLine?.isFinal ? String(currentLine.finalGames ?? "") : "");
      setTimeError("");
      setManualLoser("");
    } else {
      setPlayer1("");
      setPlayer1CustomerId("");
      setPlayer1Mode("quick");

      setPlayer2("");
      setPlayer2CustomerId("");
      setPlayer2Mode("quick");
      setPlayer3("");
      setPlayer3CustomerId("");
      setPlayer3Mode("quick");
      setPlayer4("");
      setPlayer4CustomerId("");
      setPlayer4Mode("quick");
      setExtraPlayers([]);
      setTeamAOneName(false);
      setTeamBOneName(false);

      setSessionType(
        tableType === "private-room"
          ? "private"
          : "single"
      );

      setStartTime(
        formatDateTimeLocal(
          new Date()
        )
      );
      setStartTimeEdited(false);
      setManualEndEnabled(false);
      setEndTime("");
      setTimeError("");
      setManualLoser("");
    }
  }, [session, tableType, customerAccounts]);

  const isDouble =
    sessionType === "double";
  const isPrivateRoom =
    tableType === "private-room";
  const isBooking =
    sessionType === "time" ||
    sessionType === "private";
  const manualEndRequiresLoser =
    allowManualEndTime &&
    manualEndEnabled &&
    !isBooking;
  const singleManualLoserOptions = [
    player1.trim() || "Walk-in Customer",
    !isPrivateRoom ? player2.trim() : "",
  ].filter(Boolean);
  const doubleManualLoserOptions =
    isDouble
      ? [
          { value: "A", label: "Team A lost" },
          { value: "B", label: "Team B lost" },
        ]
      : [];
  const priceText =
    sessionType === "single"
      ? `Price: Rs. ${settings.singleGameRate.toLocaleString()} fixed`
      : sessionType === "double"
        ? `Price: Rs. ${settings.doubleGameRate.toLocaleString()} fixed`
        : sessionType === "time"
          ? `Booking Rate: Rs. ${(settings.tableBookingRatePerMinute * 60).toLocaleString()}/hour or Rs. ${settings.tableBookingRatePerMinute.toLocaleString()}/min`
          : "Booking Rate: Rs. 1500/hour or Rs. 25/min";

  const updateExtraPlayer = (
    index: number,
    value: string
  ) => {
    setExtraPlayers((current) =>
      current.map((name, currentIndex) =>
        currentIndex === index ? value : name
      )
    );
  };

  const removeExtraPlayer = (index: number) => {
    setExtraPlayers((current) =>
      current.filter(
        (_, currentIndex) =>
          currentIndex !== index
      )
    );
  };

  return (
    <form
      className="min-h-0 space-y-4 overflow-y-auto pr-1"
      onSubmit={(e) => {
        e.preventDefault();
    setTimeError("");

        const parsedStartTime =
          !session &&
          !manualEndEnabled &&
          !startTimeEdited
            ? new Date()
            : new Date(startTime);
        const parsedEndTime =
          allowManualEndTime &&
          manualEndEnabled &&
          endTime
            ? new Date(endTime)
            : undefined;

        if (
          parsedEndTime &&
          parsedEndTime <= parsedStartTime
        ) {
          setTimeError(
            "End time must be after start time."
          );
          return;
        }

        const parsedFinalGames = Number(finalValue);
        if (
          showFinalInput &&
          finalEnabled &&
          (!Number.isInteger(parsedFinalGames) || parsedFinalGames < 1)
        ) {
          setTimeError("Final Games must be a positive whole number.");
          return;
        }

        let winnerName: string | undefined;
        let loserName: string | undefined;
        let payerName: string | undefined;
        let winningTeam: "A" | "B" | undefined;
        let losingTeam: "A" | "B" | undefined;

        if (parsedEndTime && manualEndRequiresLoser) {
          if (isDouble) {
            if (manualLoser !== "A" && manualLoser !== "B") {
              setTimeError(
                "Please choose which team lost."
              );
              return;
            }

            const teamA = [
              player1.trim(),
              isDouble && !teamAOneName ? player2.trim() : "",
            ].filter(Boolean);
            const teamB = [
              player3.trim(),
              isDouble && !teamBOneName ? player4.trim() : "",
            ].filter(Boolean);
            const losingTeamPlayers =
              manualLoser === "A" ? teamA : teamB;
            const winningTeamPlayers =
              manualLoser === "A" ? teamB : teamA;

            loserName =
              losingTeamPlayers.join(", ") ||
              (manualLoser === "A"
                ? "Team A"
                : "Team B");
            winnerName =
              winningTeamPlayers.join(", ") ||
              (manualLoser === "A"
                ? "Team B"
                : "Team A");
            payerName = losingTeamPlayers[0];
            losingTeam = manualLoser;
            winningTeam = manualLoser === "A" ? "B" : "A";
          } else {
            const selectedLoser =
              manualLoser.trim();
            if (!selectedLoser) {
              setTimeError(
                "Please choose who lost."
              );
              return;
            }

            loserName = selectedLoser;
            winnerName =
              singleManualLoserOptions.find(
                (player) => player !== selectedLoser
              );
            payerName = selectedLoser;
          }
        }

        onSubmit({
          player1: player1.trim(),
          player1CustomerId:
            player1CustomerId || undefined,
          player1Mode,
          player2:
            isBooking
              ? ""
              :
            isDouble && teamAOneName
              ? ""
              : player2.trim(),
          player2CustomerId:
            isBooking ||
            (isDouble && teamAOneName)
              ? undefined
              : player2CustomerId || undefined,
          player2Mode,
          player3: isDouble
            ? player3.trim()
            : "",
          player3CustomerId: isDouble
            ? player3CustomerId || undefined
            : undefined,
          player3Mode,
          player4:
            isDouble && !teamBOneName
              ? player4.trim()
              : "",
          player4CustomerId:
            isDouble && !teamBOneName
              ? player4CustomerId || undefined
              : undefined,
          player4Mode,
          extraPlayers: isBooking
            ? extraPlayers
                .map((name) => name.trim())
                .filter(Boolean)
            : [],
          teamAOneNameEnough:
            isDouble && teamAOneName,
          teamBOneNameEnough:
            isDouble && teamBOneName,
          sessionType,
          startTime: parsedStartTime,
          endTime: parsedEndTime,
          winnerName,
          loserName,
          payerName,
          winningTeam,
          losingTeam,
          isFinal: showFinalInput && finalEnabled,
          finalGames:
            showFinalInput && finalEnabled
              ? parsedFinalGames
              : 0,
        });
      }}
    >
      <div>
        <Label>
          Session Type
        </Label>

        <select
          className="mt-2 w-full rounded-md border p-2"
          value={sessionType}
          onChange={(e) =>
            setSessionType(
              e.target
                .value as SessionType
            )
          }
        >
          {tableType ===
          "table" ? (
            <>
              <option value="single">
                Single Game
              </option>

              <option value="double">
                Double Game
              </option>

              <option value="time">
                Table Booking
              </option>
            </>
          ) : (
            <option value="private">
              Private Room Booking
            </option>
          )}
        </select>

        <p className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600">
          {priceText}
        </p>
      </div>

      {isDouble ? (
        <div className="grid gap-3">
          <div className="rounded-lg border p-2.5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <Label>Team A</Label>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={teamAOneName}
                  onChange={(event) => {
                    setTeamAOneName(
                      event.target.checked
                    );
                    if (event.target.checked) {
                      setPlayer2("");
                      setPlayer2CustomerId("");
                      setPlayer2Mode("quick");
                    }
                  }}
                />
                One name is enough
              </label>
            </div>

            <div className="grid gap-2">
              {renderCustomerEntry(
                "Team A Player 1",
                "Type name or leave blank for walk-in",
                player1,
                setPlayer1,
                player1CustomerId,
                setPlayer1CustomerId,
                player1Mode,
                setPlayer1Mode,
                false
              )}

              {!teamAOneName && (
                renderCustomerEntry(
                  "Team A Player 2",
                  "Type name or leave blank for walk-in",
                  player2,
                  setPlayer2,
                  player2CustomerId,
                  setPlayer2CustomerId,
                  player2Mode,
                  setPlayer2Mode,
                  false
                )
              )}
            </div>
          </div>

          <div className="rounded-lg border p-2.5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <Label>Team B</Label>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={teamBOneName}
                  onChange={(event) => {
                    setTeamBOneName(
                      event.target.checked
                    );
                    if (event.target.checked) {
                      setPlayer4("");
                      setPlayer4CustomerId("");
                      setPlayer4Mode("quick");
                    }
                  }}
                />
                One name is enough
              </label>
            </div>

            <div className="grid gap-2">
              {renderCustomerEntry(
                "Team B Player 1",
                "Type name or leave blank for walk-in",
                player3,
                setPlayer3,
                player3CustomerId,
                setPlayer3CustomerId,
                player3Mode,
                setPlayer3Mode,
                false
              )}

              {!teamBOneName && (
                renderCustomerEntry(
                  "Team B Player 2",
                  "Type name or leave blank for walk-in",
                  player4,
                  setPlayer4,
                  player4CustomerId,
                  setPlayer4CustomerId,
                  player4Mode,
                  setPlayer4Mode,
                  false
                )
              )}
            </div>
          </div>
        </div>
      ) : isBooking ? (
        <div className="space-y-3 rounded-lg border p-3">
          {renderCustomerEntry(
            "Main Customer",
            "Type name or leave blank for walk-in",
            player1,
            setPlayer1,
            player1CustomerId,
            setPlayer1CustomerId,
            player1Mode,
            setPlayer1Mode
          )}

          {extraPlayers.map((name, index) => (
            <div
              key={index}
              className="flex items-end gap-2"
            >
              <div className="flex-1">
                <Label>
                  Extra Player {index + 1}
                </Label>
                <Input
                  value={name}
                  onChange={(event) =>
                    updateExtraPlayer(
                      index,
                      event.target.value
                    )
                  }
                  placeholder="Optional"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  removeExtraPlayer(index)
                }
              >
                Remove
              </Button>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() =>
              setExtraPlayers((current) => [
                ...current,
                "",
              ])
            }
          >
            + Add Player
          </Button>
        </div>
      ) : (
        <>
          {renderCustomerEntry(
            "Player 1",
            "Type name or leave blank for walk-in",
            player1,
            setPlayer1,
            player1CustomerId,
            setPlayer1CustomerId,
            player1Mode,
            setPlayer1Mode
          )}

          {!isPrivateRoom && (
            renderCustomerEntry(
              "Player 2",
              "Type name or leave blank for walk-in",
              player2,
              setPlayer2,
              player2CustomerId,
              setPlayer2CustomerId,
              player2Mode,
              setPlayer2Mode
            )
          )}
        </>
      )}

      <div>
        <Label>
          Start Time
        </Label>

        <Input
          type="datetime-local"
          value={startTime}
          onChange={(e) => {
            setStartTimeEdited(true);
            setStartTime(
              e.target.value
            );
          }}
        />
      </div>

      {(allowManualEndTime || showFinalInput) && (
        <div className="space-y-3 rounded-lg border bg-slate-50 p-3">
          <div
            className={
              showFinalInput
                ? "grid gap-3 sm:grid-cols-2"
                : "grid gap-3"
            }
          >
            {allowManualEndTime && <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={manualEndEnabled}
                onChange={(event) => {
                  const enabled =
                    event.target.checked;

                  setManualEndEnabled(enabled);
                  setEndTimeEdited(false);
                  setEndTime(
                    enabled ? startTime : ""
                  );
                }}
              />
              Add end time manually
            </label>}

            {showFinalInput && (
              <div className="flex items-center gap-2 sm:justify-end">
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
          </div>

          {manualEndEnabled && (
            <div className="space-y-3">
              <div>
                <Label>End Time</Label>
                <Input
                  type="datetime-local"
                  value={endTime}
                  onChange={(event) => {
                    setEndTimeEdited(true);
                    setEndTime(
                      event.target.value
                    );
                  }}
                  required
                />
                <p className="mt-1 text-xs text-slate-500">
                  Use this if the game already ended and you are adding it later.
                </p>
              </div>

              {manualEndRequiresLoser && !isDouble && (
                <div>
                  <Label>Who lost?</Label>
                  <select
                    className="mt-2 w-full rounded-md border bg-white p-2 text-sm"
                    value={manualLoser}
                    onChange={(event) =>
                      setManualLoser(
                        event.target.value
                      )
                    }
                  >
                    <option value="">
                      Select the player who lost
                    </option>
                    {singleManualLoserOptions.map(
                      (player) => (
                        <option
                          key={player}
                          value={player}
                        >
                          {player} lost
                        </option>
                      )
                    )}
                  </select>
                </div>
              )}

              {manualEndRequiresLoser && isDouble && (
                <div>
                  <Label>Who lost?</Label>
                  <select
                    className="mt-2 w-full rounded-md border bg-white p-2 text-sm"
                    value={manualLoser}
                    onChange={(event) =>
                      setManualLoser(
                        event.target.value
                      )
                    }
                  >
                    <option value="">
                      Select the losing team
                    </option>
                    {doubleManualLoserOptions.map(
                      (option) => (
                        <option
                          key={option.value}
                          value={option.value}
                        >
                          {option.label}
                        </option>
                      )
                    )}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {timeError && (
      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200">
          {timeError}
      </p>
      )}

      {onUndoLastFrame &&
        canUndoLastFrame && (
          <Button
            type="button"
            variant="outline"
            className="w-full border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
            onClick={onUndoLastFrame}
            disabled={undoLastFrameBusy}
          >
            Undo Last Frame
          </Button>
        )}

      <Button
        type="submit"
        className="w-full"
      >
        {submitLabel}
      </Button>
    </form>
  );
}

export default SessionForm;
