// lib/storage/adapter/persistence.ts
"use client";

import { STORAGE_CONFIG } from "@/lib/storage/constants";
import type { DocumentMeta } from "@/types/storage";
import { idbPutDoc, idbPutMany, markIndexedDBSyncedNow } from "@/lib/storage/local/idb";
import { StorageLogger } from "@/lib/storage/logger";
import type { MyValue } from "@/types/plate-elements";

type PersistTask = {
  meta: DocumentMeta;
  content: MyValue;
};

const pending = new Map<string, PersistTask>();
const pendingVersions = new Map<string, number>();
let idleScheduled = false;
const BULK_WRITE_THRESHOLD = STORAGE_CONFIG.IDB_BULK_WRITE_THRESHOLD;

function scheduleFlushOnIdle() {
  if (idleScheduled) return;
  idleScheduled = true;

  const runner = () => {
    idleScheduled = false;
    const tasks = Array.from(pending.values());
    pending.clear();
    const versionSnapshot = new Map(pendingVersions);
    pendingVersions.clear();
    if (tasks.length === 0) {
      return;
    }

    (async () => {
      const t0 = performance.now();
      const payload = tasks
        .map(({ meta, content }) => ({
          id: meta.id,
          title: meta.title,
          version: meta.version,
          updatedAt: meta.updatedAt,
          createdAt: meta.createdAt,
          contentVersion: versionSnapshot.get(meta.id) ?? meta.contentVersion,
          deletedAt: meta.deletedAt ?? undefined,
          content,
        }))
        .sort(
          (a, b) =>
            (versionSnapshot.get(a.id) ?? a.contentVersion) -
            (versionSnapshot.get(b.id) ?? b.contentVersion),
        );

      if (payload.length >= BULK_WRITE_THRESHOLD) {
        StorageLogger.batch("idbFlush", payload.length, "bulk");
        await idbPutMany(payload);
        payload.forEach(({ id, version }) => {
          StorageLogger.persist(id, version);
        });
      } else {
        StorageLogger.batch("idbFlush", payload.length, "single");
        for (const entry of payload) {
          await idbPutDoc(entry);
          StorageLogger.persist(entry.id, entry.version);
        }
      }
      const cost = Math.round(performance.now() - t0);
      StorageLogger.perf("idbFlush", cost);
      markIndexedDBSyncedNow();
    })().catch((error) => {
      StorageLogger.error("persistFlush", error);
    });
  };

  const win = window as Window & {
    requestIdleCallback?: (cb: IdleRequestCallback, opts?: IdleRequestOptions) => number;
  };
  if (typeof win.requestIdleCallback === "function") {
    win.requestIdleCallback(runner, {
      timeout: STORAGE_CONFIG.IDB_FLUSH_IDLE_TIMEOUT_MS,
    });
  } else {
    setTimeout(runner, STORAGE_CONFIG.IDB_FLUSH_IDLE_TIMEOUT_MS);
  }
}

export function persistDocChange(meta: DocumentMeta, content: MyValue) {
  pending.set(meta.id, { meta, content });
  pendingVersions.set(meta.id, meta.contentVersion);
  scheduleFlushOnIdle();
}

export async function flushPendingWritesNow(): Promise<void> {
  // 仅退出流程调用
  const tasks = Array.from(pending.values());
  pending.clear();
  const versionSnapshot = new Map(pendingVersions);
  pendingVersions.clear();
  idleScheduled = false;

  if (tasks.length === 0) {
    return;
  }

  const payload = tasks
    .map(({ meta, content }) => ({
      id: meta.id,
      title: meta.title,
      version: meta.version,
      updatedAt: meta.updatedAt,
      createdAt: meta.createdAt,
      contentVersion: versionSnapshot.get(meta.id) ?? meta.contentVersion,
      deletedAt: meta.deletedAt ?? undefined,
      content,
    }))
    .sort(
      (a, b) =>
        (versionSnapshot.get(a.id) ?? a.contentVersion) -
        (versionSnapshot.get(b.id) ?? b.contentVersion),
    );

  StorageLogger.batch("idbFlushNow", payload.length, "bulk");
  const t0 = performance.now();
  try {
    await idbPutMany(payload);
    tasks.forEach(({ meta }) => {
      StorageLogger.persist(meta.id, meta.version);
    });
    const cost = Math.round(performance.now() - t0);
    StorageLogger.perf("idbFlushNow", cost);
    markIndexedDBSyncedNow();
  } catch (error) {
    StorageLogger.error("persistFlushNow", error);
    throw error;
  }
}
