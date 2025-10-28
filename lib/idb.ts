// lib/idb.ts
import type { StoredDocument } from "@/hooks/use-persistence";

const DB_NAME = "aiwriter-docs";
const STORE_NAME = "documents";
const DB_VERSION = 2; // 升级版本，以便未来加索引等

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not available"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      let store: IDBObjectStore;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
      } else {
        store = req.transaction!.objectStore(STORE_NAME);
      }
      // 新增：按 deletedAt 建索引，便于未来做清理
      if (!store.indexNames.contains("by_deletedAt")) {
        store.createIndex("by_deletedAt", "deletedAt", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function writeToIndexedDB(document: StoredDocument): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put(document); // 直接存对象，content 保持为 Value
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.warn("[IDB] write fail:", err);
  }
}

export async function recoverAllFromIndexedDB(): Promise<StoredDocument[]> {
  const db = await openDB();
  const docs = await new Promise<StoredDocument[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const res: StoredDocument[] = [];
    const cursorReq = store.openCursor();
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        res.push(cursor.value as StoredDocument);
        cursor.continue();
      } else {
        resolve(res);
      }
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });
  db.close();
  return docs;
}

export async function checkIndexedDBHealth(): Promise<{
  available: boolean;
  documentCount: number;
  lastSyncTime: number | null;
}> {
  try {
    const db = await openDB();
    const documentCount = await new Promise<number>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const countReq = store.count();
      countReq.onsuccess = () => resolve(countReq.result || 0);
      countReq.onerror = () => reject(countReq.error);
    });
    db.close();
    const lastSyncTime = Number(localStorage.getItem("aiwriter:idb:lastSync") || "0") || null;
    return { available: true, documentCount, lastSyncTime };
  } catch {
    return { available: false, documentCount: 0, lastSyncTime: null };
  }
}

export function markIndexedDBSyncedNow() {
  try {
    localStorage.setItem("aiwriter:idb:lastSync", String(Date.now()));
  } catch {}
}

// ✅ 新增：按 id 删除
export async function deleteFromIndexedDB(id: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

// ✅ 新增：按墓碑时间批量清理，返回删除数
export async function purgeDeletedOlderThan(cutoffMs: number): Promise<number> {
  const db = await openDB();
  let removed = 0;
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index("by_deletedAt"); // 依赖之前创建的索引
    const range = IDBKeyRange.upperBound(cutoffMs, true);
    const cursorReq = index.openCursor(range);
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (!cursor) return;
      const rec: any = cursor.value;
      if (typeof rec.deletedAt === "number" && rec.deletedAt < cutoffMs) {
        store.delete(rec.id);
        removed++;
      }
      cursor.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  return removed;
}
