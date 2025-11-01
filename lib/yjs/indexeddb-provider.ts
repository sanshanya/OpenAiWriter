import { Awareness } from "y-protocols/awareness";
import type { UnifiedProvider } from "@platejs/yjs";
import * as Y from "yjs";

import { IndexeddbPersistence } from "@/lib/yjs/indexeddb-persistence";

export function createIndexeddbProvider(
  key: string,
  doc: Y.Doc,
  onSyncChange?: (isSynced: boolean) => void,
): UnifiedProvider {
  const awareness = new Awareness(doc);
  const persistence = new IndexeddbPersistence(key, doc);

  let isConnected = false;
  let isSynced = false;

  const notifySyncChange = (next: boolean) => {
    if (isSynced === next) return;
    isSynced = next;
    onSyncChange?.(isSynced);
  };

  const provider: UnifiedProvider = {
    type: "indexeddb",
    awareness,
    document: doc,
    get isConnected() {
      return isConnected;
    },
    get isSynced() {
      return isSynced;
    },
    connect() {
      if (isConnected) return;
      isConnected = true;
      notifySyncChange(false);
      void persistence
        .whenSynced()
        .then(() => notifySyncChange(true))
        .catch(() => notifySyncChange(false));
    },
    disconnect() {
      isConnected = false;
    },
    destroy() {
      isConnected = false;
      notifySyncChange(false);
      persistence.destroy();
    },
  };

  return provider;
}
