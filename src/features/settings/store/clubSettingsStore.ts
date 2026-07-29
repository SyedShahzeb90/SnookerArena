import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { PaymentMethod } from "@/types/session";

export interface ClubOperator {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export type RunningCardView = "full" | "compact-expand";

export interface ClubSettings {
  clubName: string;
  tagline: string;
  customLogoDataUrl?: string;
  customLogoFit: "contain" | "cover" | "fill";
  interfaceScale: 80 | 90 | 100 | 110 | 120;
  displayDensity: "comfortable" | "compact" | "touch";
  runningTableCardView: RunningCardView;
  timeFormat: "12-hour" | "24-hour";
  dateFormat: "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
  phone: string;
  address: string;
  currency: "PKR";
  singleGameRate: number;
  doubleGameRate: number;
  tableBookingRatePerMinute: number;
  frameWarningMinutes: number;
  frameDangerMinutes: number;
  defaultPaymentMethod: PaymentMethod;
  invoicePrefix: string;
  backupReminderEnabled: boolean;
  operators: ClubOperator[];
  adminPinHash: string;
  adminPinSalt: string;
}

export const DEFAULT_CLUB_SETTINGS: ClubSettings = {
  clubName: "Snooker Arena",
  tagline: "Club Management System",
  customLogoDataUrl: undefined,
  customLogoFit: "contain",
  interfaceScale: 100,
  displayDensity: "comfortable",
  runningTableCardView: "compact-expand",
  timeFormat: "12-hour",
  dateFormat: "DD/MM/YYYY",
  phone: "",
  address: "",
  currency: "PKR",
  singleGameRate: 300,
  doubleGameRate: 600,
  tableBookingRatePerMinute: 20,
  frameWarningMinutes: 25,
  frameDangerMinutes: 30,
  defaultPaymentMethod: "cash",
  invoicePrefix: "INV",
  backupReminderEnabled: false,
  operators: [],
  adminPinHash: "",
  adminPinSalt: "",
};

const paymentMethods: PaymentMethod[] = [
  "cash",
  "easypaisa",
  "jazzcash",
  "card",
];

export function validateClubSettings(input: ClubSettings): string[] {
  const errors: string[] = [];
  if (!input.clubName.trim()) errors.push("Club name is required.");
  if (!input.tagline.trim()) errors.push("Header subtitle is required.");
  if (![80, 90, 100, 110, 120].includes(input.interfaceScale)) {
    errors.push("Select a supported interface scale.");
  }
  if (!["comfortable", "compact", "touch"].includes(input.displayDensity)) {
    errors.push("Select a supported display density.");
  }
  if (!["full", "compact-expand"].includes(input.runningTableCardView)) {
    errors.push("Select a supported running table card view.");
  }
  if (!["contain", "cover", "fill"].includes(input.customLogoFit)) {
    errors.push("Select a supported logo fit mode.");
  }
  if (!["12-hour", "24-hour"].includes(input.timeFormat)) {
    errors.push("Select a supported time format.");
  }
  if (!["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"].includes(input.dateFormat)) {
    errors.push("Select a supported date format.");
  }
  if (input.currency !== "PKR") errors.push("Only PKR is currently supported.");

  const rates = [
    ["Single Game Rate", input.singleGameRate],
    ["Double Game Rate", input.doubleGameRate],
    ["Table Booking Rate", input.tableBookingRatePerMinute],
  ] as const;
  rates.forEach(([label, value]) => {
    if (!Number.isFinite(value) || value < 0 || value > 1_000_000) {
      errors.push(`${label} must be between 0 and 1,000,000.`);
    }
  });

  if (!Number.isInteger(input.frameWarningMinutes) || input.frameWarningMinutes <= 0) {
    errors.push("Warning time must be a whole number greater than zero.");
  }
  if (!Number.isInteger(input.frameDangerMinutes) || input.frameDangerMinutes <= input.frameWarningMinutes) {
    errors.push("Danger time must be a whole number greater than warning time.");
  }
  if (!paymentMethods.includes(input.defaultPaymentMethod)) {
    errors.push("Select a supported default payment method.");
  }
  if (!/^[A-Z0-9-]{1,12}$/i.test(input.invoicePrefix.trim())) {
    errors.push("Invoice prefix must be 1-12 letters, numbers, or hyphens.");
  }
  const operatorIds = new Set<string>();
  const operatorNames = new Set<string>();
  input.operators.forEach((operator) => {
    const name = operator.name.trim();
    const normalizedName = name.toLocaleLowerCase();
    if (!operator.id.trim() || !name) {
      errors.push("Every operator must have an ID and name.");
    }
    if (operatorIds.has(operator.id)) {
      errors.push("Operator IDs must be unique.");
    }
    if (operatorNames.has(normalizedName)) {
      errors.push("Operator names must be unique.");
    }
    operatorIds.add(operator.id);
    operatorNames.add(normalizedName);
  });
  if (Boolean(input.adminPinHash) !== Boolean(input.adminPinSalt)) {
    errors.push("Admin PIN security data is incomplete.");
  }
  return errors;
}

interface ClubSettingsStore {
  settings: ClubSettings;
  getSettings: () => ClubSettings;
  updateSettings: (settings: ClubSettings) => void;
  resetSettingsToDefaults: () => void;
}

export const useClubSettingsStore = create<ClubSettingsStore>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_CLUB_SETTINGS,
      getSettings: () => get().settings,
      updateSettings: (settings) => set({ settings }),
      resetSettingsToDefaults: () =>
        set((state) => ({
          settings: {
            ...DEFAULT_CLUB_SETTINGS,
            operators: state.settings.operators,
            adminPinHash: state.settings.adminPinHash,
            adminPinSalt: state.settings.adminPinSalt,
          },
        })),
    }),
    {
      name: "snooker-arena-club-settings",
      version: 2,
      migrate: (persistedState, version) => {
        const stored = persistedState as Partial<ClubSettingsStore> | undefined;
        const storedSettings: Partial<ClubSettings> = stored?.settings ?? {};

        return {
          ...stored,
          settings: {
            ...storedSettings,
            ...(version < 1
              ? { runningTableCardView: "compact-expand" as const }
              : {}),
            ...(version < 2 && storedSettings.interfaceScale === 80
              ? { interfaceScale: 100 as const }
              : {}),
          },
        };
      },
      merge: (persisted, current) => {
        const stored = persisted as Partial<ClubSettingsStore> | undefined;
        return {
          ...current,
          ...stored,
          settings: {
            ...DEFAULT_CLUB_SETTINGS,
            ...(stored?.settings ?? {}),
            operators: Array.isArray(stored?.settings?.operators)
              ? stored.settings.operators
              : [],
          },
        };
      },
    }
  )
);
