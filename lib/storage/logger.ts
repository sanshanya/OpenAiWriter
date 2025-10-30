// lib/storage/logger.ts
const DEBUG = process.env.NODE_ENV === "development";

export const StorageLogger = {
  persist(docId: string, version: number) {
    if (DEBUG) {
      console.debug("[Storage] Persist", { docId, version });
    }
  },
  recovery(count: number, source: "metas" | "idb") {
    console.info("[Storage] Recovery", { count, source });
  },
  error(op: string, error: unknown) {
    console.error("[Storage] Error", { op, error });
  },
  perf(op: string, durationMs: number) {
    if (DEBUG && durationMs > 100) {
      console.warn("[Storage] Slow Op", { op, durationMs });
    }
  },
};
