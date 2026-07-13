import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { useTableStore } from "@/store/tableStore";

import type { Table } from "@/types/table";

import SessionForm from "./SessionForm";

interface Props {
  open: boolean;
  table: Table | null;
  onOpenChange: (open: boolean) => void;
}

function EditSessionDialog({
  open,
  table,
  onOpenChange,
}: Props) {
  const updateSession = useTableStore(
    (state) => state.updateSession
  );

  if (!table || !table.session) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Edit Session - {table.name}
          </DialogTitle>
        </DialogHeader>

        <SessionForm
          tableType={table.type}
          session={table.session}
          submitLabel="Save Changes"
          onSubmit={(data) => {
            updateSession({
              tableId: table.id,
              player1: data.player1,
              player1CustomerId:
                data.player1CustomerId,
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
            });

            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

export default EditSessionDialog;
