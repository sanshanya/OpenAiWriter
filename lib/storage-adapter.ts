// lib/storage-adapter.ts
"use client";

import { NodeApi, type Value } from "platejs";
import {
  INITIAL_DOCUMENT_CONTENT,
  INITIAL_DOCUMENT_TITLE,
} from "@/components/editor/initial-value";

// ✅ LS 仅存 metas（列表/目录）
import { saveMetasDebounced } from "@/lib/meta-cache";

// ✅ IDB 主存
import {
  idbPutDoc,
  recoverAllFromIndexedDB,
  checkIndexedDBHealth,
  purgeDeletedOlderThan,
  deleteFromIndexedDB,
} from "@/lib/idb";

export type StoredDocument = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  version: number;
  deletedAt?: number | null;
  content: Value;
};
export type DocMeta = Omit<StoredDocument, "content">;

const DELETION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 天

// ========== 合并写队列（仅 IDB） ==========
// ⚠️ 关键修正：任务携带 meta（含 deletedAt / title 等）+ content，一次性 UPSERT。
type PersistTask = {
  meta: DocMeta;
  content: Value;
};

const pending = new Map<string, PersistTask>();
let idleScheduled = false;

function scheduleFlushOnIdle() {
  if (idleScheduled) return;
  idleScheduled = true;

  const runner = () => {
    idleScheduled = false;
    const tasks = Array.from(pending.values());
    pending.clear();

    (async () => {
      const t0 = performance.now();
      for (const { meta, content } of tasks) {
        // 直接传递需要持久化的字段：防丢失 deletedAt / title
        await idbPutDoc({
          id: meta.id,
          title: meta.title,
          version: meta.version,
          updatedAt: meta.updatedAt,
          createdAt: meta.createdAt,
          // 允许 undefined / number（null 会在 normalize 时被收敛）
          deletedAt: (meta as any).deletedAt,
          content,
        });
      }
      const cost = Math.round(performance.now() - t0);
      // 可观测：console.debug("[storage] flush", tasks.length, "cost", cost, "ms");
    })().catch(() => {});
  };

  if (typeof (window as any).requestIdleCallback === "function") {
    (window as any).requestIdleCallback(runner, { timeout: 500 });
  } else {
    setTimeout(runner, 0);
  }
}

/** 暴露给上层：文档变更（版本已递增），异步入队写 IDB */
export function persistDocChange(meta: DocMeta, content: Value) {
  pending.set(meta.id, { meta, content });
  scheduleFlushOnIdle();
}

/** 仅保存 metas（轻量、debounce），不含 content */
export function saveMetas(metas: DocMeta[]) {
  const stable = [...metas].sort((a, b) => b.updatedAt - a.updatedAt);
  saveMetasDebounced(stable, 120);
}

/** 批量物理删除（best-effort） */
export async function removeDocsFromIDB(ids: string[]): Promise<void> {
  if (!ids || ids.length === 0) return;
  await Promise.all(ids.map((id) => deleteFromIndexedDB(id).catch(() => {})));
}

/** 列出可恢复清单（只含“未删除”文档） */
export async function getIDBRecoveryMetas(): Promise<
  Array<Pick<StoredDocument, "id" | "title" | "updatedAt" | "version">>
> {
  const health = await checkIndexedDBHealth();
  if (!health.available) return [];

  // 直接取全量（含 content），仅用于恢复弹窗（低频操作）
  const raw = await recoverAllFromIndexedDB();

  // 统一“未删除”判断：只有 number 才视为已删
  const live = raw.filter((d: any) => !(typeof d.deletedAt === "number"));

  // 标题解析：存储的 > 内容首段 > “(未命名)”
  const safeTitle = (doc: any): string => {
    const t = typeof doc.title === "string" ? doc.title.trim() : "";
    if (t) return t;

    try {
      const val = Array.isArray(doc.content) ? (doc.content as Value) : [];
      for (const node of val as any) {
        const s = NodeApi.string(node).trim();
        if (s) {
          const isDefault =
            typeof INITIAL_DOCUMENT_TITLE === "string" &&
            s.trim() === INITIAL_DOCUMENT_TITLE.trim();
          return isDefault ? "(未命名)" : s.length <= 60 ? s : `${s.slice(0, 60)}…`;
        }
      }
    } catch {}
    return "(未命名)";
  };

  return live
    .filter((d: StoredDocument) => typeof d.id === "string" && d.id.length > 0)
    .map((d: StoredDocument) => ({
      id: d.id,
      title: safeTitle(d),
      updatedAt: typeof d.updatedAt === "number" ? d.updatedAt : Date.now(),
      version: typeof d.version === "number" ? d.version : 1,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** 从 IDB 拉全量，含已删除，并做消毒 */
export async function loadAllFromIDB(): Promise<StoredDocument[]> {
  const health = await checkIndexedDBHealth();
  if (!health.available || health.documentCount === 0) return [];

  // 清理超期墓碑（best-effort）
  const cutoff = Date.now() - DELETION_RETENTION_MS;
  purgeDeletedOlderThan(cutoff).catch(() => {});

  const raw = await recoverAllFromIndexedDB();
  return raw
    .filter((d: StoredDocument) => typeof d.id === "string" && d.id.length > 0)
    .map((d) => normalizeDoc(d));
}

/** 冷启动兜底：默认文档 */
export function makeDefaultDoc(): StoredDocument {
  const now = Date.now();
  const content = cloneValue(INITIAL_DOCUMENT_CONTENT);
  return {
    id: crypto.randomUUID(),
    title: deriveTitle(content as any, INITIAL_DOCUMENT_TITLE),
    content,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

// ========== 工具 ==========
function cloneValue<T>(v: T): T {
  if (typeof structuredClone === "function") return structuredClone(v);
  return JSON.parse(JSON.stringify(v)) as T;
}

function deriveTitle(value: Value, fallback: string): string {
  for (const node of value as any) {
    const t = NodeApi.string(node).trim();
    if (t) return t.length <= 60 ? t : `${t.slice(0, 60)}…`;
  }
  const s = typeof fallback === "string" ? fallback.trim() : "";
  return s.length <= 60 ? s : `${s.slice(0, 60)}…`;
}

function normalizeDoc(doc: StoredDocument): StoredDocument {
  const now = Date.now();
  const content = Array.isArray(doc.content)
    ? (doc.content as Value)
    : cloneValue(INITIAL_DOCUMENT_CONTENT);
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
    // ✅ 只有 number 才视为“已删除”；null/其它值一律视为未删除
    deletedAt:
      typeof (doc as any).deletedAt === "number"
        ? (doc as any).deletedAt
        : undefined,
  };
}
