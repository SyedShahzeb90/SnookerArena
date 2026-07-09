import {
  useCallback,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import {
  Coffee,
  DoorOpen,
  ConciergeBell,
} from "lucide-react";

import BillingDialog from "@/features/billing/components/BillingDialog";
import StartSessionDialog from "@/features/dashboard/components/StartSessionDialog";
import useCurrentTime from "@/features/dashboard/hooks/useCurrentTime";
import { useTableStore } from "@/store/tableStore";
import type { PaymentMethod } from "@/types/session";
import type { Table } from "@/types/table";

import FloorPlanTable from "./FloorPlanTable";
import FloorPlanToolbar from "./FloorPlanToolbar";
import FloorPlanZone from "./FloorPlanZone";
import {
  useFloorPlanStore,
  type FloorPlanPosition,
} from "./useFloorPlanStore";

function clamp(value: number) {
  return Math.min(Math.max(value, 5), 95);
}

function getPointerPosition(
  event: PointerEvent<HTMLDivElement>,
  element: HTMLDivElement
): FloorPlanPosition {
  const rect = element.getBoundingClientRect();

  return {
    x: clamp(
      ((event.clientX - rect.left) /
        rect.width) *
        100
    ),
    y: clamp(
      ((event.clientY - rect.top) /
        rect.height) *
        100
    ),
  };
}

function FloorPlanView() {
  const now = useCurrentTime();
  const floorRef = useRef<HTMLDivElement>(null);

  const tables = useTableStore(
    (state) => state.tables
  );
  const receivePayment = useTableStore(
    (state) => state.receivePayment
  );
  const positions = useFloorPlanStore(
    (state) => state.positions
  );
  const zones = useFloorPlanStore(
    (state) => state.zones
  );
  const setPosition = useFloorPlanStore(
    (state) => state.setPosition
  );
  const setZonePosition = useFloorPlanStore(
    (state) => state.setZonePosition
  );
  const resetPositions = useFloorPlanStore(
    (state) => state.resetPositions
  );

  const [editMode, setEditMode] =
    useState(false);
  const [draggingTableId, setDraggingTableId] =
    useState<number | null>(null);
  const [draggingZoneId, setDraggingZoneId] =
    useState<string | null>(null);
  const [selectedTable, setSelectedTable] =
    useState<Table | null>(null);
  const [activeDialog, setActiveDialog] =
    useState<
      "start-session" | "billing" | null
    >(null);

  const handleTableClick = useCallback(
    (table: Table) => {
      setSelectedTable(table);

      switch (table.status) {
        case "available":
          setActiveDialog("start-session");
          break;

        case "payment-pending":
          setActiveDialog("billing");
          break;

        default:
          setActiveDialog(null);
          break;
      }
    },
    []
  );

  const handlePointerDown = useCallback(
    (
      tableId: number,
      event: PointerEvent<HTMLDivElement>
    ) => {
      if (!floorRef.current) return;

      event.preventDefault();
      event.currentTarget.setPointerCapture(
        event.pointerId
      );
      setDraggingTableId(tableId);
      setPosition(
        tableId,
        getPointerPosition(
          event,
          floorRef.current
        )
      );
    },
    [setPosition]
  );

  const handleZonePointerDown = useCallback(
    (
      zoneId: string,
      event: PointerEvent<HTMLDivElement>
    ) => {
      if (!floorRef.current) return;

      event.preventDefault();
      event.currentTarget.setPointerCapture(
        event.pointerId
      );
      setDraggingZoneId(zoneId);
      setZonePosition(
        zoneId,
        getPointerPosition(
          event,
          floorRef.current
        )
      );
    },
    [setZonePosition]
  );

  const handlePointerMove = (
    event: PointerEvent<HTMLDivElement>
  ) => {
    if (!floorRef.current) {
      return;
    }

    const position = getPointerPosition(
      event,
      floorRef.current
    );

    if (draggingTableId !== null) {
      setPosition(
        draggingTableId,
        position
      );
    }

    if (draggingZoneId !== null) {
      setZonePosition(
        draggingZoneId,
        position
      );
    }
  };

  const handlePointerUp = () => {
    setDraggingTableId(null);
    setDraggingZoneId(null);
  };

  const closeDialog = () => {
    setActiveDialog(null);
  };

  const handleReceivePayment = (
    paymentMethod: PaymentMethod
  ) => {
    if (!selectedTable) return;

    receivePayment({
      tableId: selectedTable.id,
      paymentMethod,
    });

    closeDialog();
  };

  return (
    <section className="animate-in fade-in duration-300">
      <FloorPlanToolbar
        editMode={editMode}
        onEditModeChange={setEditMode}
        onReset={resetPositions}
      />

      <div
        ref={floorRef}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="relative min-h-[760px] overflow-hidden rounded-xl border border-slate-200 bg-[linear-gradient(90deg,rgba(148,163,184,0.13)_1px,transparent_1px),linear-gradient(rgba(148,163,184,0.13)_1px,transparent_1px)] bg-[size:36px_36px] shadow-sm"
      >
        <FloorPlanZone
          title="Entrance"
          description="Main access"
          icon={<DoorOpen className="h-5 w-5" />}
          position={
            zones.entrance ?? { x: 50, y: 6 }
          }
          editMode={editMode}
          compact
          tone="bg-slate-950 text-white"
          onPointerDown={(event) =>
            handleZonePointerDown(
              "entrance",
              event
            )
          }
        />

        <FloorPlanZone
          title="Reception"
          description="Check-ins and billing"
          icon={
            <ConciergeBell className="h-5 w-5" />
          }
          position={
            zones.reception ?? {
              x: 38,
              y: 92,
            }
          }
          editMode={editMode}
          tone="bg-indigo-950 text-white"
          onPointerDown={(event) =>
            handleZonePointerDown(
              "reception",
              event
            )
          }
        />

        <FloorPlanZone
          title="Cafe"
          description="Food and drinks"
          icon={<Coffee className="h-5 w-5" />}
          position={
            zones.cafe ?? { x: 64, y: 92 }
          }
          editMode={editMode}
          tone="bg-emerald-950 text-white"
          onPointerDown={(event) =>
            handleZonePointerDown(
              "cafe",
              event
            )
          }
        />

        {tables.map((table) => (
          <FloorPlanTable
            key={table.id}
            table={table}
            position={
              positions[table.id] ?? {
                x: 50,
                y: 50,
              }
            }
            cafeAmount={
              table.session?.cafeAmount ?? 0
            }
            now={now}
            editMode={editMode}
            onClick={() =>
              handleTableClick(table)
            }
            onPointerDown={(event) =>
              handlePointerDown(
                table.id,
                event
              )
            }
          />
        ))}
      </div>

      <StartSessionDialog
        open={activeDialog === "start-session"}
        table={selectedTable}
        onOpenChange={(open) =>
          setActiveDialog(
            open ? "start-session" : null
          )
        }
      />

      {selectedTable?.session && (
        <BillingDialog
          open={activeDialog === "billing"}
          session={selectedTable.session}
          onClose={closeDialog}
          onReceivePayment={handleReceivePayment}
        />
      )}
    </section>
  );
}

export default FloorPlanView;
