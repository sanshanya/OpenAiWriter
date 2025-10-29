// hooks/use-documents.tsx
"use client";

import * as React from "react";
import { type Value } from "platejs";
import { DisasterRecoveryDialog } from "@/components/storage/disaster-recovery-dialog";
import { onConflicts, type Conflict as SyncConflict } from "@/lib/remote-sync";
import { ConflictDialog } from "@/components/storage/conflict-dialog";

// ✅ LS 只存 meta / 按需读内容
import { idbGetDoc } from "@/lib/idb";
import { loadMetas } from "@/lib/meta-cache";

// ✅ 持久化与恢复（IDB 主存；远端解耦）
import {
  persistDocChange,
  saveMetas, // 轻量 debounce 写入 localStorage（只写 metas）
  getIDBRecoveryMetas,
  removeDocsFromIDB, // PURGE 时物理删除 IDB
  loadAllFromIDB,
  makeDefaultDoc,
} from "@/lib/storage-adapter";

import {
  documentsReducer,
  type ModelState,
  type Action,
} from "@/hooks/documents-model";

/** 在本文件统一定义文档形状，避免对旧 use-persistence 的耦合 */
export type DocumentRecord = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  version: number;
  deletedAt?: number | null;
  content: Value;
};
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

const DocumentsContext = React.createContext<DocumentsContextValue | null>(
  null
);

export function DocumentsProvider({ children }: { children: React.ReactNode }) {
  // =========================
  // State via reducer（纯状态演算）
  // =========================
  const [state, dispatch] = React.useReducer(documentsReducer, {
    docs: [],
    activeId: null,
  } as ModelState);

  // ✅ 记录哪些文档“正文已加载到内存”（已水合）
  //   - 懒加载时，只有在这里登记过的文档才会持久化
  const loadedContentRef = React.useRef<Set<string>>(new Set());

  // 灾难恢复弹窗
  const [recoveryOpen, setRecoveryOpen] = React.useState(false);
  const [recoveryList, setRecoveryList] = React.useState<
    Array<Pick<DocumentRecord, "id" | "title" | "updatedAt" | "version">>
  >([]);

  // =========================
  // Helpers：按需水合一个文档（不会自增 version）
  // =========================
  const hydrateDocContent = React.useCallback(
    async (id: string) => {
      if (loadedContentRef.current.has(id)) return;

      try {
        const snap = await idbGetDoc(id);
        if (snap) {
          loadedContentRef.current.add(id);
          // 不增版本的水合：用 APPLY_SERVER_STATE 覆盖
          dispatch({
            type: "APPLY_SERVER_STATE",
            id: snap.id,
            server: {
              title: snap.title,
              content: snap.content,
              version: snap.version,
              updatedAt: snap.updatedAt,
              deletedAt: (snap as any).deletedAt ?? undefined,
            },
          } as Action);
        } else {
          // IDB 无该文档（极少数旧态/首次写入前）：也标记为已加载，避免占位误写回
          loadedContentRef.current.add(id);
        }
      } catch (e) {
        console.warn("[hydrateDocContent] fail", e);
        // 出错也标记为已加载，避免后续把占位误写回
        loadedContentRef.current.add(id);
      }
    },
    [dispatch]
  );

  // =========================
  // Initialization（事务型 INIT：先水合默认选中文档，再一次性 INIT+activeId）
  // =========================
  React.useEffect(() => {
    (async () => {
      // 1) 启动时只加载 metas，保证快速启动
      const metas = loadMetas();

      if (metas.length > 0) {
        // 选出默认要“选中”的那一篇（优先未删除且最近更新）
        const firstLiveMeta =
          metas
            .filter((m) => !m.deletedAt)
            .sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? metas[0];

        // 先水合这篇（在内存准备真实内容）
        const snap = await idbGetDoc(firstLiveMeta.id); // 可能为 null（旧态或首次）
        const hydratedFirst: DocumentRecord = {
          id: firstLiveMeta.id,
          title: (snap?.title ?? firstLiveMeta.title) || "(未命名)",
          createdAt: (firstLiveMeta as any).createdAt ?? firstLiveMeta.updatedAt,
          updatedAt: snap?.updatedAt ?? firstLiveMeta.updatedAt,
          version: snap?.version ?? firstLiveMeta.version,
          deletedAt:
            (snap as any)?.deletedAt ?? (firstLiveMeta as any).deletedAt,
          content: (snap?.content as Value) ?? ([] as any),
        };

        // 其它文档先占位（content: []），等用户点开时再懒加载
        const initialDocs: DocumentRecord[] = metas.map((m) =>
          m.id === hydratedFirst.id
            ? hydratedFirst
            : ({
                ...m,
                createdAt: (m as any).createdAt ?? m.updatedAt,
                content: [], // 占位
              } as DocumentRecord)
        );

        // 标记默认选中文档为已加载（避免被占位覆盖回 IDB）
        loadedContentRef.current.add(hydratedFirst.id);

        // ✅ 关键：一次性提交 INIT（包含 docs 和 activeId）
        dispatch({
          type: "INIT",
          docs: initialDocs,
          activeId: hydratedFirst.id,
        } as Action);

        return;
      }

      // 2) LS 为空：探测 IDB 是否有可恢复文档（只列未删除，用对话框询问）
      const recoverMetas = await getIDBRecoveryMetas(); // 仅未删除文档
      if (recoverMetas.length > 0) {
        setRecoveryList(recoverMetas);
        setRecoveryOpen(true);
        return;
      }

      // 3) 完全冷启动：新建默认文档（它是完整文档，直接视为已加载）
      const first = makeDefaultDoc();
      loadedContentRef.current.add(first.id);
      dispatch({
        type: "INIT",
        docs: [first],
        activeId: first.id,
      } as Action);
    })().catch((e) => console.warn("[Init] fail", e));
  }, [dispatch]);

  // 灾难恢复执行：从 IDB 拉全部（含已删除，供回收站），空则兜底新建
  const handleRecoverFromIDB = React.useCallback(async () => {
    try {
      const all = await loadAllFromIDB();
      const docs = all.length > 0 ? all : [makeDefaultDoc()];
      // 整批都是完整快照 → 视为已加载
      loadedContentRef.current = new Set(docs.map((d) => d.id));
      // 恢复后给一个默认选择（最新未删除）
      const firstLive =
        docs
          .filter((d) => !d.deletedAt)
          .sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? docs[0];
      dispatch({ type: "INIT", docs, activeId: firstLive.id } as Action);
    } finally {
      setRecoveryOpen(false);
    }
  }, [dispatch]);

  // =========================
  // 远端冲突订阅（保持原能力；是否触发远端由后台循环控制）
  // =========================
  const [conflictsOpen, setConflictsOpen] = React.useState(false);
  const [conflictItems, setConflictItems] = React.useState<{
    byId: Record<string, SyncConflict>;
    list: Array<{
      id: string;
      title?: string;
      clientVersion: number;
      serverVersion: number;
      serverUpdatedAt: number;
      serverDeletedAt?: number | null;
      serverPreview?: string;
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
            const text = (
              node?.children?.map((x: any) => x.text).join("") ?? ""
            ).trim();
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
  // ✅ 轻量、解耦的持久化出口
  // - 保存 metas（LS，轻量 debounce）
  // - 对比版本号变化，把变更文档异步写入 IDB（仅“已水合”的文档）
  // - 首轮且存在未水合文档时，**整体跳过**，避免占位覆盖 IDB
  // - PURGE：对比差集，物理删除 IDB
  // =========================
  const prevDocsRef = React.useRef<DocumentRecord[]>([]);
  React.useEffect(() => {
    const prev = prevDocsRef.current;
    const next = state.docs;

    // 1) 保存 metas（轻量、排序稳定）
    const metas: DocumentMeta[] = next
      .map(({ content: _c, ...meta }) => meta)
      .sort((a, b) => b.updatedAt - a.updatedAt);
    saveMetas(metas);

    // 1.5) 物理删除：prev 有而 next 没有的 ID
    if (prev.length > 0) {
      const prevIds = new Set(prev.map((d) => d.id));
      const nextIds = new Set(next.map((d) => d.id));
      const removedIds: string[] = [];
      prevIds.forEach((id) => {
        if (!nextIds.has(id)) removedIds.push(id);
      });
      if (removedIds.length > 0) {
        // best-effort，别 await，避免阻塞渲染
        removeDocsFromIDB(removedIds);
      }
    }

    // 2) 首轮且存在未水合文档 → 跳过持久化，防止占位覆盖 IDB
    const isFirstRun = prev.length === 0;
    const hasUnhydrated = next.some(
      (d) => !loadedContentRef.current.has(d.id)
    );
    if (isFirstRun && hasUnhydrated) {
      prevDocsRef.current = next;
      return;
    }

    // 3) 找出变化并持久化（仅“已水合”的文档）
    const prevMap = new Map(prev.map((d) => [d.id, d]));
    for (const doc of next) {
      if (!loadedContentRef.current.has(doc.id)) continue; // 未加载正文 → 不写
      const old = prevMap.get(doc.id);
      const changed =
        !old ||
        old.version !== doc.version ||
        old.deletedAt !== doc.deletedAt ||
        old.title !== doc.title;
      if (changed) {
        const { content, ...meta } = doc;
        persistDocChange(meta, content);
      }
    }

    prevDocsRef.current = next;
  }, [state.docs]);

  // =========================
  // Operations（UI 只 dispatch）
  // =========================
  const createDocument = React.useCallback(() => {
    const now = Date.now();
    dispatch({ type: "CREATE", now } as Action);
    // 新建文档由 reducer 生成完整内容，视为已加载；
    // 下一轮 effect 会把它持久化
  }, [dispatch]);

  const selectDocument = React.useCallback(
    async (id: string) => {
      // 关键：为避免“点开空白”，先水合，再 SELECT
      await hydrateDocContent(id);
      dispatch({ type: "SELECT", id } as Action);
    },
    [hydrateDocContent, dispatch]
  );

  // 关键：携带 docId，晚到的 onChange 也只会落在“自己的文档”上
  const updateDocumentContent = React.useCallback(
    (docId: string, value: Value) => {
      dispatch({
        type: "UPDATE_CONTENT",
        id: docId,
        value,
        now: Date.now(),
      } as Action);
      // 若该 doc 尚未标记为已加载（理论上选中后会标记），兜底：
      if (!loadedContentRef.current.has(docId)) {
        loadedContentRef.current.add(docId);
      }
    },
    [dispatch]
  );

  const deleteDocument = React.useCallback(
    (id: string) => {
      dispatch({ type: "DELETE_SOFT", id, now: Date.now() } as Action);
    },
    [dispatch]
  );

  const restoreDocument = React.useCallback(
    (id: string) => {
      dispatch({ type: "RESTORE", id, now: Date.now() } as Action);
    },
    [dispatch]
  );

  const purgeDocument = React.useCallback(
    (id: string) => {
      dispatch({ type: "PURGE", id } as Action);
    },
    [dispatch]
  );

  const handleUseServer = React.useCallback(
    (id: string) => {
      const c = conflictItems.byId[id];
      if (!c) return;
      let content: any = [];
      try {
        content = JSON.parse(c.serverContent);
      } catch {
        content = [];
      }
      loadedContentRef.current.add(id); // 服务器状态落地后，视为已加载
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
    },
    [conflictItems.byId, dispatch]
  );

  const handleUseLocal = React.useCallback(
    (id: string, serverVersion: number) => {
      // 把本地版本抬到 serverVersion+1，触发下一轮同步覆盖服务器
      loadedContentRef.current.add(id); // 后续可持久化
      dispatch({
        type: "BUMP_VERSION",
        id,
        toVersion: serverVersion + 1,
        now: Date.now(),
      } as Action);
      setConflictItems((prev) => {
        const next = prev.list.filter((x) => x.id !== id);
        if (next.length === 0) setConflictsOpen(false);
        return { ...prev, list: next };
      });
    },
    [dispatch]
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
