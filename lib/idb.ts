// lib/idb.ts
"use client";

import type { StoredDocument } from "@/hooks/use-persistence";

const DB_NAME = "aiwriter-docs";
const STORE_NAME = "documents";
const DB_VERSION = 3; // 升级版本，便于未来扩索引

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
      if (!store.indexNames.contains("by_deletedAt")) {
        store.createIndex("by_deletedAt", "deletedAt", { unique: false });
      }
      if (!store.indexNames.contains("by_updatedAt")) {
        store.createIndex("by_updatedAt", "updatedAt", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** 读取单文档 */
export async function idbGetDoc(id: string): Promise<StoredDocument | null> {
  const db = await openDB();
  try {
    const doc = await new Promise<StoredDocument | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve((req.result as StoredDocument) ?? null);
      req.onerror = () => reject(req.error);
    });
    return doc;
  } finally {
    db.close();
  }
}

/**
 * UPSERT：写入文档（保留既有字段）
 * 允许 deletedAt = number | null | undefined
 */
export async function idbPutDoc(
  partial: Partial<StoredDocument> & { id: string }
): Promise<void> {
  const db = await openDB();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);

      const getReq = store.get(partial.id);

      getReq.onsuccess = () => {
        const existing = (getReq.result as StoredDocument) ?? {};
        const merged = {
          ...existing,
          ...partial,
          id: partial.id, // 确保 id 不被覆盖
        };
        store.put(merged);
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("[IDB] put fail:", err);
  } finally {
    db.close();
  }
}

/** 兼容旧接口：整条写入 */
export async function writeToIndexedDB(document: StoredDocument): Promise<void> {
  const db = await openDB();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put(document);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("[IDB] write fail:", err);
  } finally {
    db.close();
  }
}

/** 全量恢复（含未删+已删） */
export async function recoverAllFromIndexedDB(): Promise<StoredDocument[]> {
  const db = await openDB();
  try {
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
    return docs;
  } finally {
    db.close();
  }
}

/** 健康检查 */
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

/** 标记最近一次持久化时间 */
export function markIndexedDBSyncedNow() {
  try {
    localStorage.setItem("aiwriter:idb:lastSync", String(Date.now()));
  } catch {}
}

/** 物理删除 */
export async function deleteFromIndexedDB(id: string): Promise<void> {
  const db = await openDB();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** 清理超期墓碑 */
export async function purgeDeletedOlderThan(cutoffMs: number): Promise<number> {
  const db = await openDB();
  let removed = 0;
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const index = store.index("by_deletedAt");
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
    return removed;
  } finally {
    db.close();
  }
}
