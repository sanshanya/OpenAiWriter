"use client";

import type { DocumentMeta } from "@/types/storage";
import { STORAGE_CONFIG, STORAGE_KEYS } from "@/lib/storage/constants";

const META_KEY = STORAGE_KEYS.META;

export function loadMetas(): DocumentMeta[] {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((meta: Partial<DocumentMeta>) => ({
        id: typeof meta?.id === "string" ? meta.id : "",
        title: typeof meta?.title === "string" ? meta.title : "",
        createdAt: typeof meta?.createdAt === "number" ? meta.createdAt : Date.now(),
        updatedAt: typeof meta?.updatedAt === "number" ? meta.updatedAt : Date.now(),
        version: typeof meta?.version === "number" ? meta.version : 1,
        contentVersion:
          typeof meta?.contentVersion === "number" ? meta.contentVersion : 0,
        deletedAt:
          typeof meta?.deletedAt === "number" ? meta.deletedAt : null,
      }))
      .filter((meta) => meta.id.length > 0) as DocumentMeta[];
  } catch {
    return [];
  }
}

let saveTimer: number | null = null;
let lastSerialized = ""; // 合并写，减少重复 stringify

export function saveMetasDebounced(
  metas: DocumentMeta[],
  delay = STORAGE_CONFIG.META_SAVE_DEBOUNCE_MS,
) {
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      const next = JSON.stringify(metas);
      if (next !== lastSerialized) {
        localStorage.setItem(META_KEY, next);
        lastSerialized = next;
      }
    } catch {
      // 限流/告警可加在这
    }
  }, delay);
}

export function saveMetas(metas: DocumentMeta[]): void {
  const stable = [...metas].sort((a, b) => b.updatedAt - a.updatedAt);
  saveMetasDebounced(stable, STORAGE_CONFIG.META_SAVE_DEBOUNCE_MS);
}

export function saveMetasImmediate(metas: DocumentMeta[]): void {
  // 仅退出流程调用
  const stable = [...metas].sort((a, b) => b.updatedAt - a.updatedAt);
  if (saveTimer) {
    window.clearTimeout(saveTimer);
    saveTimer = null;
  }
  try {
    const next = JSON.stringify(stable);
    if (next !== lastSerialized) {
      localStorage.setItem(META_KEY, next);
      lastSerialized = next;
    }
  } catch {
    // 静默失败，退出流程不应阻塞
  }
}
