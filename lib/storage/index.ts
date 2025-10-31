export { persistDocChange } from "./adapter/persistence";
export { flushPendingWritesNow } from "./adapter/persistence";
export { getIDBRecoveryMetas, loadAllFromIDB, makeDefaultDoc } from "./adapter/recovery";
export { normalizeDoc } from "./adapter/normalize";
export { loadMetas, saveMetas, saveMetasImmediate } from "./local/meta-cache";
export {
  idbGetDoc,
  removeDocsFromIDB,
  checkIndexedDBHealth,
  purgeDeletedOlderThan,
  markIndexedDBSyncedNow,
  writeToIndexedDB,
} from "./local/idb";
export { onExternalChange } from "./external-change";
export { getStorageHealth } from "./health";
export type { DocumentRecord, DocumentMeta } from "@/types/storage";
