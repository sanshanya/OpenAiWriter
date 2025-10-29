"use client";

import { type Value } from "platejs";

export type StoredDocument = {
  id: string;
  title: string;
  content: Value;
  createdAt: number;
  updatedAt: number;
  version: number;
  deletedAt?: number; // ← 新增：墓碑（软删除标记），ms 时间戳
};

/**
 * 新的轻量 meta 形状（localStorage 专用）
 */
export type DocMeta = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
  version: number;
};

/**
 * 新的正文快照形状（IndexedDB 专用）
 */
export type DocSnapshot = {
  id: string;
  version: number;
  updatedAt: number;
  // 原 Plate/Slate value，按需轻量化或分块（先不做压缩，留待 P2）
  content: unknown;
};
