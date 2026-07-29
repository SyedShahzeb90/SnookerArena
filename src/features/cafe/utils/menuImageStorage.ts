import type { MenuItem } from "../types/menu";

export const CAFE_IMAGE_DATABASE_NAME = "snooker-arena-cafe-images";

const IMAGE_STORE_NAME = "images";
const DATABASE_VERSION = 1;

interface StoredMenuImage {
  id: string;
  dataUrl: string;
  updatedAt: string;
}

let databasePromise: Promise<IDBDatabase> | undefined;
const migrationPromises = new Map<string, Promise<string>>();

function openImageDatabase() {
  if (!databasePromise) {
    databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(CAFE_IMAGE_DATABASE_NAME, DATABASE_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(IMAGE_STORE_NAME)) {
          database.createObjectStore(IMAGE_STORE_NAME, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error ?? new Error("The Cafe image store could not be opened."));
    });
  }

  return databasePromise;
}

function transactionComplete(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("The Cafe image could not be saved."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("The Cafe image save was cancelled."));
  });
}

export function createMenuImageKey(menuItemId?: string) {
  const suffix =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `menu-image-${menuItemId ?? suffix}`;
}

export function resolveLegacyMenuImageSource(source?: string) {
  const value = source?.trim();
  if (!value) return undefined;

  if (/^data:image\//i.test(value)) return value;

  if (
    /^blob:/i.test(value) ||
    /^file:/i.test(value) ||
    /^[a-z]:[\\/]/i.test(value)
  ) {
    return undefined;
  }

  try {
    const url = new URL(value, window.location.href);
    if (!["http:", "https:"].includes(url.protocol)) return undefined;

    if (
      ["localhost", "127.0.0.1"].includes(url.hostname) &&
      url.origin !== window.location.origin
    ) {
      return new URL(
        `${url.pathname}${url.search}${url.hash}`,
        window.location.origin
      ).href;
    }

    return url.href;
  } catch {
    return undefined;
  }
}

export async function saveMenuImage(imageKey: string, dataUrl: string) {
  if (!/^data:image\//i.test(dataUrl)) {
    throw new Error("Only embedded image data can be saved.");
  }

  const database = await openImageDatabase();
  const transaction = database.transaction(IMAGE_STORE_NAME, "readwrite");
  transaction.objectStore(IMAGE_STORE_NAME).put({
    id: imageKey,
    dataUrl,
    updatedAt: new Date().toISOString(),
  } satisfies StoredMenuImage);
  await transactionComplete(transaction);
}

export async function getMenuImage(imageKey: string) {
  const database = await openImageDatabase();
  return new Promise<string | undefined>((resolve, reject) => {
    const transaction = database.transaction(IMAGE_STORE_NAME, "readonly");
    const request = transaction.objectStore(IMAGE_STORE_NAME).get(imageKey);
    request.onsuccess = () => {
      const record = request.result as StoredMenuImage | undefined;
      resolve(record?.dataUrl);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteMenuImage(imageKey?: string) {
  if (!imageKey) return;
  const database = await openImageDatabase();
  const transaction = database.transaction(IMAGE_STORE_NAME, "readwrite");
  transaction.objectStore(IMAGE_STORE_NAME).delete(imageKey);
  await transactionComplete(transaction);
}

export async function resolveMenuImage(item: MenuItem) {
  if (item.imageKey) {
    try {
      const storedImage = await getMenuImage(item.imageKey);
      if (storedImage) return storedImage;
    } catch {
      // A legacy embedded image remains a safe fallback.
    }
  }

  return resolveLegacyMenuImageSource(item.imageDataUrl);
}

export function migrateEmbeddedMenuImage(item: MenuItem) {
  const embeddedImage = resolveLegacyMenuImageSource(item.imageDataUrl);
  if (item.imageKey || !embeddedImage || !embeddedImage.startsWith("data:image/")) {
    return Promise.resolve(item.imageKey);
  }

  const existingMigration = migrationPromises.get(item.id);
  if (existingMigration) return existingMigration;

  const imageKey = createMenuImageKey(item.id);
  const migration = saveMenuImage(imageKey, embeddedImage)
    .then(() => imageKey)
    .finally(() => migrationPromises.delete(item.id));
  migrationPromises.set(item.id, migration);
  return migration;
}
