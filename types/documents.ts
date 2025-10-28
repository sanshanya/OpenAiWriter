// types/documents.ts
import type { Value } from "platejs";

/**
 * 文档记录（运行态）
 * - 用于 React State 与编辑器渲染
 * - content 为 Plate.js 的富文本 Value
 */
export interface DocumentRecord {
  id: string;       // UUID
  title: string;    // 从 content 的第一段文本提取
  content: Value;   // 富文本内容（运行态对象）
  version: number;  // 单调递增，仅用于冲突检测/排序
  createdAt: number;
  updatedAt: number;
}

/**
 * 持久化格式（存储态）
 * - 用于 localStorage / IndexedDB / 远端传输
 * - content 为 JSON.stringify(Value)
 */
export interface StoredDocument extends Omit<DocumentRecord, "content"> {
  content: string;
}
