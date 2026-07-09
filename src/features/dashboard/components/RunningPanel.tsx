import {
  Pencil,
  Play,
  Pause,
  Square,
} from "lucide-react";

import { Button } from "@/components/ui/button";

interface Props {
  elapsed: string;
  isPaused?: boolean;
  onPause?: () => void;
  onEdit?: () => void;
  onEndSession: () => void;
}

function RunningPanel({
  elapsed,
  isPaused = false,
  onPause,
  onEdit,
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

      <div className="grid grid-cols-3 gap-2">
        <Button
          variant="outline"
          className="gap-2"
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
          className="gap-2"
          onClick={onEdit}
        >
          <Pencil className="h-4 w-4" />
          Edit
        </Button>

        <Button
          variant="destructive"
          className="gap-2"
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
