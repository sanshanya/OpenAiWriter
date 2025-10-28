// hooks/documents-model.ts
"use client";

import { nanoid, NodeApi, type Value } from "platejs";
import type { StoredDocument } from "@/hooks/use-persistence";
import { INITIAL_DOCUMENT_CONTENT, INITIAL_DOCUMENT_TITLE } from "@/components/editor/initial-value";

export type ModelState = {
  docs: StoredDocument[];
  activeId: string | null;
};

export type Action =
  | { type: "INIT"; docs: StoredDocument[] }
  | { type: "SELECT"; id: string }
  | { type: "CREATE"; now: number }
  | { type: "UPDATE_CONTENT"; id: string; value: Value; now: number }
  | { type: "DELETE_SOFT"; id: string; now: number };

export function documentsReducer(state: ModelState, action: Action): ModelState {
  switch (action.type) {
    case "INIT": {
      const docs = [...action.docs].sort((a, b) => b.updatedAt - a.updatedAt);
      const first = docs.find(d => !("deletedAt" in d && (d as any).deletedAt));
      return { docs, activeId: first?.id ?? null };
    }
    case "SELECT": {
      return { ...state, activeId: action.id };
    }
    case "CREATE": {
      const now = action.now;
      const content = cloneValue(INITIAL_DOCUMENT_CONTENT);
      const doc: StoredDocument = {
        id: nanoid(),
        title: deriveTitle(content, INITIAL_DOCUMENT_TITLE),
        content,
        createdAt: now,
        updatedAt: now,
        version: 1,
      } as StoredDocument;
      const docs = [doc, ...state.docs];
      return { docs, activeId: doc.id };
    }
    case "UPDATE_CONTENT": {
      const { id, value, now } = action;
      const docs = state.docs.map(d =>
        d.id === id
          ? {
              ...d,
              content: value,
              title: deriveTitle(value, d.title),
              updatedAt: now,
              version: (d.version ?? 1) + 1,
            }
          : d
      );
      return { ...state, docs };
    }
    case "DELETE_SOFT": {
      const { id, now } = action;
      const docs = state.docs.map(d =>
        d.id === id && !(d as any).deletedAt
          ? { ...(d as any), deletedAt: now, updatedAt: now, version: (d.version ?? 1) + 1 }
          : d
      );
      const next = docs
        .filter(d => !(d as any).deletedAt)
        .sort((a, b) => b.updatedAt - a.updatedAt)[0];
      return { docs, activeId: next?.id ?? null };
    }
  }
}

function deriveTitle(value: Value, fallback: string): string {
  for (const node of value) {
    const text = NodeApi.string(node).trim();
    if (text.length > 0) return truncate(text);
  }
  return truncate(fallback);
}

function truncate(text: string, max = 60) {
  const s = text.trim();
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}
