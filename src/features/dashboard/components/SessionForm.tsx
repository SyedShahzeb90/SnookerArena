import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { SessionType } from "@/types/session";

interface Props {
  onSubmit: (data: {
    player1: string;
    player2: string;
    sessionType: SessionType;
    startTime: Date;
  }) => void;
}

function SessionForm({ onSubmit }: Props) {
  const [player1, setPlayer1] = useState("");
  const [player2, setPlayer2] = useState("");

  const [sessionType, setSessionType] =
    useState<SessionType>("single");

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();

        console.log("✅ SessionForm Submitted");

        onSubmit({
          player1,
          player2,
          sessionType,
          startTime: new Date(),
        });
      }}
    >
      <div>
        <Label>Player 1</Label>

        <Input
          value={player1}
          onChange={(e) => setPlayer1(e.target.value)}
          placeholder="Optional"
        />
      </div>

      <div>
        <Label>Player 2</Label>

        <Input
          value={player2}
          onChange={(e) => setPlayer2(e.target.value)}
          placeholder="Optional"
        />
      </div>

      <div>
        <Label>Session Type</Label>

        <select
          className="mt-2 w-full rounded-md border p-2"
          value={sessionType}
          onChange={(e) =>
            setSessionType(e.target.value as SessionType)
          }
        >
          <option value="single">Single Game</option>
          <option value="double">Double Game</option>
          <option value="time">Time Booking</option>
          <option value="private">Private Room</option>
        </select>
      </div>

      <Button type="submit" className="w-full">
        Start Session
      </Button>
    </form>
  );
}

export default SessionForm;