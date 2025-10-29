"use client";

import type { DocMeta } from "@/hooks/use-persistence";

const META_KEY = "aiwriter:metas:v4";

export function loadMetas(): DocMeta[] {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr;
  } catch {
    return [];
  }
}

let saveTimer: number | null = null;
let lastSerialized = ""; // 合并写，减少重复 stringify

export function saveMetasDebounced(metas: DocMeta[], delay = 100) {
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