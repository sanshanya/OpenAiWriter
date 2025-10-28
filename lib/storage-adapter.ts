// lib/storage-adapter.ts
"use client";

import { NodeApi, type Value } from "platejs";
import {
  saveAllDocuments,
  type StoredDocument,
} from "@/hooks/use-persistence";
import {
  INITIAL_DOCUMENT_CONTENT,
  INITIAL_DOCUMENT_TITLE,
} from "@/components/editor/initial-value";

// IDB 工具
import {
  writeToIndexedDB,
  deleteFromIndexedDB,
  markIndexedDBSyncedNow,
  purgeDeletedOlderThan,
  recoverAllFromIndexedDB,
  checkIndexedDBHealth,
} from "@/lib/idb";

// 远端同步（快照/事件 二选一）
import {
  enqueueChangedForSync,
  scheduleOutboxFlush,
  USE_OUTBOX,
} from "@/lib/remote-sync";

// 事件日志（Outbox）
import { appendOutboxForChanged } from "@/lib/outbox";

const DELETION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 天

// ========== 公共导出 ==========

// 1) 首轮跳过远端；changed→IDB + Outbox；按开关选择远端策略
export async function persistAll(
  prevDocs: StoredDocument[],
  nextDocs: StoredDocument[],
  opts?: { skipRemote?: boolean }
): Promise<void> {
  // 1) localStorage（整包）
  saveAllDocuments(nextDocs);

  // 2) IDB 增量写 + Outbox 事件
  const prevSig = new Map(prevDocs.map((d) => [d.id, sigOf(d)]));
  const changed = nextDocs.filter((d) => prevSig.get(d.id) !== sigOf(d));
  if (changed.length > 0) {
    await Promise.all(
      changed.map((d) => writeToIndexedDB(d).catch(() => {}))
    );
    markIndexedDBSyncedNow();

    // 事件即真相：把快照变化映射为事件（append-only）
    appendOutboxForChanged(changed, prevDocs);

    // 3) 远端同步：首轮 hydrate 跳过；否则按模式选择
    if (!opts?.skipRemote) {
      if (USE_OUTBOX) {
        scheduleOutboxFlush();
      } else {
        enqueueChangedForSync(changed);
      }
    }
  }

  // 4) IDB 同步删除（本地物理删除；远端 GC 交给后端）
  const nextIds = new Set(nextDocs.map((d) => d.id));
  const removed = prevDocs.filter((d) => !nextIds.has(d.id)).map((d) => d.id);
  if (removed.length > 0) {
    await Promise.all(
      removed.map((id) => deleteFromIndexedDB(id).catch(() => {}))
    );
  }

  // 5) 清理超期墓碑（best-effort）
  const cutoff = Date.now() - DELETION_RETENTION_MS;
  purgeDeletedOlderThan(cutoff).catch(() => {});
}

// 2) 供 use-documents 初始化：列“可恢复清单”（只含未删除）
export async function getIDBRecoveryMetas(): Promise<
  Array<Pick<StoredDocument, "id" | "title" | "updatedAt" | "version">>
> {
  const health = await checkIndexedDBHealth();
  if (!health.available || health.documentCount === 0) return [];

  const raw = await recoverAllFromIndexedDB();
  return raw
    .filter((d: any) => !d.deletedAt)
    .filter((d: StoredDocument) => typeof d.id === "string" && d.id.length > 0)
    .map((d: StoredDocument) => ({
      id: d.id,
      title:
        typeof d.title === "string" && d.title ? d.title : "(未命名)",
      updatedAt:
        typeof d.updatedAt === "number" ? d.updatedAt : Date.now(),
      version: typeof d.version === "number" ? d.version : 1,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

// 3) 供 use-documents 恢复：把 IDB 全部拉起（含已删除），并“消毒”
export async function loadAllFromIDB(): Promise<StoredDocument[]> {
  const health = await checkIndexedDBHealth();
  if (!health.available || health.documentCount === 0) return [];

  const raw = await recoverAllFromIndexedDB();
  return raw
    .filter((d: StoredDocument) => typeof d.id === "string" && d.id.length > 0)
    .map((d) => normalizeDoc(d));
}

// 4) 供冷启动兜底：新建默认文档
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

// ========== 内部工具 ==========
function sigOf(d: StoredDocument): string {
  return `${d.updatedAt}:${d.version}:${(d as any).deletedAt ?? ""}`;
}

function cloneValue<T>(v: T): T {
  if (typeof structuredClone === "function") return structuredClone(v);
  return JSON.parse(JSON.stringify(v)) as T;
}

function deriveTitle(value: Value, fallback: string): string {
  for (const node of value as any) {
    const t = NodeApi.string(node).trim();
    if (t) return t.length <= 60 ? t : `${t.slice(0, 60)}…`;
  }
  const s = fallback.trim();
  return s.length <= 60 ? s : `${s.slice(0, 60)}…`;
}

function normalizeDoc(doc: StoredDocument): StoredDocument {
  const now = Date.now();
  const content = Array.isArray(doc.content)
    ? doc.content
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
  };
}
