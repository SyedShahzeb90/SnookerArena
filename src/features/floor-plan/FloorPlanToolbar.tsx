import { RotateCcw, Save } from "lucide-react";

import { Button } from "@/components/ui/button";

interface Props {
  editMode: boolean;
  onEditModeChange: (
    editMode: boolean
  ) => void;
  onReset: () => void;
}

function FloorPlanToolbar({
  editMode,
  onEditModeChange,
  onReset,
}: Props) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white px-4 py-3 shadow-sm">
      <div>
        <h3 className="font-bold text-slate-950">
          Floor Plan View
        </h3>
        <p className="text-sm text-slate-500">
          Drag tables in edit mode to match the physical club layout.
        </p>
      </div>

      <div className="flex items-center gap-2">
        {editMode && (
          <Button
            variant="outline"
            className="gap-2"
            onClick={onReset}
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        )}

        <Button
          className={
            editMode
              ? "gap-2 bg-emerald-700 hover:bg-emerald-800"
              : "gap-2 bg-slate-950 hover:bg-slate-800"
          }
          onClick={() =>
            onEditModeChange(!editMode)
          }
        >
          <Save className="h-4 w-4" />
          {editMode ? "Save Layout" : "Edit Layout"}
        </Button>
      </div>
    </div>
  );
}

export default FloorPlanToolbar;
