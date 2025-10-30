/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/ban-ts-comment */
// lib/outbox.ts
"use client";

import type { DocumentRecord } from "@/types/storage";

const OUTBOX_KEY = "outbox-events-v1";
const ACK_KEY = "outbox-acks-v1";

export type OutboxEvent = {
  id: string;                  // 事件行ID（uuid）
  docId: string;
  kind: "create" | "update" | "delete"; // 软删记录为 delete（墓碑）
  version: number;             // 事件针对的文档版本
  updatedAt: number;           // 事件时间
  deletedAt?: number | null;   // 若是软删，带上墓碑
  content?: string;            // 更新/创建时携带（JSON 字符串）
  idempotencyKey: string;      // `${docId}:${version}:${updatedAt}`
};

function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function lsSet<T>(key: string, val: T) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    // @ts-ignore
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function computeIdempotencyKey(docId: string, version: number, updatedAt: number) {
  return `${docId}:${version}:${updatedAt}`;
}

/**
 * 根据 prev→changed 生成 outbox 事件并追加（append-only）
 * - prev 中不存在 → create
 * - changed.deletedAt 存在 → delete（软删墓碑）
 * - 否则 → update
 */
export function appendOutboxForChanged(
  changed: DocumentRecord[],
  prev: DocumentRecord[],
) {
  if (changed.length === 0) return;

  const prevMap = new Map(prev.map((d) => [d.id, d]));
  const outbox = lsGet<OutboxEvent[]>(OUTBOX_KEY, []);

  for (const d of changed) {
    const existed = prevMap.has(d.id);
    const kind: OutboxEvent["kind"] = (d as any).deletedAt ? "delete" : existed ? "update" : "create";
    const idempotencyKey = computeIdempotencyKey(d.id, d.version ?? 1, d.updatedAt);
    outbox.push({
      id: uuid(),
      docId: d.id,
      kind,
      version: d.version ?? 1,
      updatedAt: d.updatedAt,
      deletedAt: (d as any).deletedAt ?? null,
      content: kind !== "delete" ? JSON.stringify(d.content) : undefined,
      idempotencyKey,
    });
  }

  lsSet(OUTBOX_KEY, outbox);
}

/** 读取全部事件（后续可做分页/limit） */
export function readOutbox(): OutboxEvent[] {
  return lsGet<OutboxEvent[]>(OUTBOX_KEY, []);
}

/** 按 id 删除一批事件（已成功确认的） */
export function removeOutboxByIds(ids: string[]) {
  if (ids.length === 0) return;
  const set = new Set(ids);
  const outbox = readOutbox().filter((e) => !set.has(e.id));
  lsSet(OUTBOX_KEY, outbox);
}

/** 获取 ACK（每个文档已确认的最高版本） */
export function getAcks(): Record<string, number> {
  return lsGet<Record<string, number>>(ACK_KEY, {});
}

/** 将某文档的 ACK 提升到指定版本（幂等 max） */
export function ackUpTo(docId: string, version: number) {
  const acks = getAcks();
  const cur = acks[docId] ?? 0;
  if (version > cur) {
    acks[docId] = version;
    lsSet(ACK_KEY, acks);
  }
}

/** 压缩：删除 <= 当前 ACK 版本的事件 */
export function compactOutboxByAck() {
  const acks = getAcks();
  const outbox = readOutbox().filter((e) => (acks[e.docId] ?? 0) < e.version);
  lsSet(OUTBOX_KEY, outbox);
}
