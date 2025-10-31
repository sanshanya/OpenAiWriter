// lib/storage/constants.ts
export const STORAGE_KEYS = {
  META: "aiwriter:metas:v4",
  IDB_NAME: "aiwriter-docs",
  IDB_STORE: "documents",
  IDB_VERSION: 3,
} as const;

export const STORAGE_CONFIG = {
  DELETION_RETENTION_DAYS: 30,
  META_SAVE_DEBOUNCE_MS: 120,
  IDB_FLUSH_IDLE_TIMEOUT_MS: 500,
  IDB_BULK_WRITE_THRESHOLD: 10,
} as const;
