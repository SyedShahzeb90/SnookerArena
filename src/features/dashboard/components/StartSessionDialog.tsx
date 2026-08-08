import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { useTableStore } from "@/store/tableStore";
import { useCustomerAccountStore } from "@/features/customers/store/customerAccountStore";
import { isWalkInName } from "@/features/sessions/utils/walkInLabel";

import type { Table } from "@/types/table";

import SessionForm from "./SessionForm";

interface Props {
  open: boolean;
  table: Table | null;
  onOpenChange: (open: boolean) => void;
}

function StartSessionDialog({
  open,
  table,
  onOpenChange,
}: Props) {
  const startSession = useTableStore(
    (state) => state.startSession
  );
  const createCustomerAccount =
    useCustomerAccountStore(
      (state) => state.createCustomerAccount
    );
  const getOrCreateActiveCustomerByIdOrName =
    useCustomerAccountStore(
      (state) =>
        state.getOrCreateActiveCustomerByIdOrName
    );

  const resolveSessionCustomerId = (
    name: string,
    customerId?: string,
    mode: "quick" | "existing" = "quick"
  ) => {
    const customerName =
      name.trim() || "Walk-in Customer";

    if (customerId) {
      return customerId;
    }

    if (mode === "quick" || isWalkInName(customerName)) {
      return createCustomerAccount({
        customerName: isWalkInName(customerName)
          ? "Walk-in Customer"
          : customerName,
      }).id;
    }

    return getOrCreateActiveCustomerByIdOrName({
      customerName,
    }).id;
  };

  if (!table) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="flex max-h-[calc(100vh-3rem)] w-[min(94vw,680px)] flex-col overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Start Session - {table.name}
          </DialogTitle>
        </DialogHeader>

        <SessionForm
          tableId={table.id}
          tableType={table.type}
          allowManualEndTime
          submitLabel="Start Session"
          onSubmit={(data) => {
            const player1Name =
              data.player1.trim() ||
              "Walk-in Customer";
            const player1CustomerId =
              resolveSessionCustomerId(
                player1Name,
                data.player1CustomerId,
                data.player1Mode
              );
            const player2CustomerId =
              data.player2.trim()
                ? resolveSessionCustomerId(
                    data.player2,
                    data.player2CustomerId,
                    data.player2Mode
                  )
                : undefined;
            const player3CustomerId =
              data.player3.trim()
                ? resolveSessionCustomerId(
                    data.player3,
                    data.player3CustomerId,
                    data.player3Mode
                  )
                : undefined;
            const player4CustomerId =
              data.player4.trim()
                ? resolveSessionCustomerId(
                    data.player4,
                    data.player4CustomerId,
                    data.player4Mode
                  )
                : undefined;
            const extraPlayerCustomerIds =
              data.extraPlayers.map(
                (name, index) =>
                  resolveSessionCustomerId(
                    name,
                    data.extraPlayerCustomerIds[
                      index
                    ],
                    data.extraPlayerModes[index]
                  )
              );

            startSession({
              tableId: table.id,
              player1: player1Name,
              player1CustomerId,
              player2: data.player2,
              player2CustomerId,
              player3: data.player3,
              player3CustomerId,
              player4: data.player4,
              player4CustomerId,
              extraPlayers: data.extraPlayers,
              extraPlayerCustomerIds,
              teamAOneNameEnough:
                data.teamAOneNameEnough,
              teamBOneNameEnough:
                data.teamBOneNameEnough,
              centuryTeamSize:
                data.centuryTeamSize,
              sessionType: data.sessionType,
              startTime: data.startTime,
              endTime: data.endTime,
              winnerName: data.winnerName,
              loserName: data.loserName,
              payerName: data.payerName,
              winningTeam: data.winningTeam,
              losingTeam: data.losingTeam,
              isFinal: data.isFinal,
              finalGames: data.finalGames,
            });

            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

export default StartSessionDialog;
