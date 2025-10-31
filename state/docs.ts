"use client";

import { create } from "zustand";

import type { DocumentMeta } from "@/types/storage";

export type DocMetaEntry = DocumentMeta & {
  migratedAt?: number | null;
};

type DocMetaPatch = Partial<DocMetaEntry>;

type DocsState = {
  meta: Map<string, DocMetaEntry>;
  activeId: string | null;
  hydrateMetas: (metas: Iterable<DocMetaEntry | DocumentMeta>) => void;
  setActiveId: (id: string | null) => void;
  setMeta: (id: string, patch: DocMetaPatch) => void;
  removeMeta: (id: string) => void;
  markMigrated: (id: string, migratedAt?: number) => void;
  clear: () => void;
};

export const useDocsState = create<DocsState>()((set) => ({
  meta: new Map<string, DocMetaEntry>(),
  activeId: null,
  hydrateMetas: (metas) =>
    set(() => {
      const next = new Map<string, DocMetaEntry>();
      for (const meta of metas) {
        const entry: DocMetaEntry = {
          ...(meta as DocumentMeta),
          ...(meta as DocMetaEntry),
        };
        next.set(entry.id, entry);
      }
      return { meta: next };
    }),
  setActiveId: (id) => set({ activeId: id }),
  setMeta: (id, patch) =>
    set((state) => {
      const next = new Map(state.meta);
      const prev = next.get(id);
      if (!prev) {
        const now = Date.now();
        next.set(id, {
          id,
          title: patch.title ?? "",
          createdAt: patch.createdAt ?? now,
          updatedAt: patch.updatedAt ?? now,
          version: patch.version ?? 1,
          contentVersion: patch.contentVersion ?? now,
          deletedAt: patch.deletedAt ?? null,
          migratedAt: patch.migratedAt ?? null,
        });
      } else {
        next.set(id, {
          ...prev,
          ...patch,
          migratedAt:
            patch.migratedAt !== undefined ? patch.migratedAt : prev.migratedAt,
        });
      }
      return { meta: next };
    }),
  removeMeta: (id) =>
    set((state) => {
      if (!state.meta.has(id)) return null;
      const next = new Map(state.meta);
      next.delete(id);
      const activeId = state.activeId === id ? null : state.activeId;
      return { meta: next, activeId };
    }),
  markMigrated: (id, migratedAt) =>
    set((state) => {
      const entry = state.meta.get(id);
      if (!entry) return null;
      const next = new Map(state.meta);
      next.set(id, {
        ...entry,
        migratedAt: migratedAt ?? Date.now(),
      });
      return { meta: next };
    }),
  clear: () => set({ meta: new Map(), activeId: null }),
}));
