import {
  CircleX,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Table } from "@/types/table";
import { getSessionPlayers } from "@/features/sessions/utils/sessionPlayers";
import { getDoubleGameTeams } from "@/features/sessions/utils/doubleGameBilling";

interface Props {
  open: boolean;
  table: Table;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: {
    winnerName?: string;
    loserName?: string;
    payerName?: string;
    payerCustomerId?: string;
    winningTeam?: "A" | "B";
    losingTeam?: "A" | "B";
  }) => void;
}

function EndSessionDialog({
  open,
  table,
  onOpenChange,
  onConfirm,
}: Props) {
  const session = table.session;

  if (!session) return null;

  const players =
    getSessionPlayers(session);
  const isDouble =
    session.sessionType === "double";
  const teams = getDoubleGameTeams(session);
  const teamALabel =
    teams.teamAPlayers.join(", ") ||
    "Team A";
  const teamBLabel =
    teams.teamBPlayers.join(", ") ||
    "Team B";

  const handleLoser = (
    loserName: string,
    payerCustomerId?: string
  ) => {
    const winnerName =
      players.find(
        (player) => player !== loserName
      ) ?? loserName;

    onConfirm({
      winnerName,
      loserName,
      payerName: loserName,
      payerCustomerId,
    });
  };

  const singlePlayerOptions = [
    {
      slot: "Player 1",
      name:
        session.player1?.trim() ||
        "Walk-in Customer",
      customerId: session.player1CustomerId,
    },
    {
      slot: "Player 2",
      name: session.player2?.trim(),
      customerId: session.player2CustomerId,
    },
  ].filter((player) => player.name) as {
    slot: string;
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
            {isDouble
              ? "Who lost?"
              : "Who lost?"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-500">
              Select the loser before ending this session.
            </p>
            <p className="mt-1 text-sm text-slate-500">
              The loser will be selected as payer by default.
            </p>
          </div>

          {isDouble ? (
            <div className="grid gap-3">
              <Button
                size="lg"
                className="h-14 justify-start gap-3 text-base"
                onClick={() =>
                  onConfirm({
                    winnerName: teamBLabel,
                    loserName: teamALabel,
                    winningTeam: "B",
                    losingTeam: "A",
                    payerName:
                      teams.teamAPlayers[0],
                  })
                }
              >
                <CircleX className="h-5 w-5" />
                {teamALabel} Lost
              </Button>
              <Button
                size="lg"
                className="h-14 justify-start gap-3 text-base"
                onClick={() =>
                  onConfirm({
                    winnerName: teamALabel,
                    loserName: teamBLabel,
                    winningTeam: "A",
                    losingTeam: "B",
                    payerName:
                      teams.teamBPlayers[0],
                  })
                }
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
                      player.name,
                      player.customerId
                    )
                  }
                >
                  <CircleX className="h-5 w-5" />
                  <span className="flex flex-col items-start leading-tight">
                    <span>
                      {player.name} Lost
                    </span>
                    {singlePlayerOptions.filter(
                      (item) =>
                        item.name === player.name
                    ).length > 1 && (
                      <span className="text-xs font-normal opacity-80">
                        {player.slot}
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
