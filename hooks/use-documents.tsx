"use client";

// IDB 工具
import {
  writeToIndexedDB,
  checkIndexedDBHealth,
  recoverAllFromIndexedDB,
  markIndexedDBSyncedNow,
} from "@/lib/idb";

// 灾难恢复对话框
import { DisasterRecoveryDialog } from "@/components/storage/disaster-recovery-dialog";

import * as React from "react";
import { type Value } from "platejs";
import { getCachedDocuments, saveAllDocuments, type StoredDocument } from "@/hooks/use-persistence";
import { INITIAL_DOCUMENT_CONTENT, INITIAL_DOCUMENT_TITLE } from "@/components/editor/initial-value";

// reducer & actions
import { documentsReducer, type ModelState, type Action } from "@/hooks/documents-model";

type DocumentRecord = StoredDocument;
type DocumentMeta = Omit<DocumentRecord, "content">;

type DocumentsContextValue = {
  documents: DocumentMeta[];
  activeDocument: DocumentRecord | null;
  activeDocumentId: string | null;
  createDocument: () => void;
  selectDocument: (id: string) => void;
  updateDocumentContent: (value: Value) => void;
  deleteDocument: (id: string) => void;
};

const DocumentsContext = React.createContext<DocumentsContextValue | null>(null);

const DELETION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 天

export function DocumentsProvider({ children }: { children: React.ReactNode }) {
  // =========================
  // State via reducer
  // =========================
  const [state, dispatch] = React.useReducer(documentsReducer, {
    docs: [],
    activeId: null,
  } as ModelState);

  // 快照去重（仅对 active 文档做 JSON 快照，避免无谓 dispatch）
  const lastSavedSnapshot = React.useRef<Record<string, string>>({});

  // 恢复弹窗
  const [recoveryOpen, setRecoveryOpen] = React.useState(false);
  const [recoveryList, setRecoveryList] = React.useState<
    Array<Pick<DocumentRecord, "id" | "title" | "updatedAt" | "version">>
  >([]);

  // =========================
  // Initialization
  // =========================
  React.useEffect(() => {
    const local = getCachedDocuments(); // localStorage
    if (local.length > 0) {
      dispatch({ type: "INIT", docs: local } as Action);
      local.forEach((d) => (lastSavedSnapshot.current[d.id] = JSON.stringify(d.content)));
      return;
    }
    // local 为空 → 看 IDB
    (async () => {
      const health = await checkIndexedDBHealth();
      if (health.available && health.documentCount > 0) {
        const raw = await recoverAllFromIndexedDB();
        // 过滤墓碑 + 消毒元信息
        const metas: Array<Pick<StoredDocument, "id" | "title" | "updatedAt" | "version">> = raw
          .filter((d: StoredDocument) => !((d as any).deletedAt))
          .filter((d: StoredDocument) => typeof d.id === "string" && d.id.length > 0)
          .map((d: StoredDocument) => ({
            id: d.id,
            title: typeof d.title === "string" && d.title ? d.title : "(未命名)",
            updatedAt: typeof d.updatedAt === "number" ? d.updatedAt : Date.now(),
            version: typeof d.version === "number" ? d.version : 1,
          }))
          .sort((a, b) => b.updatedAt - a.updatedAt);

        if (metas.length > 0) {
          setRecoveryList(metas);
          setRecoveryOpen(true);
          return;
        }
      }
      // 没有恢复候选 → 初始化一篇默认文档
      const now = Date.now();
      const content = cloneValue(INITIAL_DOCUMENT_CONTENT);
      const first: StoredDocument = {
        id: crypto.randomUUID(),
        title: deriveTitle(content, INITIAL_DOCUMENT_TITLE),
        content,
        createdAt: now,
        updatedAt: now,
        version: 1,
      };
      dispatch({ type: "INIT", docs: [first] } as Action);
      saveAllDocuments([first]);
      lastSavedSnapshot.current[first.id] = JSON.stringify(first.content);
    })().catch((e) => console.warn("[RecoveryProbe] fail", e));
  }, []);

  // 灾难恢复执行：过滤墓碑 + 内容消毒 + 空集合兜底
  const handleRecoverFromIDB = React.useCallback(async () => {
    try {
      const raw = await recoverAllFromIndexedDB();
      const normalized: StoredDocument[] = raw
        .filter((d) => !((d as any).deletedAt))
        .filter((d) => typeof d.id === "string")
        .map((doc) => normalizeDoc(doc));

      const docs = normalized.length > 0 ? normalized : [makeDefaultDoc()];
      dispatch({ type: "INIT", docs } as Action);
      saveAllDocuments(docs);
      docs.forEach((d) => (lastSavedSnapshot.current[d.id] = JSON.stringify(d.content)));
    } finally {
      setRecoveryOpen(false);
    }
  }, []);

  // =========================
  // Derived
  // =========================
  const activeDocument = React.useMemo(
    () => state.docs.find((d) => d.id === state.activeId) || null,
    [state.docs, state.activeId]
  );

  const documents: DocumentMeta[] = React.useMemo(
    () =>
      state.docs
        .filter((d: DocumentRecord) => !(d as any).deletedAt)
        .map(({ content: _c, ...meta }) => meta)
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [state.docs]
  );

  // =========================
  // Single persistence outlet
  // =========================
  const prevSigRef = React.useRef<Map<string, string>>(new Map());

  React.useEffect(() => {
    // 1) localStorage：一次性
    saveAllDocuments(state.docs);

    // 2) IDB：仅写入 changed docs（按 updatedAt:version 签名）
    const prev = prevSigRef.current;
    const next = new Map<string, string>();
    const changed: StoredDocument[] = [];
    for (const d of state.docs) {
      const sig = `${d.updatedAt}:${d.version}:${(d as any).deletedAt ?? ""}`;
      next.set(d.id, sig);
      if (prev.get(d.id) !== sig) changed.push(d);
    }
    prevSigRef.current = next;

    if (changed.length > 0) {
      Promise.all(changed.map((d) => writeToIndexedDB(d).catch(() => {})))
        .then(() => markIndexedDBSyncedNow())
        .catch(() => {});
    }

    // 3) 可选：超期墓碑压缩（localStorage 层）
    const compacted = compactDeleted(state.docs);
    if (compacted.length !== state.docs.length) {
      saveAllDocuments(compacted);
    }
  }, [state.docs]);

  // =========================
  // Operations (UI only dispatch)
  // =========================
  const createDocument = React.useCallback(() => {
    dispatch({ type: "CREATE", now: Date.now() } as Action);
  }, []);

  const selectDocument = React.useCallback(
    (id: string) => {
      // 保留 setTimeout(0) 的安全兜底（等 UI 能传入“最后输入值”后，可移除）
      setTimeout(() => dispatch({ type: "SELECT", id } as Action), 0);
    },
    []
  );

  const updateDocumentContent = React.useCallback(
    (value: Value) => {
      const id = state.activeId;
      if (!id) return;
      const snapshot = JSON.stringify(value);
      if (lastSavedSnapshot.current[id] === snapshot) return; // 去重
      lastSavedSnapshot.current[id] = snapshot;
      dispatch({ type: "UPDATE_CONTENT", id, value, now: Date.now() } as Action);
    },
    [state.activeId]
  );

  const deleteDocument = React.useCallback(
    (id: string) => {
      dispatch({ type: "DELETE_SOFT", id, now: Date.now() } as Action);
    },
    []
  );

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
    }),
    [documents, activeDocument, state.activeId, createDocument, selectDocument, updateDocumentContent, deleteDocument]
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
    </DocumentsContext.Provider>
  );
}

export function useDocuments() {
  const ctx = React.useContext(DocumentsContext);
  if (!ctx) throw new Error("useDocuments must be used within a DocumentsProvider");
  return ctx;
}

// ============ helpers (局部) ============
function cloneValue<T>(v: T): T {
  if (typeof structuredClone === "function") return structuredClone(v);
  return JSON.parse(JSON.stringify(v)) as T;
}

function deriveTitle(value: Value, fallback: string): string {
  // 轻量复制：依赖 documents-model.ts 的实现也行，这里保留一份避免循环依赖
  // @ts-ignore - NodeApi 在编辑器侧存在
  const { NodeApi } = require("platejs");
  for (const node of value as any) {
    const t = NodeApi.string(node).trim();
    if (t) return t.length <= 60 ? t : `${t.slice(0, 60)}…`;
  }
  const s = fallback.trim();
  return s.length <= 60 ? s : `${s.slice(0, 60)}…`;
}

function normalizeDoc(doc: StoredDocument): StoredDocument {
  const now = Date.now();
  const content = Array.isArray(doc.content) ? doc.content : cloneValue(INITIAL_DOCUMENT_CONTENT);
  const title =
    typeof doc.title === "string" && doc.title.trim()
      ? doc.title
      : deriveTitle(content as any, INITIAL_DOCUMENT_TITLE);
  return {
    ...doc,
    content,
    title,
    version: typeof doc.version === "number" ? doc.version : 1,
    createdAt: typeof doc.createdAt === "number" ? doc.createdAt : now,
    updatedAt: typeof doc.updatedAt === "number" ? doc.updatedAt : now,
  };
}

function makeDefaultDoc(): StoredDocument {
  const now = Date.now();
  const content = cloneValue(INITIAL_DOCUMENT_CONTENT);
  return {
    id: crypto.randomUUID(),
    title: deriveTitle(content, INITIAL_DOCUMENT_TITLE),
    content,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

function compactDeleted(docs: StoredDocument[]): StoredDocument[] {
  const now = Date.now();
  const kept = docs.filter((d: any) => !d.deletedAt || now - d.deletedAt < DELETION_RETENTION_MS);
  return kept.length === docs.length ? docs : kept;
}
