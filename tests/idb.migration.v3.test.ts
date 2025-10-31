import "fake-indexeddb/auto";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { STORAGE_KEYS } from "../lib/storage/constants";
import {
  recoverAllFromIndexedDB,
  purgeDeletedOlderThan,
} from "../lib/storage/local/idb";

const { IDB_NAME, IDB_STORE, IDB_VERSION } = STORAGE_KEYS;

async function seedLegacyDatabase() {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, IDB_VERSION - 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      const store = db.createObjectStore(IDB_STORE, { keyPath: "id" });
      const now = Date.now();
      store.put({
        id: "doc-legacy-alive",
        title: "",
        content: [],
        version: 1,
        createdAt: now - 5_000,
        updatedAt: now - 5_000,
      });
      store.put({
        id: "doc-legacy-deleted",
        title: "",
        content: [],
        version: 1,
        createdAt: now - 10_000,
        updatedAt: now - 10_000,
        deletedAt: now - 10_000,
      });
    };
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

describe("IndexedDB migration v3", () => {
  beforeEach(async () => {
    await seedLegacyDatabase();
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      const del = indexedDB.deleteDatabase(IDB_NAME);
      del.onsuccess = () => resolve();
      del.onerror = () => reject(del.error);
    });
  });

  it("upgrades missing indexes and preserves data", async () => {
    const records = await recoverAllFromIndexedDB();
    expect(records).toHaveLength(2);
    const upgraded = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(IDB_NAME, IDB_VERSION);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const tx = upgraded.transaction(IDB_STORE, "readonly");
      const store = tx.objectStore(IDB_STORE);
      const indexNames = Array.from(store.indexNames);
      expect(indexNames).toContain("by_deletedAt");
      expect(indexNames).toContain("by_updatedAt");
    } finally {
      upgraded.close();
    }

    const removed = await purgeDeletedOlderThan(Date.now() - 1);
    expect(removed).toBeGreaterThanOrEqual(1);
  });
});
