import { Button } from "@/components/ui/button";

interface Props {
  elapsed: string;
  onEndSession: () => void;
  onPause?: () => void;
  onEdit?: () => void;
}

function RunningPanel({
  elapsed,
  onEndSession,
  onPause,
  onEdit,
}: Props) {
  return (
    <div className="space-y-5 border-t pt-5">
      <div>
        <p className="text-sm text-gray-500">
          Elapsed Time
        </p>

        <p className="text-3xl font-bold text-red-600 tracking-wide">
          {elapsed}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Button
          variant="outline"
          onClick={onPause}
          disabled
        >
          ⏸ Pause
        </Button>

        <Button
          variant="outline"
          onClick={onEdit}
          disabled
        >
          ✏ Edit
        </Button>

        <Button
          variant="destructive"
          onClick={onEndSession}
        >
          🛑 End
        </Button>
      </div>
    </div>
  );
}

export default RunningPanel;