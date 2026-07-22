import {
  Coffee,
  History,
  Package,
  MoreHorizontal,
  ShoppingBag,
  Pencil,
  Plus,
  Play,
  Pause,
  Trash2,
  Square,
} from "lucide-react";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  frameElapsed: string;
  timerLabel?: string;
  showFrameFeatures?: boolean;
  isPaused?: boolean;
  onPause?: () => void;
  onAddCharge?: () => void;
  onEdit?: () => void;
  onCafe?: () => void;
  onAccessories?: () => void;
  onHistory?: () => void;
  onOutsidePurchase?: () => void;
  onCancelSession?: () => void;
  onEndSession: () => void;
}

function RunningPanel({
  frameElapsed,
  timerLabel = "Current frame",
  showFrameFeatures = false,
  isPaused = false,
  onPause,
  onAddCharge,
  onEdit,
  onCafe,
  onAccessories,
  onHistory,
  onOutsidePurchase,
  onCancelSession,
  onEndSession,
}: Props) {
  const [moreOpen, setMoreOpen] = useState(false);
  return (
    <div className="mt-auto space-y-3 border-t pt-3">
      {showFrameFeatures && (
        <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
          <p className="text-xs font-medium text-slate-500">{timerLabel}</p>
          <p className="font-mono text-xl font-bold tabular-nums leading-tight text-blue-700">
            {frameElapsed}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button
          className="h-9 gap-1.5"
          title={isPaused ? "Resume" : onAddCharge ? "Add Frame - A" : "Pause"}
          onClick={isPaused || !onAddCharge ? onPause : onAddCharge}
        >
          {isPaused ? (
            <Play className="h-4 w-4" />
          ) : onAddCharge ? (
            <Plus className="h-4 w-4" />
          ) : (
            <Pause className="h-4 w-4" />
          )}
          {isPaused ? "Resume" : onAddCharge ? "Add Frame" : "Pause"}
        </Button>

        <Button
          variant="destructive"
          className="h-9 gap-1.5"
          title="End Session - E"
          onClick={onEndSession}
        >
          <Square className="h-4 w-4" />
          End Session
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {!isPaused && onAddCharge && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1 px-2 text-xs"
            onClick={onPause}
          >
            <Pause className="h-3.5 w-3.5" />
            Pause
          </Button>
        )}
        {isPaused && showFrameFeatures && onAddCharge && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1 px-2 text-xs"
            onClick={onAddCharge}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Frame
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1 px-2 text-xs"
          onClick={onEdit}
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Button>
        {onAccessories && (
          <Button variant="outline" size="sm" className="h-8 gap-1 px-2 text-xs" onClick={(event) => {
            event.stopPropagation();
            onAccessories();
          }}>
            <Package className="h-3.5 w-3.5" /> Accessories
          </Button>
        )}
      </div>

      {onCafe && (
        <Button
          variant="outline"
          className="h-11 w-full gap-2 border-emerald-200 bg-emerald-50 text-sm font-semibold text-emerald-800 hover:border-emerald-300 hover:bg-emerald-100"
          title="Cafe - C"
          onClick={(event) => {
            event.stopPropagation();
            onCafe();
          }}
        >
          <Coffee className="h-4 w-4" />
          Cafe
        </Button>
      )}

      <div className="space-y-1.5">
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-full gap-1.5 text-xs"
          onClick={(event) => {
            event.stopPropagation();
            setMoreOpen((value) => !value);
          }}
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
          More Actions
        </Button>
        {moreOpen && (
          <div className="flex flex-wrap gap-1.5 rounded-md border bg-slate-50 p-2">
            {onOutsidePurchase && (
              <Button variant="outline" size="sm" className="h-8 gap-1 px-2 text-xs" onClick={(event) => {
                event.stopPropagation();
                setMoreOpen(false);
                onOutsidePurchase();
              }}>
                <ShoppingBag className="h-3.5 w-3.5" /> Customer Outside Purchase
              </Button>
            )}
            {onHistory && (
          <Button variant="outline" size="sm" className="h-8 gap-1 px-2 text-xs" onClick={(event) => {
            event.stopPropagation();
            onHistory();
          }}>
            <History className="h-3.5 w-3.5" /> History
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1 border-amber-200 bg-amber-50 px-2 text-xs text-amber-800 hover:bg-amber-100"
          onClick={onCancelSession}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Cancel Session
        </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default RunningPanel;
