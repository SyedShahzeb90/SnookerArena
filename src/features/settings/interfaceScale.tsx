import { useEffect, type ReactNode } from "react";

import {
  DEFAULT_CLUB_SETTINGS,
  useClubSettingsStore,
  type ClubSettings,
} from "./store/clubSettingsStore";

export const INTERFACE_SCALE_OPTIONS = [80, 90, 100, 110, 120] as const;
export type InterfaceScale = (typeof INTERFACE_SCALE_OPTIONS)[number];

const BASE_FONT_SIZE_PX = 16;
const SETTINGS_STORAGE_KEY = "snooker-arena-club-settings";

export function isInterfaceScale(value: unknown): value is InterfaceScale {
  return (
    typeof value === "number" &&
    INTERFACE_SCALE_OPTIONS.includes(value as InterfaceScale)
  );
}

export function applyInterfaceScale(scale: ClubSettings["interfaceScale"]) {
  const root = document.documentElement;
  const safeScale = isInterfaceScale(scale)
    ? scale
    : DEFAULT_CLUB_SETTINGS.interfaceScale;

  root.style.fontSize = `${(BASE_FONT_SIZE_PX * safeScale) / 100}px`;
  root.dataset.interfaceScale = String(safeScale);
}

function getStoredInterfaceScale(): ClubSettings["interfaceScale"] {
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!stored) return DEFAULT_CLUB_SETTINGS.interfaceScale;

    const parsed = JSON.parse(stored) as {
      state?: { settings?: Partial<ClubSettings> };
    };
    const scale = parsed.state?.settings?.interfaceScale;

    return isInterfaceScale(scale)
      ? scale
      : DEFAULT_CLUB_SETTINGS.interfaceScale;
  } catch {
    return DEFAULT_CLUB_SETTINGS.interfaceScale;
  }
}

export function initializeInterfaceScale() {
  applyInterfaceScale(getStoredInterfaceScale());
}

export function InterfaceScaleProvider({ children }: { children: ReactNode }) {
  const interfaceScale = useClubSettingsStore(
    (state) => state.settings.interfaceScale,
  );

  useEffect(() => {
    applyInterfaceScale(interfaceScale);
  }, [interfaceScale]);

  return children;
}

export function DisplayDensityProvider({ children }: { children: ReactNode }) {
  const density = useClubSettingsStore((state) => state.settings.displayDensity);

  useEffect(() => {
    document.documentElement.dataset.displayDensity = ["comfortable", "compact", "touch"].includes(density)
      ? density
      : "comfortable";
  }, [density]);

  return children;
}
