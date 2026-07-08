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

function StartSessionDialog({
  open,
  table,
  onOpenChange,
}: Props) {
  const startSession = useTableStore(
    (state) => state.startSession
  );

  if (!table) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Start Session - {table.name}
          </DialogTitle>
        </DialogHeader>

        <SessionForm
          onSubmit={(data) => {
            startSession({
              tableId: table.id,
              player1: data.player1,
              player2: data.player2,
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

export default StartSessionDialog;