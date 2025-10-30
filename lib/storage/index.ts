export { persistDocChange } from "./adapter/persistence";
export { getIDBRecoveryMetas, loadAllFromIDB, makeDefaultDoc } from "./adapter/recovery";
export { loadMetas, saveMetas } from "./local/meta-cache";
export {
  idbGetDoc,
  removeDocsFromIDB,
  checkIndexedDBHealth,
  purgeDeletedOlderThan,
  markIndexedDBSyncedNow,
  writeToIndexedDB,
} from "./local/idb";
export { onConflicts, type SyncConflict } from "./conflicts";
export { getStorageHealth } from "./health";
export type { DocumentRecord, DocumentMeta } from "@/types/storage";
