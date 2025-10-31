import * as Y from "yjs";

const DB_NAME = "openai-writer-yjs";
const STORE_NAME = "documents";
const DB_VERSION = 1;

const isBrowser =
  typeof window !== "undefined" && typeof window.indexedDB !== "undefined";

function openDatabase(): Promise<IDBDatabase> {
  if (!isBrowser) {
    return Promise.reject(new Error("IndexedDB is not available in this environment."));
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Failed to open IndexedDB database."));
  });
}

function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

function idbTransactionComplete(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(tx.error ?? new Error("IndexedDB transaction failed."));
    tx.onabort = () =>
      reject(tx.error ?? new Error("IndexedDB transaction aborted."));
  });
}

async function readDocument(db: IDBDatabase, key: string) {
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  const value = await idbRequest(store.get(key));
  if (!value) {
    return null;
  }
  if (value instanceof Uint8Array) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (Array.isArray(value)) {
    return Uint8Array.from(value);
  }
  return null;
}

async function writeDocument(db: IDBDatabase, key: string, update: Uint8Array) {
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  store.put(update, key);
  await idbTransactionComplete(tx);
}

/**
 * Minimal IndexedDB persistence inspired by `y-indexeddb`.
 *
 * Stores the full encoded Yjs state on every update. While less efficient than
 * the canonical implementation, it keeps the integration small and dependency
 * free for the current migration step.
 */
export class IndexeddbPersistence {
  private readonly doc: Y.Doc;
  private readonly key: string;
  private readonly dbPromise: Promise<IDBDatabase> | null;
  private readonly updateHandler: (update: Uint8Array) => void;
  private readonly syncPromise: Promise<void>;
  private destroyed = false;
  private guard = false;
  private dbInstance: IDBDatabase | null = null;

  constructor(key: string, doc: Y.Doc) {
    this.doc = doc;
    this.key = key;
    this.dbPromise = isBrowser ? openDatabase() : null;

    this.updateHandler = () => {
      if (this.destroyed || this.guard) return;
      void this.persist();
    };

    doc.on("update", this.updateHandler);

    this.syncPromise = (async () => {
      await this.initialize();
    })();
  }

  private async initialize() {
    if (!this.dbPromise) return;
    try {
      this.dbInstance = await this.dbPromise;
      const stored = await readDocument(this.dbInstance, this.key);
      if (stored) {
        this.guard = true;
        try {
          Y.applyUpdate(this.doc, stored);
        } finally {
          this.guard = false;
        }
      }
    } catch (error) {
      console.warn("[IndexeddbPersistence] initialization failed", error);
    }
  }

  private async persist() {
    if (!this.dbPromise) return;
    try {
      const db = this.dbInstance ?? (await this.dbPromise);
      this.dbInstance = db;
      const update = Y.encodeStateAsUpdate(this.doc);
      await writeDocument(db, this.key, update);
    } catch (error) {
      console.warn("[IndexeddbPersistence] persist failed", error);
    }
  }

  whenSynced(): Promise<void> {
    return this.syncPromise.catch(() => {
      /* swallow sync errors; already logged */
    });
  }

  destroy() {
    this.destroyed = true;
    this.doc.off("update", this.updateHandler);
    if (this.dbInstance) {
      this.dbInstance.close();
      this.dbInstance = null;
    }
  }
}
