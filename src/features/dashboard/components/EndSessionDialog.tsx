import {
  Trophy,
  UserCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Table } from "@/types/table";

interface Props {
  open: boolean;
  table: Table;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: {
    winnerName?: string;
    loserName?: string;
    payerName?: string;
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

  const players = [
    session.player1,
    session.player2,
  ].filter(Boolean) as string[];

  const handleWinner = (
    winnerName: string
  ) => {
    const loserName =
      players.find(
        (player) => player !== winnerName
      ) ?? winnerName;

    onConfirm({
      winnerName,
      loserName,
      payerName: loserName,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Who won?
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-500">
              Select the winner before ending this session.
            </p>
            <p className="mt-1 text-sm text-slate-500">
              The loser will be selected as payer by default.
            </p>
          </div>

          <div className="grid gap-3">
            {players.map((player) => (
              <Button
                key={player}
                size="lg"
                className="h-14 justify-start gap-3 text-base"
                onClick={() =>
                  handleWinner(player)
                }
              >
                <Trophy className="h-5 w-5" />
                {player} Won
              </Button>
            ))}
          </div>

          <Button
            variant="outline"
            className="h-12 w-full gap-2"
            onClick={() =>
              onConfirm({
                payerName: players[0],
              })
            }
          >
            <UserCheck className="h-4 w-4" />
            End without winner
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default EndSessionDialog;
