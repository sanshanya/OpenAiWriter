// hooks/documents-model.ts
"use client";

import { nanoid } from "platejs";
import {
  INITIAL_DOCUMENT_CONTENT,
  INITIAL_DOCUMENT_TITLE,
} from "@/components/editor/initial-value";
import {
  cloneValue,
  deriveTitle,
  type DocumentRecord,
} from "@/types/storage";
import type { MyValue } from "@/types/plate-elements";

export type ModelState = {
  docs: DocumentRecord[];
  activeId: string | null;
};

export type Action =
  | { type: "INIT"; docs: DocumentRecord[]; activeId?: string | null }
  | { type: "SELECT"; id: string }
  | { type: "CREATE"; now: number }
  | { type: "UPDATE_CONTENT"; id: string; value: MyValue; now: number }
  | { type: "SNAPSHOT_CONTENT"; id: string; now: number }
  | { type: "DELETE_SOFT"; id: string; now: number }
  | { type: "RESTORE"; id: string; now: number }
  | { type: "PURGE"; id: string }
  | {
      type: "APPLY_SERVER_STATE";
      id: string;
      server: {
        title?: string;
        content: MyValue;
        version: number;
        updatedAt: number;
        deletedAt?: number | null;
        contentVersion?: number;
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
          docs.find((d) => d.deletedAt == null)?.id ||
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
      const doc: DocumentRecord = {
        id: nanoid(),
        title: deriveTitle(content, INITIAL_DOCUMENT_TITLE),
        content,
        initialContent: content,
        createdAt: now,
        updatedAt: now,
        version: 1,
        contentVersion: now,
      };
      const docs = [doc, ...state.docs];
      return { docs, activeId: doc.id };
    }

    case "SNAPSHOT_CONTENT": {
      const { id, now } = action;
      const docs = state.docs.map((d) =>
        d.id === id
          ? {
              ...d,
              initialContent: cloneValue(d.content),
              contentVersion: now,
            }
          : d,
      );
      return { ...state, docs };
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
              contentVersion: d.contentVersion,
            }
          : d
      );
      return { ...state, docs };
    }

    case "DELETE_SOFT": {
      const { id, now } = action;
      const docs = state.docs.map((d) =>
        d.id === id && d.deletedAt == null
          ? {
              ...d,
              deletedAt: now,
              updatedAt: now,
              version: (d.version ?? 1) + 1,
            }
          : d
      );
      const nextActive = docs
        .filter((d) => d.deletedAt == null)
        .sort((a, b) => b.updatedAt - a.updatedAt)[0];
      return { docs, activeId: nextActive?.id ?? null };
    }

    case "RESTORE": {
      const { id, now } = action;
      const docs = state.docs.map((d) =>
        d.id === id && d.deletedAt != null
          ? {
              ...d,
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
          ? docs.find((d) => d.deletedAt == null)?.id ?? null
          : state.activeId;
      return { ...state, docs, activeId };
    }

    case "APPLY_SERVER_STATE": {
      const { id, server } = action;
      const docs = state.docs.map((d) => {
        if (d.id !== id) return d;
        return {
          ...d,
          title: server.title ?? d.title,
          content: cloneValue(server.content),
          initialContent: cloneValue(server.content),
          version: server.version,
          updatedAt: server.updatedAt,
          deletedAt: server.deletedAt ?? undefined,
          contentVersion:
            typeof server.contentVersion === "number"
              ? server.contentVersion
              : Date.now(),
        };
      });
      // 若目标被服务器删除，activeId 换到下一个未删除文档；否则保持不变/继续指向 id
      const activeId =
        (docs.find((x) => x.id === id && x.deletedAt == null) && id) ||
        docs.find((x) => x.deletedAt == null)?.id ||
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
