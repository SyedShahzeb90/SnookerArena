import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type {
  Session,
  SessionType,
} from "@/types/session";
import type { Table } from "@/types/table";

interface Props {
  tableType: Table["type"];

  session?: Session;

  submitLabel?: string;

  onSubmit: (data: {
    player1: string;
    player2: string;
    sessionType: SessionType;
    startTime: Date;
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
  submitLabel = "Start Session",
  onSubmit,
}: Props) {
  const [player1, setPlayer1] =
    useState("");

  const [player2, setPlayer2] =
    useState("");

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

  useEffect(() => {
    if (session) {
      setPlayer1(session.player1);

      setPlayer2(
        session.player2 ?? ""
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
    } else {
      setPlayer1("");

      setPlayer2("");

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
    }
  }, [session, tableType]);

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();

        onSubmit({
          player1,
          player2,
          sessionType,
          startTime:
            new Date(startTime),
        });
      }}
    >
      <div>
        <Label>Player 1</Label>

        <Input
          value={player1}
          onChange={(e) =>
            setPlayer1(
              e.target.value
            )
          }
          placeholder="Optional"
        />
      </div>

      <div>
        <Label>Player 2</Label>

        <Input
          value={player2}
          onChange={(e) =>
            setPlayer2(
              e.target.value
            )
          }
          placeholder="Optional"
        />
      </div>

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
              Private Booking
            </option>
          )}
        </select>
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