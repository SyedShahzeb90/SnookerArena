import {
  memo,
  type PointerEvent,
  type ReactNode,
} from "react";
import { Grip } from "lucide-react";

import type { FloorPlanPosition } from "./useFloorPlanStore";

interface Props {
  title: string;
  description: string;
  icon: ReactNode;
  position: FloorPlanPosition;
  editMode: boolean;
  tone: string;
  compact?: boolean;
  onPointerDown: (
    event: PointerEvent<HTMLDivElement>
  ) => void;
}

function FloorPlanZone({
  title,
  description,
  icon,
  position,
  editMode,
  tone,
  compact = false,
  onPointerDown,
}: Props) {
  return (
    <div
      onPointerDown={
        editMode ? onPointerDown : undefined
      }
      className={`absolute z-10 select-none rounded-lg border bg-white/95 shadow-md transition-all duration-200 hover:scale-[1.02] hover:shadow-xl ${
        editMode ? "cursor-grab active:cursor-grabbing" : ""
      } ${compact ? "px-3 py-2" : "w-[min(210px,22vw)] p-3"}`}
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: "translate(-50%, -50%)",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-md ${tone}`}
          >
            {icon}
          </div>

          <div>
            <p className="text-sm font-bold text-slate-950">
              {title}
            </p>
            <p className="text-xs text-slate-500">
              {description}
            </p>
          </div>
        </div>

        {editMode && (
          <Grip className="h-4 w-4 text-slate-400" />
        )}
      </div>
    </div>
  );
}

export default memo(FloorPlanZone);
