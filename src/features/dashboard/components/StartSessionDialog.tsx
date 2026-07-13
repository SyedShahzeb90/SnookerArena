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

  if (!table) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="flex max-h-[calc(100vh-5rem)] w-[min(92vw,480px)] flex-col overflow-hidden sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Start Session - {table.name}
          </DialogTitle>
        </DialogHeader>

        <SessionForm
          tableType={table.type}
          allowManualEndTime
          submitLabel="Start Session"
          onSubmit={(data) => {
            const player1Name =
              data.player1.trim() ||
              "Walk-in Customer";
            const player1CustomerId =
              data.player1CustomerId ??
              createCustomerAccount({
                customerName: isWalkInName(
                  player1Name
                )
                  ? "Walk-in Customer"
                  : player1Name,
              }).id;

            startSession({
              tableId: table.id,
              player1: data.player1,
              player1CustomerId,
              player2: data.player2,
              player2CustomerId:
                data.player2CustomerId,
              player3: data.player3,
              player3CustomerId:
                data.player3CustomerId,
              player4: data.player4,
              player4CustomerId:
                data.player4CustomerId,
              extraPlayers: data.extraPlayers,
              teamAOneNameEnough:
                data.teamAOneNameEnough,
              teamBOneNameEnough:
                data.teamBOneNameEnough,
              sessionType: data.sessionType,
              startTime: data.startTime,
              endTime: data.endTime,
            });

            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

export default StartSessionDialog;
