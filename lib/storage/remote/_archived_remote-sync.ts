/* eslint-disable @typescript-eslint/no-explicit-any, prefer-const */
// lib/remote-sync.ts
"use client";

import type { DocumentRecord } from "@/types/storage";

// ====== 配置开关 ======
const ENABLE_REMOTE_SYNC = true;
export const USE_OUTBOX = false;                   // ← 打开即改为“事件流同步”
const SNAPSHOT_ENDPOINT = "/api/documents/sync";
const EVENTS_ENDPOINT = "/api/documents/events";
const DEBOUNCE_MS = 2000;
const QUEUE_KEY = "remote-sync-queue-v1";

// ====== 快照同步类型 ======
export type SyncDoc = {
  id: string;
  title?: string;
  version?: number;
  updatedAt?: number;
  content?: string;
  deletedAt?: number | null;
};

// ====== 冲突订阅（沿用你已有的）======
export type Conflict = {
  id: string;
  clientVersion: number;
  serverVersion: number;
  serverContent: string;
  serverDeletedAt?: number | null;
  serverUpdatedAt: number;
  serverTitle?: string;
};
type ConflictListener = (conflicts: Conflict[]) => void;
const listeners: ConflictListener[] = [];
export function onConflicts(cb: ConflictListener) {
  listeners.push(cb);
  return () => {
    const i = listeners.indexOf(cb);
    if (i >= 0) listeners.splice(i, 1);
  };
}
function emitConflicts(arr: Conflict[]) {
  if (arr.length === 0) return;
  listeners.forEach((fn) => { try { fn(arr); } catch {} });
}

// ====== Outbox 相关（事件流）======
import {
  readOutbox,
  getAcks,
  ackUpTo,
  compactOutboxByAck,
  removeOutboxByIds,
  type OutboxEvent,
} from "./_archived_outbox";

// ====== 快照模式内部状态 ======
let pending: Map<string, SyncDoc> = new Map();
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let processingSnapshots = false;

// ====== Outbox 模式内部状态 ======
let outboxTimer: ReturnType<typeof setTimeout> | null = null;
let processingOutbox = false;

// ====== 对外 API：变更入队（仅在“快照模式”下使用）======
export function enqueueChangedForSync(changed: DocumentRecord[]) {
  if (!ENABLE_REMOTE_SYNC || USE_OUTBOX || changed.length === 0) return;

  for (const d of changed) {
    pending.set(d.id, {
      id: d.id,
      title: d.title,
      version: d.version ?? 1,
      updatedAt: d.updatedAt,
      content: JSON.stringify(d.content),
      deletedAt: (d as any).deletedAt ?? null,
    });
  }
  scheduleDebouncedFlush();
}

// ====== 对外 API：触发 Outbox flush（在 storage-adapter 里调用）======
export function scheduleOutboxFlush() {
  if (!ENABLE_REMOTE_SYNC || !USE_OUTBOX) return;
  if (outboxTimer) clearTimeout(outboxTimer);
  outboxTimer = setTimeout(() => {
    processOutbox();
  }, DEBOUNCE_MS);
}

// ====== 快照模式：防抖合并 ======
function scheduleDebouncedFlush() {
  if (!ENABLE_REMOTE_SYNC || USE_OUTBOX) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const batch = Array.from(pending.values());
    pending.clear();
    if (batch.length > 0) {
      persistTask({ docs: batch, enqueuedAt: Date.now(), attempt: 0 });
      processQueue();
    }
  }, DEBOUNCE_MS);
}

// ====== 快照模式：本地队列（为了离线重试）======
type SyncTask = { docs: SyncDoc[]; enqueuedAt: number; attempt: number };
function readQueue(): SyncTask[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as SyncTask[]) : [];
  } catch { return []; }
}
function writeQueue(q: SyncTask[]) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch {}
}
function persistTask(task: SyncTask) {
  const q = readQueue(); q.push(task); writeQueue(q);
}

// ====== 快照模式：处理队列 ======
export async function processQueue() {
  if (!ENABLE_REMOTE_SYNC || USE_OUTBOX || processingSnapshots) return;
  processingSnapshots = true;
  try {
    let q = readQueue();
    while (q.length > 0) {
      const task = q[0];
      const ok = await sendSnapshots(task.docs).catch(() => false);
      if (ok) { q.shift(); writeQueue(q); }
      else {
        task.attempt = (task.attempt ?? 0) + 1;
        const backoff = Math.min(300_000, 1000 * 2 ** (task.attempt - 1));
        q[0] = task; writeQueue(q);
        setTimeout(() => { processingSnapshots = false; processQueue(); }, backoff);
        return;
      }
    }
  } finally { processingSnapshots = false; }
}

// ====== Outbox 模式：处理 outbox 事件 ======
export async function processOutbox() {
  if (!ENABLE_REMOTE_SYNC || !USE_OUTBOX || processingOutbox) return;
  processingOutbox = true;
  try {
    const acks = getAcks();
    // 仅发送 “版本 > ACK” 的事件
    const all = readOutbox().filter((e) => (acks[e.docId] ?? 0) < e.version);
    if (all.length === 0) return;

    // 可以做分片，这里简单一次全发
    const ok = await sendEvents(all).catch(() => false);
    if (ok) {
      // 成功：服务器会返回 ackedVersions；本地提升 ACK 并压缩
      // 压缩逻辑在 sendEvents 内部已调用
    } else {
      // 失败：指数退避
      setTimeout(() => { processingOutbox = false; processOutbox(); }, 2000);
      return;
    }
  } finally {
    processingOutbox = false;
  }
}

// ====== 网络恢复时尝试 ======
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    if (USE_OUTBOX) processOutbox();
    else processQueue();
  });
}

// ====== 发送：快照模式 ======
async function sendSnapshots(docs: SyncDoc[]): Promise<boolean> {
  try {
    const res = await fetch(SNAPSHOT_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ documents: docs }),
    });
    if (!res.ok) return false;

    // 冲突广播（若后端返回）
    try {
      const payload = await res.json();
      const conflicts = payload?.conflicts ?? [];
      if (Array.isArray(conflicts) && conflicts.length > 0) emitConflicts(conflicts);
    } catch {}
    return true;
  } catch { return false; }
}

// ====== 发送：事件模式 ======
type EventsPayload = {
  events: Array<{
    id: string;
    docId: string;
    kind: "create" | "update" | "delete";
    version: number;
    updatedAt: number;
    deletedAt?: number | null;
    content?: string;
    idempotencyKey: string;
  }>;
};
type EventsAck = {
  success: boolean;
  ackedVersions: Record<string, number>; // docId -> highest version acked
  acceptedIds: string[];                 // accepted event row ids
  conflicts?: Conflict[];                // 可选：后端也能返回冲突
};
async function sendEvents(batch: OutboxEvent[]): Promise<boolean> {
  try {
    const payload: EventsPayload = { events: batch };
    const res = await fetch(EVENTS_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return false;

    const data = (await res.json().catch(() => ({}))) as EventsAck;

    // 提升 ACK
    for (const [docId, v] of Object.entries(data.ackedVersions ?? {})) {
      ackUpTo(docId, v);
    }
    // 删除服务端确认接收的事件行
    if (Array.isArray(data.acceptedIds) && data.acceptedIds.length > 0) {
      removeOutboxByIds(data.acceptedIds);
    }
    // 压缩 outbox（删除 <= ACK 的事件）
    compactOutboxByAck();

    // 广播冲突（如果后端返回）
    if (Array.isArray(data.conflicts) && data.conflicts.length > 0) {
      emitConflicts(data.conflicts);
    }

    return true;
  } catch { return false; }
}
