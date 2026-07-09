import { create } from "zustand";

export interface FloorPlanPosition {
  x: number;
  y: number;
}

interface FloorPlanStore {
  positions: Record<number, FloorPlanPosition>;
  zones: Record<string, FloorPlanPosition>;
  setPosition: (
    tableId: number,
    position: FloorPlanPosition
  ) => void;
  setZonePosition: (
    zoneId: string,
    position: FloorPlanPosition
  ) => void;
  resetPositions: () => void;
}

const TABLE_STORAGE_KEY =
  "snooker-arena-floor-plan-positions";
const ZONE_STORAGE_KEY =
  "snooker-arena-floor-plan-zones";

const defaultPositions: Record<
  number,
  FloorPlanPosition
> = {
  1: { x: 12, y: 20 },
  2: { x: 39, y: 20 },
  3: { x: 66, y: 20 },
  4: { x: 25, y: 40 },
  5: { x: 53, y: 40 },
  6: { x: 12, y: 61 },
  7: { x: 39, y: 61 },
  8: { x: 66, y: 61 },
  9: { x: 25, y: 80 },
  10: { x: 53, y: 80 },
};

const defaultZones: Record<
  string,
  FloorPlanPosition
> = {
  entrance: { x: 50, y: 6 },
  reception: { x: 38, y: 92 },
  cafe: { x: 64, y: 92 },
};

function loadRecord(
  storageKey: string,
  fallback: Record<
    string | number,
    FloorPlanPosition
  >
) {
  try {
    const stored =
      window.localStorage.getItem(
        storageKey
      );

    if (!stored) return fallback;

    return {
      ...fallback,
      ...JSON.parse(stored),
    };
  } catch {
    return fallback;
  }
}

function persistRecord(
  storageKey: string,
  positions: Record<
    string | number,
    FloorPlanPosition
  >
) {
  window.localStorage.setItem(
    storageKey,
    JSON.stringify(positions)
  );
}

export const useFloorPlanStore =
  create<FloorPlanStore>((set) => ({
    positions: loadRecord(
      TABLE_STORAGE_KEY,
      defaultPositions
    ),
    zones: loadRecord(
      ZONE_STORAGE_KEY,
      defaultZones
    ),

    setPosition: (tableId, position) =>
      set((state) => {
        const positions = {
          ...state.positions,
          [tableId]: position,
        };

        persistRecord(
          TABLE_STORAGE_KEY,
          positions
        );

        return { positions };
      }),

    setZonePosition: (zoneId, position) =>
      set((state) => {
        const zones = {
          ...state.zones,
          [zoneId]: position,
        };

        persistRecord(
          ZONE_STORAGE_KEY,
          zones
        );

        return { zones };
      }),

    resetPositions: () =>
      set(() => {
        persistRecord(
          TABLE_STORAGE_KEY,
          defaultPositions
        );
        persistRecord(
          ZONE_STORAGE_KEY,
          defaultZones
        );

        return {
          positions: defaultPositions,
          zones: defaultZones,
        };
      }),
  }));
