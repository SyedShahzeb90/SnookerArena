import {
  Pencil,
  Play,
  Pause,
  Trash2,
  Square,
} from "lucide-react";

import { Button } from "@/components/ui/button";

interface Props {
  elapsed: string;
  isPaused?: boolean;
  onPause?: () => void;
  onEdit?: () => void;
  onCancelSession?: () => void;
  onEndSession: () => void;
}

function RunningPanel({
  elapsed,
  isPaused = false,
  onPause,
  onEdit,
  onCancelSession,
  onEndSession,
}: Props) {
  return (
    <div className="space-y-4 border-t pt-4">
      <div className="flex items-center justify-between rounded-lg bg-red-50 px-4 py-3">
        <p className="text-sm font-medium text-red-700">
          Elapsed Time
        </p>

        <p className="font-mono text-2xl font-bold text-red-700">
          {elapsed}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <Button
          variant="outline"
          className="gap-1 px-2"
          onClick={onPause}
        >
          {isPaused ? (
            <Play className="h-4 w-4" />
          ) : (
            <Pause className="h-4 w-4" />
          )}
          {isPaused ? "Resume" : "Pause"}
        </Button>

        <Button
          variant="outline"
          className="gap-1 px-2"
          onClick={onEdit}
        >
          <Pencil className="h-4 w-4" />
          Edit
        </Button>

        <Button
          variant="outline"
          className="gap-1 border-amber-200 bg-amber-50 px-2 text-amber-800 hover:bg-amber-100"
          onClick={onCancelSession}
        >
          <Trash2 className="h-4 w-4" />
          Cancel
        </Button>

        <Button
          variant="destructive"
          className="gap-1 px-2"
          onClick={onEndSession}
        >
          <Square className="h-4 w-4" />
          End
        </Button>
      </div>
    </div>
  );
}

export default RunningPanel;
