import {
  SNOOKER_ARENA_INDEXED_DB_NAMES,
  SNOOKER_ARENA_LOCAL_STORAGE_KEYS,
} from "./storageOwnership";

export const BACKUP_VERSION = 1;
export const BACKUP_APP_NAME = "Snooker Arena" as const;

interface IndexedDbIndexBackup {
  name: string;
  keyPath: string | string[];
  unique: boolean;
  multiEntry: boolean;
}

interface IndexedDbStoreBackup {
  name: string;
  keyPath: string | string[] | null;
  autoIncrement: boolean;
  indexes: IndexedDbIndexBackup[];
  records: Array<{ key: IDBValidKey; value: unknown }>;
}

interface IndexedDbDatabaseBackup {
  version: number;
  stores: IndexedDbStoreBackup[];
}

export interface SnookerArenaBackup {
  appName: typeof BACKUP_APP_NAME;
  backupVersion: number;
  exportedAt: string;
  appVersion?: string;
  localStorage: Record<string, string>;
  indexedDb: Record<string, IndexedDbDatabaseBackup>;
}

export interface BackupSummary {
  localStorageRecords: number;
  indexedDbDatabases: number;
  indexedDbStores: number;
  indexedDbRecords: number;
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

function transactionComplete(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction failed."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction was aborted."));
  });
}

async function databaseExists(name: string) {
  if (!("databases" in indexedDB)) return true;
  const databases = await indexedDB.databases();
  return databases.some((database) => database.name === name);
}

async function exportIndexedDatabase(
  name: string
): Promise<IndexedDbDatabaseBackup | undefined> {
  if (!(await databaseExists(name))) return undefined;

  const database = await requestResult(indexedDB.open(name));
  try {
    const storeNames = Array.from(database.objectStoreNames);
    const stores: IndexedDbStoreBackup[] = [];

    for (const storeName of storeNames) {
      const transaction = database.transaction(storeName, "readonly");
      const store = transaction.objectStore(storeName);
      const keys = await requestResult(store.getAllKeys());
      const values = await requestResult(store.getAll());
      await transactionComplete(transaction);

      stores.push({
        name: storeName,
        keyPath: store.keyPath,
        autoIncrement: store.autoIncrement,
        indexes: Array.from(store.indexNames).map((indexName) => {
          const index = store.index(indexName);
          return {
            name: index.name,
            keyPath: index.keyPath,
            unique: index.unique,
            multiEntry: index.multiEntry,
          };
        }),
        records: values.map((value, index) => ({
          key: keys[index],
          value,
        })),
      });
    }

    return { version: database.version, stores };
  } finally {
    database.close();
  }
}

async function deleteIndexedDatabase(name: string) {
  await requestResult(indexedDB.deleteDatabase(name));
}

async function restoreIndexedDatabase(
  name: string,
  backup: IndexedDbDatabaseBackup
) {
  await deleteIndexedDatabase(name);
  const openRequest = indexedDB.open(name, Math.max(1, backup.version));
  openRequest.onupgradeneeded = () => {
    const database = openRequest.result;
    backup.stores.forEach((storeBackup) => {
      const store = database.createObjectStore(storeBackup.name, {
        keyPath: storeBackup.keyPath,
        autoIncrement: storeBackup.autoIncrement,
      });
      storeBackup.indexes.forEach((index) => {
        store.createIndex(index.name, index.keyPath, {
          unique: index.unique,
          multiEntry: index.multiEntry,
        });
      });
    });
  };
  const database = await requestResult(openRequest);

  try {
    for (const storeBackup of backup.stores) {
      const transaction = database.transaction(storeBackup.name, "readwrite");
      const store = transaction.objectStore(storeBackup.name);
      storeBackup.records.forEach((record) => {
        if (store.keyPath === null) {
          store.put(record.value, record.key);
        } else {
          store.put(record.value);
        }
      });
      await transactionComplete(transaction);
    }
  } finally {
    database.close();
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isValidDatabaseBackup(value: unknown): value is IndexedDbDatabaseBackup {
  if (
    !isObject(value) ||
    !Number.isInteger(value.version) ||
    (value.version as number) < 1 ||
    !Array.isArray(value.stores)
  ) {
    return false;
  }
  return value.stores.every(
    (store) =>
      isObject(store) &&
      typeof store.name === "string" &&
      (store.keyPath === null || typeof store.keyPath === "string" ||
        (Array.isArray(store.keyPath) && store.keyPath.every((item) => typeof item === "string"))) &&
      typeof store.autoIncrement === "boolean" &&
      Array.isArray(store.indexes) &&
      store.indexes.every(
        (index) =>
          isObject(index) &&
          typeof index.name === "string" &&
          (typeof index.keyPath === "string" ||
            (Array.isArray(index.keyPath) &&
              index.keyPath.every((item) => typeof item === "string"))) &&
          typeof index.unique === "boolean" &&
          typeof index.multiEntry === "boolean"
      ) &&
      Array.isArray(store.records) &&
      store.records.every((record) => isObject(record) && "key" in record && "value" in record)
  );
}

export function validateApplicationBackup(value: unknown): SnookerArenaBackup {
  if (!isObject(value)) throw new Error("The selected file is not a valid backup object.");
  if (value.appName !== BACKUP_APP_NAME) throw new Error("This backup does not belong to Snooker Arena.");
  if (value.backupVersion !== BACKUP_VERSION) throw new Error("This backup version is not supported.");
  if (value.appVersion !== undefined && typeof value.appVersion !== "string") {
    throw new Error("The backup application version is invalid.");
  }
  if (typeof value.exportedAt !== "string" || Number.isNaN(Date.parse(value.exportedAt))) {
    throw new Error("The backup creation date is missing or invalid.");
  }
  if (!isObject(value.localStorage) || !isObject(value.indexedDb)) {
    throw new Error("The backup storage sections are missing or invalid.");
  }

  const allowedKeys = new Set<string>(SNOOKER_ARENA_LOCAL_STORAGE_KEYS);
  for (const [key, storedValue] of Object.entries(value.localStorage)) {
    if (!allowedKeys.has(key) || typeof storedValue !== "string") {
      throw new Error(`The backup contains an unsupported local storage record: ${key}.`);
    }
    if (key !== "snooker-arena-theme") {
      try {
        JSON.parse(storedValue);
      } catch {
        throw new Error(`The backup record ${key} contains invalid JSON.`);
      }
    }
  }

  const allowedDatabases = new Set<string>(SNOOKER_ARENA_INDEXED_DB_NAMES);
  for (const [name, database] of Object.entries(value.indexedDb)) {
    if (!allowedDatabases.has(name) || !isValidDatabaseBackup(database)) {
      throw new Error(`The backup contains an unsupported or invalid database: ${name}.`);
    }
  }

  if (Object.keys(value.localStorage).length === 0 && Object.keys(value.indexedDb).length === 0) {
    throw new Error("The backup is empty.");
  }

  return value as unknown as SnookerArenaBackup;
}

export function summarizeBackup(backup: SnookerArenaBackup): BackupSummary {
  const databases = Object.values(backup.indexedDb);
  return {
    localStorageRecords: Object.keys(backup.localStorage).length,
    indexedDbDatabases: databases.length,
    indexedDbStores: databases.reduce((total, database) => total + database.stores.length, 0),
    indexedDbRecords: databases.reduce(
      (total, database) =>
        total + database.stores.reduce((storeTotal, store) => storeTotal + store.records.length, 0),
      0
    ),
  };
}

async function collectApplicationData(): Promise<SnookerArenaBackup> {
  const localStorageRecords: Record<string, string> = {};
  SNOOKER_ARENA_LOCAL_STORAGE_KEYS.forEach((key) => {
    const value = localStorage.getItem(key);
    if (value !== null) localStorageRecords[key] = value;
  });

  const indexedDbRecords: SnookerArenaBackup["indexedDb"] = {};
  for (const name of SNOOKER_ARENA_INDEXED_DB_NAMES) {
    const database = await exportIndexedDatabase(name);
    if (database) indexedDbRecords[name] = database;
  }

  return {
    appName: BACKUP_APP_NAME,
    backupVersion: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: import.meta.env.VITE_APP_VERSION ?? "0.0.0",
    localStorage: localStorageRecords,
    indexedDb: indexedDbRecords,
  };
}

export async function exportApplicationBackup(): Promise<SnookerArenaBackup> {
  const backup = await collectApplicationData();
  if (Object.keys(backup.localStorage).length === 0 && Object.keys(backup.indexedDb).length === 0) {
    throw new Error("There is no Snooker Arena application data to export.");
  }
  return backup;
}

export async function createStorageSnapshot() {
  return collectApplicationData();
}

async function replaceOwnedStorage(backup: SnookerArenaBackup) {
  SNOOKER_ARENA_LOCAL_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
  for (const name of SNOOKER_ARENA_INDEXED_DB_NAMES) {
    await deleteIndexedDatabase(name);
  }

  Object.entries(backup.localStorage).forEach(([key, value]) => {
    localStorage.setItem(key, value);
  });
  for (const [name, database] of Object.entries(backup.indexedDb)) {
    await restoreIndexedDatabase(name, database);
  }
}

export async function restoreStorageSnapshot(snapshot: SnookerArenaBackup) {
  await replaceOwnedStorage(snapshot);
}

export async function restoreApplicationBackup(input: unknown) {
  const backup = validateApplicationBackup(input);
  const snapshot = await createStorageSnapshot();
  try {
    await replaceOwnedStorage(backup);
  } catch (error) {
    try {
      await restoreStorageSnapshot(snapshot);
    } catch {
      throw new Error("Restore failed and the previous data could not be recovered. Do not close this browser tab.");
    }
    throw error;
  }
}

export function downloadApplicationBackup(backup: SnookerArenaBackup) {
  const date = new Date(backup.exportedAt);
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-") + `-${String(date.getHours()).padStart(2, "0")}${String(date.getMinutes()).padStart(2, "0")}`;
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `snooker-arena-backup-${stamp}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
