"use client";

import * as React from "react";

import { DisasterRecoveryDialog } from "@/components/storage/disaster-recovery-dialog";
import * as Storage from "@/lib/storage";
import type { MyValue } from "@/types/plate-elements";
import type { DocumentMeta, DocumentRecord } from "@/types/storage";
import { useDocsState, type DocMetaEntry } from "@/state/docs";

type DocumentsContextValue = {
  documents: DocumentMeta[];
  trashedDocuments: Array<DocumentMeta & { deletedAt: number }>;
  activeDocumentId: string | null;
  activeMeta: DocumentMeta | null;
  isHydrated: boolean;
  createDocument: () => void;
  selectDocument: (id: string) => void;
  deleteDocument: (id: string) => void;
  restoreDocument: (id: string) => void;
  purgeDocument: (id: string) => Promise<void>;
  getLegacyContentSnapshot: (id: string) => Promise<MyValue | null>;
};

const DocumentsContext = React.createContext<DocumentsContextValue | null>(
  null,
);

const toMeta = (doc: DocumentRecord): DocumentMeta => ({
  id: doc.id,
  title: doc.title,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
  version: doc.version,
  contentVersion: doc.contentVersion,
  deletedAt: doc.deletedAt ?? null,
});

const serializeMetas = (entries: Iterable<DocMetaEntry>): DocumentMeta[] =>
  Array.from(entries, (entry) => {
    const { migratedAt, ...meta } = entry;
    void migratedAt;
    return meta;
  });

const dropMigrated = (entry: DocMetaEntry): DocumentMeta => {
  const { migratedAt, ...meta } = entry;
  void migratedAt;
  return meta;
};

const pickActiveId = (entries: Iterable<DocMetaEntry | DocumentMeta>) => {
  const list = Array.from(entries);
  const live = list.filter((item) => (item.deletedAt ?? null) === null);
  return live[0]?.id ?? list[0]?.id ?? null;
};

export function DocumentsProvider({ children }: { children: React.ReactNode }) {
  const hydrateMetas = useDocsState((state) => state.hydrateMetas);
  const setActiveId = useDocsState((state) => state.setActiveId);
  const setMeta = useDocsState((state) => state.setMeta);
  const removeMeta = useDocsState((state) => state.removeMeta);

  const activeDocumentId = useDocsState((state) => state.activeId);
  const metaMap = useDocsState((state) => state.meta);

  const [isHydrated, setHydrated] = React.useState(false);
  const [recoveryOpen, setRecoveryOpen] = React.useState(false);
  const [recoveryList, setRecoveryList] = React.useState<
    Array<Pick<DocumentRecord, "id" | "title" | "updatedAt" | "version">>
  >([]);

  const persistMetas = React.useCallback(() => {
    const serialized = serializeMetas(useDocsState.getState().meta.values());
    Storage.saveMetas(serialized);
  }, []);

  const recomputeActiveId = React.useCallback(() => {
    const store = useDocsState.getState();
    const currentId = store.activeId;
    if (currentId) {
      const entry = store.meta.get(currentId);
      if (entry && (entry.deletedAt ?? null) === null) {
        return;
      }
    }
    const nextId = pickActiveId(store.meta.values());
    store.setActiveId(nextId);
  }, []);

  const primeDefaultDocument = React.useCallback(async () => {
    const defaultDoc = Storage.makeDefaultDoc();
    const meta = toMeta(defaultDoc);
    hydrateMetas([meta]);
    setActiveId(defaultDoc.id);
    Storage.saveMetas([meta]);
    Storage.persistDocChange(meta, defaultDoc.content);
    setHydrated(true);
  }, [hydrateMetas, setActiveId]);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const metas = Storage.loadMetas();
        if (metas.length > 0) {
          hydrateMetas(metas);
          setActiveId(pickActiveId(metas));
          if (!cancelled) {
            setHydrated(true);
          }
          return;
        }

        const recoverMetas = await Storage.getIDBRecoveryMetas();
        if (!cancelled && recoverMetas.length > 0) {
          setRecoveryList(recoverMetas);
          setRecoveryOpen(true);
          return;
        }

        if (!cancelled) {
          await primeDefaultDocument();
        }
      } catch (error) {
        console.warn("[DocumentsProvider] hydrate failed", error);
        if (!cancelled) {
          await primeDefaultDocument();
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrateMetas, primeDefaultDocument, setActiveId]);

  React.useEffect(() => {
    const flush = () => {
      const serialized = serializeMetas(useDocsState.getState().meta.values());
      Storage.saveMetasImmediate(serialized);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flush();
      }
    };

    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const createDocument = React.useCallback(() => {
    const doc = Storage.makeDefaultDoc();
    const meta = toMeta(doc);
    setMeta(doc.id, meta);
    setActiveId(doc.id);
    Storage.persistDocChange(meta, doc.content);
    persistMetas();
  }, [persistMetas, setActiveId, setMeta]);

  const selectDocument = React.useCallback(
    (id: string) => {
      setActiveId(id);
    },
    [setActiveId],
  );

  const deleteDocument = React.useCallback(
    (id: string) => {
      const now = Date.now();
      setMeta(id, { deletedAt: now, updatedAt: now });
      recomputeActiveId();
      persistMetas();
    },
    [persistMetas, recomputeActiveId, setMeta],
  );

  const restoreDocument = React.useCallback(
    (id: string) => {
      const now = Date.now();
      setMeta(id, { deletedAt: null, updatedAt: now });
      persistMetas();
    },
    [persistMetas, setMeta],
  );

  const purgeDocument = React.useCallback(
    async (id: string) => {
      removeMeta(id);
      recomputeActiveId();
      persistMetas();
      try {
        await Storage.removeDocsFromIDB([id]);
      } catch (error) {
        console.warn("[DocumentsProvider] purgeDocument failed", error);
      }
    },
    [persistMetas, recomputeActiveId, removeMeta],
  );

  const getLegacyContentSnapshot = React.useCallback(
    async (id: string) => {
      try {
        const record = await Storage.idbGetDoc(id);
        return record?.content ?? null;
      } catch (error) {
        console.warn(
          "[DocumentsProvider] getLegacyContentSnapshot failed",
          error,
        );
        return null;
      }
    },
    [],
  );

  const handleRecoverFromIDB = React.useCallback(async () => {
    try {
      const docs = await Storage.loadAllFromIDB();
      if (docs.length > 0) {
        const metas = docs.map(toMeta);
        hydrateMetas(metas);
        setActiveId(pickActiveId(metas));
        Storage.saveMetas(metas);
      } else {
        await primeDefaultDocument();
      }
    } finally {
      setRecoveryOpen(false);
      setRecoveryList([]);
      setHydrated(true);
    }
  }, [hydrateMetas, primeDefaultDocument, setActiveId]);

  const handleDismissRecovery = React.useCallback(async () => {
    setRecoveryOpen(false);
    setRecoveryList([]);
    await primeDefaultDocument();
  }, [primeDefaultDocument]);

  const documents = React.useMemo(() => {
    return Array.from(metaMap.values())
      .filter((meta) => (meta.deletedAt ?? null) === null)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map(dropMigrated);
  }, [metaMap]);

  const trashedDocuments = React.useMemo(() => {
    return Array.from(metaMap.values())
      .filter((meta) => typeof meta.deletedAt === "number")
      .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0))
      .map((entry) => ({
        ...dropMigrated(entry),
        deletedAt: entry.deletedAt ?? Date.now(),
      }));
  }, [metaMap]);

  const activeMeta = React.useMemo(() => {
    if (!activeDocumentId) return null;
    const entry = metaMap.get(activeDocumentId);
    if (!entry || (entry.deletedAt ?? null) !== null) return null;
    return dropMigrated(entry);
  }, [activeDocumentId, metaMap]);

  const contextValue = React.useMemo<DocumentsContextValue>(
    () => ({
      documents,
      trashedDocuments,
      activeDocumentId,
      activeMeta,
      isHydrated,
      createDocument,
      selectDocument,
      deleteDocument,
      restoreDocument,
      purgeDocument,
      getLegacyContentSnapshot,
    }),
    [
      activeDocumentId,
      activeMeta,
      createDocument,
      deleteDocument,
      documents,
      getLegacyContentSnapshot,
      isHydrated,
      purgeDocument,
      restoreDocument,
      selectDocument,
      trashedDocuments,
    ],
  );

  return (
    <DocumentsContext.Provider value={contextValue}>
      {children}
      <DisasterRecoveryDialog
        open={recoveryOpen}
        onClose={handleDismissRecovery}
        docs={recoveryList}
        onRecover={handleRecoverFromIDB}
      />
    </DocumentsContext.Provider>
  );
}

export function useDocuments(): DocumentsContextValue {
  const context = React.useContext(DocumentsContext);
  if (!context) {
    throw new Error("useDocuments must be used within DocumentsProvider");
  }
  return context;
}
