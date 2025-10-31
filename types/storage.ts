// types/storage.ts
import { NodeApi } from "platejs";
import {
  INITIAL_DOCUMENT_CONTENT,
  INITIAL_DOCUMENT_TITLE,
} from "@/components/editor/initial-value";
import type { MyValue } from "@/types/plate-elements";

export type DocumentRecord = {
  id: string;
  title: string;
  content: MyValue;
  initialContent: MyValue;
  createdAt: number;
  updatedAt: number;
  version: number;
  contentVersion: number;
  deletedAt?: number | null;
};

export type DocumentMeta = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  version: number;
  contentVersion: number;
  deletedAt: number | null;
};

export function cloneValue<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

export function deriveTitle(value: MyValue, fallback: string): string {
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
  const initialContent = cloneValue(content);
  const cryptoSource =
    typeof globalThis.crypto === "object" ? globalThis.crypto : undefined;
  const rid =
    typeof cryptoSource?.randomUUID === "function"
      ? cryptoSource.randomUUID()
      :
    `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  return {
    id: rid,
    title: deriveTitle(content, INITIAL_DOCUMENT_TITLE),
    content,
    initialContent,
    createdAt: now,
    updatedAt: now,
    version: 1,
    contentVersion: now,
  };
}
