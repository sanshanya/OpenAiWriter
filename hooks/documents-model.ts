// hooks/documents-model.ts
"use client";

import { nanoid, NodeApi, type Value } from "platejs";
import type { StoredDocument } from "@/hooks/use-persistence";
import {
  INITIAL_DOCUMENT_CONTENT,
  INITIAL_DOCUMENT_TITLE,
} from "@/components/editor/initial-value";

export type ModelState = {
  docs: StoredDocument[];
  activeId: string | null;
};

export type Action =
  | { type: "INIT"; docs: StoredDocument[]; activeId?: string | null }
  | { type: "SELECT"; id: string }
  | { type: "CREATE"; now: number }
  | { type: "UPDATE_CONTENT"; id: string; value: Value; now: number }
  | { type: "DELETE_SOFT"; id: string; now: number }
  | { type: "RESTORE"; id: string; now: number }
  | { type: "PURGE"; id: string }
  | {
      type: "APPLY_SERVER_STATE";
      id: string;
      server: {
        title?: string;
        content: any;
        version: number;
        updatedAt: number;
        deletedAt?: number | null;
      };
    }
  | { type: "BUMP_VERSION"; id: string; toVersion: number; now: number };

export function documentsReducer(state: ModelState, action: Action): ModelState {
  switch (action.type) {
    case "INIT": {
      const docs = [...action.docs].sort((a, b) => b.updatedAt - a.updatedAt);

      // 事务型 INIT：若 action 指定了 activeId，则优先采用
      let activeId: string | null;
      if (Object.prototype.hasOwnProperty.call(action, "activeId")) {
        activeId = action.activeId ?? null;
      } else {
        // 回退：沿用现有 activeId（若仍存在），否则选择第一篇未删除
        activeId =
          (state.activeId &&
            docs.some((d) => d.id === state.activeId) &&
            state.activeId) ||
          docs.find((d) => !(d as any).deletedAt)?.id ||
          null;
      }
      return { docs, activeId };
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
      const docs = state.docs.map((d) =>
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
      const docs = state.docs.map((d) =>
        d.id === id && !(d as any).deletedAt
          ? {
              ...(d as any),
              deletedAt: now,
              updatedAt: now,
              version: (d.version ?? 1) + 1,
            }
          : d
      );
      const nextActive = docs
        .filter((d) => !(d as any).deletedAt)
        .sort((a, b) => b.updatedAt - a.updatedAt)[0];
      return { docs, activeId: nextActive?.id ?? null };
    }

    case "RESTORE": {
      const { id, now } = action;
      const docs = state.docs.map((d) =>
        d.id === id && (d as any).deletedAt
          ? {
              ...(d as any),
              deletedAt: undefined,
              updatedAt: now,
              version: (d.version ?? 1) + 1,
            }
          : d
      );
      return { ...state, docs, activeId: id };
    }

    case "PURGE": {
      const docs = state.docs.filter((d) => d.id !== action.id);
      const activeId =
        state.activeId === action.id
          ? docs.find((d) => !(d as any).deletedAt)?.id ?? null
          : state.activeId;
      return { ...state, docs, activeId };
    }

    case "APPLY_SERVER_STATE": {
      const { id, server } = action;
      const docs = state.docs.map((d) =>
        d.id === id
          ? {
              ...d,
              title: server.title ?? d.title,
              content: server.content,
              version: server.version,
              updatedAt: server.updatedAt,
              // @ts-ignore
              deletedAt: server.deletedAt ?? undefined,
            }
          : d
      );
      // 若目标被服务器删除，activeId 换到下一个未删除文档；否则保持不变/继续指向 id
      const activeId =
        (docs.find((x) => x.id === id && !(x as any).deletedAt) && id) ||
        docs.find((x) => !(x as any).deletedAt)?.id ||
        null;
      return { ...state, docs, activeId };
    }

    case "BUMP_VERSION": {
      const { id, toVersion, now } = action;
      const docs = state.docs.map((d) =>
        d.id === id ? { ...d, version: toVersion, updatedAt: now } : d
      );
      return { ...state, docs };
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
