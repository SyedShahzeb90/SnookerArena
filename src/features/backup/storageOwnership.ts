export const SNOOKER_ARENA_LOCAL_STORAGE_KEYS = [
  "snooker-arena-tables",
  "snooker-arena-sales",
  "snooker-arena-checkout",
  "snooker-arena-cafe",
  "snooker-arena-accessories",
  "snooker-arena-expenses",
  "snooker-arena-table-history",
  "snooker-arena-business-day",
  "snooker-arena-customer-accounts",
  "snooker-arena-credit-ledger",
  "snooker-arena-advance-games",
  "snooker-arena-outside-purchases",
  "snooker-arena-floor-plan-positions",
  "snooker-arena-floor-plan-zones",
  "snooker-arena-theme",
  "snooker-arena-club-settings",
] as const;

// Add future application-owned IndexedDB names here before using them.
export const SNOOKER_ARENA_INDEXED_DB_NAMES = [] as const;

export type SnookerArenaStorageKey =
  (typeof SNOOKER_ARENA_LOCAL_STORAGE_KEYS)[number];
