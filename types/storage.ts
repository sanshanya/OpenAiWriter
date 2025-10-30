// types/storage.ts
import { NodeApi, type Value } from "platejs";
import {
  INITIAL_DOCUMENT_CONTENT,
  INITIAL_DOCUMENT_TITLE,
} from "@/components/editor/initial-value";

export type DocumentRecord = {
  id: string;
  title: string;
  content: Value;
  createdAt: number;
  updatedAt: number;
  version: number;
  deletedAt?: number | null;
};

export type DocumentMeta = Omit<DocumentRecord, "content">;

export function cloneValue<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

export function deriveTitle(value: Value, fallback: string): string {
  const nodes = Array.isArray(value)
    ? (value as Array<Parameters<typeof NodeApi.string>[0]>)
    : [];
  for (const node of nodes) {
    const text = NodeApi.string(node).trim();
    if (text) return text.length <= 60 ? text : `${text.slice(0, 60)}…`;
  }
  const safe = typeof fallback === "string" ? fallback.trim() : "";
  return safe.length <= 60 ? safe : `${safe.slice(0, 60)}…`;
}

export function makeDefaultDoc(): DocumentRecord {
  const now = Date.now();
  const content = cloneValue(INITIAL_DOCUMENT_CONTENT);
  return {
    id: crypto.randomUUID(),
    title: deriveTitle(content as Value, INITIAL_DOCUMENT_TITLE),
    content,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}
