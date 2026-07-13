import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCustomerAccountStore } from "@/features/customers/store/customerAccountStore";
import {
  formatOpenCustomerOption,
  getBillPrimaryLabel,
  getBillSearchText,
} from "@/features/customers/utils/billDisplay";

import type {
  Session,
  SessionType,
} from "@/types/session";
import type { Table } from "@/types/table";

type CustomerEntryMode = "quick" | "existing";

interface Props {
  tableType: Table["type"];

  session?: Session;

  allowManualEndTime?: boolean;

  submitLabel?: string;

  onSubmit: (data: {
    player1: string;
    player1CustomerId?: string;
    player2: string;
    player2CustomerId?: string;
    player3: string;
    player3CustomerId?: string;
    player4: string;
    player4CustomerId?: string;
    extraPlayers: string[];
    teamAOneNameEnough: boolean;
    teamBOneNameEnough: boolean;
    sessionType: SessionType;
    startTime: Date;
    endTime?: Date;
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

function SessionForm({
  tableType,
  session,
  allowManualEndTime = false,
  submitLabel = "Start Session",
  onSubmit,
}: Props) {
  const [player1, setPlayer1] =
    useState("");
  const [player1CustomerId, setPlayer1CustomerId] =
    useState("");
  const [player1Mode, setPlayer1Mode] =
    useState<CustomerEntryMode>("quick");
  const [player1CustomerSearch, setPlayer1CustomerSearch] =
    useState("");

  const [player2, setPlayer2] =
    useState("");
  const [player2CustomerId, setPlayer2CustomerId] =
    useState("");
  const [player2Mode, setPlayer2Mode] =
    useState<CustomerEntryMode>("quick");
  const [player2CustomerSearch, setPlayer2CustomerSearch] =
    useState("");
  const [player3, setPlayer3] =
    useState("");
  const [player3CustomerId, setPlayer3CustomerId] =
    useState("");
  const [player3Mode, setPlayer3Mode] =
    useState<CustomerEntryMode>("quick");
  const [player3CustomerSearch, setPlayer3CustomerSearch] =
    useState("");
  const [player4, setPlayer4] =
    useState("");
  const [player4CustomerId, setPlayer4CustomerId] =
    useState("");
  const [player4Mode, setPlayer4Mode] =
    useState<CustomerEntryMode>("quick");
  const [player4CustomerSearch, setPlayer4CustomerSearch] =
    useState("");
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
  const [manualEndEnabled, setManualEndEnabled] =
    useState(false);
  const [endTime, setEndTime] =
    useState("");
  const [endTimeEdited, setEndTimeEdited] =
    useState(false);
  const [timeError, setTimeError] =
    useState("");
  const customerAccounts =
    useCustomerAccountStore(
      (state) => state.accounts
    );
  const activeCustomers =
    customerAccounts.filter(
      (account) =>
        account.status === "active" &&
        account.paymentStatus === "unpaid" &&
        (account.gameCharges.length > 0 ||
          account.cafeCharges.length > 0 ||
          (account.accessoryCharges ?? [])
            .length > 0)
    );

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
    search: string,
    setSearch: (value: string) => void,
    required = false
  ) => {
    const searchQuery =
      search.trim().toLowerCase();
    const filteredCustomers =
      searchQuery
        ? activeCustomers.filter((customer) =>
            getBillSearchText(customer).includes(
              searchQuery
            )
          )
        : activeCustomers;
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
              setSearch("");
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
            <Input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search bill no, name, note, table..."
              className="bg-white"
            />
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
              {filteredCustomers.map((customer) => (
                <option
                  key={customer.id}
                  value={customer.id}
                >
                  {formatOpenCustomerOption(
                    customer
                  )}
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
      setManualEndEnabled(false);
      setEndTime("");
      setTimeError("");
    } else {
      setPlayer1("");
      setPlayer1CustomerId("");
      setPlayer1Mode("quick");
      setPlayer1CustomerSearch("");

      setPlayer2("");
      setPlayer2CustomerId("");
      setPlayer2Mode("quick");
      setPlayer2CustomerSearch("");
      setPlayer3("");
      setPlayer3CustomerId("");
      setPlayer3Mode("quick");
      setPlayer3CustomerSearch("");
      setPlayer4("");
      setPlayer4CustomerId("");
      setPlayer4Mode("quick");
      setPlayer4CustomerSearch("");
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
      setManualEndEnabled(false);
      setEndTime("");
      setTimeError("");
    }
  }, [session, tableType, customerAccounts]);

  const isDouble =
    sessionType === "double";
  const isPrivateRoom =
    tableType === "private-room";
  const isBooking =
    sessionType === "time" ||
    sessionType === "private";
  const priceText =
    sessionType === "single"
      ? "Price: Rs. 300 fixed"
      : sessionType === "double"
        ? "Price: Rs. 600 fixed"
        : sessionType === "time"
          ? "Booking Rate: Rs. 1200/hour or Rs. 20/min"
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
          new Date(startTime);
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

        onSubmit({
          player1: player1.trim(),
          player1CustomerId:
            player1CustomerId || undefined,
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
          player3: isDouble
            ? player3.trim()
            : "",
          player3CustomerId: isDouble
            ? player3CustomerId || undefined
            : undefined,
          player4:
            isDouble && !teamBOneName
              ? player4.trim()
              : "",
          player4CustomerId:
            isDouble && !teamBOneName
              ? player4CustomerId || undefined
              : undefined,
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
        });
      }}
    >
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
                      setPlayer2CustomerSearch("");
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
                player1CustomerSearch,
                setPlayer1CustomerSearch,
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
                  player2CustomerSearch,
                  setPlayer2CustomerSearch,
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
                      setPlayer4CustomerSearch("");
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
                player3CustomerSearch,
                setPlayer3CustomerSearch,
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
                  player4CustomerSearch,
                  setPlayer4CustomerSearch,
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
            setPlayer1Mode,
            player1CustomerSearch,
            setPlayer1CustomerSearch
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
            setPlayer1Mode,
            player1CustomerSearch,
            setPlayer1CustomerSearch
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
              setPlayer2Mode,
              player2CustomerSearch,
              setPlayer2CustomerSearch
            )
          )}
        </>
      )}

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

      <div>
        <Label>
          Start Time
        </Label>

        <Input
          type="datetime-local"
          value={startTime}
          onChange={(e) =>
            setStartTime(
              e.target.value
            )
          }
        />
      </div>

      {allowManualEndTime && (
        <div className="space-y-3 rounded-lg border bg-slate-50 p-3">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
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
          </label>

          {manualEndEnabled && (
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
          )}
        </div>
      )}

      {timeError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200">
          {timeError}
        </p>
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
