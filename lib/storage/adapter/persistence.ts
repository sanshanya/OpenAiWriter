// lib/storage/adapter/persistence.ts
"use client";

import type { Value } from "platejs";
import { STORAGE_CONFIG } from "@/lib/storage/constants";
import type { DocumentMeta } from "@/types/storage";
import { idbPutDoc } from "@/lib/storage/local/idb";
import { StorageLogger } from "@/lib/storage/logger";

type PersistTask = {
  meta: DocumentMeta;
  content: Value;
};

const pending = new Map<string, PersistTask>();
let idleScheduled = false;

function scheduleFlushOnIdle() {
  if (idleScheduled) return;
  idleScheduled = true;

  const runner = () => {
    idleScheduled = false;
    const tasks = Array.from(pending.values());
    pending.clear();

    (async () => {
      const t0 = performance.now();
      for (const { meta, content } of tasks) {
        await idbPutDoc({
          id: meta.id,
          title: meta.title,
          version: meta.version,
          updatedAt: meta.updatedAt,
          createdAt: meta.createdAt,
          deletedAt: meta.deletedAt ?? undefined,
          content,
        });
        StorageLogger.persist(meta.id, meta.version);
      }
      const cost = Math.round(performance.now() - t0);
      StorageLogger.perf("idbFlush", cost);
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

export function persistDocChange(meta: DocumentMeta, content: Value) {
  pending.set(meta.id, { meta, content });
  scheduleFlushOnIdle();
}
