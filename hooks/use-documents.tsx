"use client";

import * as React from "react";
import { type Value } from "platejs";
import { DisasterRecoveryDialog } from "@/components/storage/disaster-recovery-dialog";
import { onConflicts, type Conflict as SyncConflict } from "@/lib/remote-sync";
import { ConflictDialog } from "@/components/storage/conflict-dialog";

import {
  getCachedDocuments,
  saveAllDocuments,
  type StoredDocument,
} from "@/hooks/use-persistence";

import {
  persistAll,
  getIDBRecoveryMetas,
  loadAllFromIDB,
  makeDefaultDoc,
} from "@/lib/storage-adapter";

import {
  documentsReducer,
  type ModelState,
  type Action,
} from "@/hooks/documents-model";

type DocumentRecord = StoredDocument;
type DocumentMeta = Omit<DocumentRecord, "content">;

type DocumentsContextValue = {
  documents: DocumentMeta[];
  activeDocument: DocumentRecord | null;
  activeDocumentId: string | null;
  createDocument: () => void;
  selectDocument: (id: string) => void;
  // 关键：onChange 必须带 docId，根除切换串台
  updateDocumentContent: (docId: string, value: Value) => void;
  deleteDocument: (id: string) => void;
  restoreDocument: (id: string) => void;
  purgeDocument: (id: string) => void;

  // 回收站（只含 meta，不带 content）
  trashedDocuments: Array<
    Omit<DocumentMeta, "updatedAt"> & { updatedAt: number; deletedAt: number }
  >;
};

const DocumentsContext = React.createContext<DocumentsContextValue | null>(null);

export function DocumentsProvider({ children }: { children: React.ReactNode }) {
  // =========================
  // State via reducer（纯状态演算）
  // =========================
  const [state, dispatch] = React.useReducer(documentsReducer, {
    docs: [],
    activeId: null,
  } as ModelState);

  // 各 doc 的内容快照，避免无谓 UPDATE（去重）
  const lastSavedSnapshot = React.useRef<Record<string, string>>({});

  // 用于 rAF 的引用，以合并同一帧内的多次 onChange 快照更新
  const rafIdRef = React.useRef<number | null>(null);

  // 灾难恢复弹窗
  const [recoveryOpen, setRecoveryOpen] = React.useState(false);
  const [recoveryList, setRecoveryList] = React.useState<
    Array<Pick<DocumentRecord, "id" | "title" | "updatedAt" | "version">>
  >([]);

  // =========================
  // Initialization（local → IDB）
  // =========================
  React.useEffect(() => {
    // 1) localStorage（同步）
    const local = getCachedDocuments();
    if (local.length > 0) {
      dispatch({ type: "INIT", docs: local } as Action);
      local.forEach(
        (d) => (lastSavedSnapshot.current[d.id] = JSON.stringify(d.content))
      );
      return;
    }

    // 2) local 为空 → 询问 IDB 恢复（只列未删除作为对话框条目）
    (async () => {
      const metas = await getIDBRecoveryMetas(); // 仅未删除文档
      if (metas.length > 0) {
        setRecoveryList(metas);
        setRecoveryOpen(true);
        return;
      }

      // 3) 若 IDB 只有已删除文档，也要恢复（用于回收站展示）
      const all = await loadAllFromIDB(); // 未删 + 已删，且经过消毒
      if (all.length > 0) {
        const hasLive = all.some((d: any) => !d.deletedAt);
        const docs = hasLive ? all : [makeDefaultDoc(), ...all];
        dispatch({ type: "INIT", docs } as Action);
        saveAllDocuments(docs);
        docs.forEach(
          (d: StoredDocument) => (lastSavedSnapshot.current[d.id] = JSON.stringify(d.content))
        );
        return;
      }

      // 4) 完全冷启动：新建默认文档
      const first = makeDefaultDoc();
      dispatch({ type: "INIT", docs: [first] } as Action);
      saveAllDocuments([first]);
      lastSavedSnapshot.current[first.id] = JSON.stringify(first.content);
    })().catch((e) => console.warn("[RecoveryProbe] fail", e));
  }, []);

  // 灾难恢复执行：从 IDB 拉全部（含已删除，供回收站），空则兜底新建
  const handleRecoverFromIDB = React.useCallback(async () => {
    try {
      const all = await loadAllFromIDB();
      const docs = all.length > 0 ? all : [makeDefaultDoc()];
      dispatch({ type: "INIT", docs } as Action);
      saveAllDocuments(docs);
      docs.forEach(
        (d: StoredDocument) => (lastSavedSnapshot.current[d.id] = JSON.stringify(d.content))
      );
    } finally {
      setRecoveryOpen(false);
    }
  }, []);

  const [conflictsOpen, setConflictsOpen] = React.useState(false);
  const [conflictItems, setConflictItems] = React.useState<{
    byId: Record<string, SyncConflict>;
    list: Array<{
      id: string; title?: string; clientVersion: number; serverVersion: number;
      serverUpdatedAt: number; serverDeletedAt?: number | null; serverPreview?: string;
    }>;
  }>({ byId: {}, list: [] });

  React.useEffect(() => {
    // 订阅远端冲突
    const off = onConflicts((arr) => {
      // 把服务器返回的冲突补上本地标题/预览
      const byId: Record<string, SyncConflict> = {};
      arr.forEach((c) => (byId[c.id] = c));

      const list = arr.map((c) => {
        const local = state.docs.find((d) => d.id === c.id);
        // 取服务器预览（JSON → 文本首段截断）
        let serverPreview = "";
        try {
          const parsed = JSON.parse(c.serverContent);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const node = parsed[0];
            const text = (node?.children?.map((x: any) => x.text).join("") ?? "").trim();
            serverPreview = text.slice(0, 80);
          }
        } catch {}
        return {
          id: c.id,
          title: local?.title ?? c.serverTitle ?? "(未命名)",
          clientVersion: c.clientVersion,
          serverVersion: c.serverVersion,
          serverUpdatedAt: c.serverUpdatedAt,
          serverDeletedAt: c.serverDeletedAt ?? null,
          serverPreview,
        };
      });

      setConflictItems({ byId, list });
      setConflictsOpen(true);
    });
    return off;
  }, [state.docs]);

  // =========================
  // Derived（派生状态）
  // =========================
  const activeDocument = React.useMemo(
    () => state.docs.find((d) => d.id === state.activeId) || null,
    [state.docs, state.activeId]
  );

  const documents: DocumentMeta[] = React.useMemo(
    () =>
      state.docs
        .filter((d: any) => !d.deletedAt)
        .map(({ content: _c, ...meta }) => meta)
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [state.docs]
  );

  const trashedDocuments = React.useMemo(
    () =>
      state.docs
        .filter((d: any) => typeof d.deletedAt === "number")
        .map(
          ({ content: _c, ...meta }) =>
            meta as any as {
              id: string;
              title: string;
              createdAt: number;
              updatedAt: number;
              version: number;
              deletedAt: number;
            }
        )
        .sort((a, b) => b.deletedAt - a.deletedAt),
    [state.docs]
  );

  // =========================
  // Single persistence outlet（storage-adapter 托管）
  // =========================
  const prevDocsRef = React.useRef<StoredDocument[]>([]);
  React.useEffect(() => {
    const prev = prevDocsRef.current;
    const next = state.docs;

    const isFirstPersist = prev.length === 0; // ← 首轮 hydrate
    persistAll(prev, next, { skipRemote: isFirstPersist }).catch(() => {});

    prevDocsRef.current = next;
  }, [state.docs]);

  // =========================
  // Operations（UI 只 dispatch）
  // =========================
  const createDocument = React.useCallback(() => {
    dispatch({ type: "CREATE", now: Date.now() } as Action);
  }, []);

  const selectDocument = React.useCallback((id: string) => {
    dispatch({ type: "SELECT", id } as Action);
  }, []);

  // 关键：携带 docId，晚到的 onChange 也只会落在“自己的文档”上
  const updateDocumentContent = React.useCallback((docId: string, value: Value) => {
    // 立即进入 reducer，确保 SSoT（Single Source of Truth）不被延迟
    dispatch({
      type: "UPDATE_CONTENT",
      id: docId,
      value,
      now: Date.now(),
    } as Action);

    // 去重快照的生成延后到 rAF，以合并同一帧内的多次 onChange
    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    rafIdRef.current = requestAnimationFrame(() => {
      const snapshot = JSON.stringify(value);
      // 只有当新快照与旧快照不同时才更新，避免不必要的持久化触发
      if (lastSavedSnapshot.current[docId] !== snapshot) {
        lastSavedSnapshot.current[docId] = snapshot;
      }
    });
  }, []);

  const deleteDocument = React.useCallback((id: string) => {
    dispatch({ type: "DELETE_SOFT", id, now: Date.now() } as Action);
  }, []);

  const restoreDocument = React.useCallback((id: string) => {
    dispatch({ type: "RESTORE", id, now: Date.now() } as Action);
  }, []);

  const purgeDocument = React.useCallback((id: string) => {
    dispatch({ type: "PURGE", id } as Action);
  }, []);

  const handleUseServer = React.useCallback((id: string) => {
    const c = conflictItems.byId[id];
    if (!c) return;
    let content: any = [];
    try { content = JSON.parse(c.serverContent); } catch { content = []; }
    dispatch({
      type: "APPLY_SERVER_STATE",
      id,
      server: {
        title: c.serverTitle,
        content,
        version: c.serverVersion,
        updatedAt: c.serverUpdatedAt,
        deletedAt: c.serverDeletedAt ?? undefined,
      },
    } as Action);
    // 关闭对话框（若全部处理完）
    setConflictItems((prev) => {
      const next = prev.list.filter((x) => x.id !== id);
      if (next.length === 0) setConflictsOpen(false);
      return { ...prev, list: next };
    });
  }, [conflictItems.byId, dispatch]);

  const handleUseLocal = React.useCallback((id: string, serverVersion: number) => {
    // 把本地版本抬到 serverVersion+1，触发下一轮同步覆盖服务器
    dispatch({ type: "BUMP_VERSION", id, toVersion: serverVersion + 1, now: Date.now() } as Action);
    setConflictItems((prev) => {
      const next = prev.list.filter((x) => x.id !== id);
      if (next.length === 0) setConflictsOpen(false);
      return { ...prev, list: next };
    });
  }, [dispatch]);

  // =========================
  // Context value
  // =========================
  const value = React.useMemo<DocumentsContextValue>(
    () => ({
      documents,
      activeDocument,
      activeDocumentId: state.activeId,
      createDocument,
      selectDocument,
      updateDocumentContent,
      deleteDocument,
      restoreDocument,
      purgeDocument,
      trashedDocuments,
    }),
    [
      documents,
      activeDocument,
      state.activeId,
      createDocument,
      selectDocument,
      updateDocumentContent,
      deleteDocument,
      restoreDocument,
      purgeDocument,
      trashedDocuments,
    ]
  );

  return (
    <DocumentsContext.Provider value={value}>
      {children}
      <DisasterRecoveryDialog
        open={recoveryOpen}
        onClose={() => setRecoveryOpen(false)}
        docs={recoveryList}
        onRecover={handleRecoverFromIDB}
      />
      <ConflictDialog
        open={conflictsOpen}
        items={conflictItems.list}
        onUseServer={handleUseServer}
        onUseLocal={handleUseLocal}
        onClose={() => setConflictsOpen(false)}
      />
    </DocumentsContext.Provider>
  );
}

export function useDocuments() {
  const ctx = React.useContext(DocumentsContext);
  if (!ctx)
    throw new Error("useDocuments must be used within a DocumentsProvider");
  return ctx;
}
