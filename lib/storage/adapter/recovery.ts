// lib/storage/adapter/recovery.ts
"use client";

import { type Value } from "platejs";
import {
  INITIAL_DOCUMENT_CONTENT,
  INITIAL_DOCUMENT_TITLE,
} from "@/components/editor/initial-value";
import {
  cloneValue,
  deriveTitle,
  type DocumentRecord,
} from "@/types/storage";
import { STORAGE_CONFIG } from "@/lib/storage/constants";
import {
  checkIndexedDBHealth,
  recoverAllFromIndexedDB,
  purgeDeletedOlderThan,
} from "@/lib/storage/local/idb";
import { StorageLogger } from "@/lib/storage/logger";

const DELETION_RETENTION_MS =
  STORAGE_CONFIG.DELETION_RETENTION_DAYS * 24 * 60 * 60 * 1000;

export async function getIDBRecoveryMetas(): Promise<
  Array<Pick<DocumentRecord, "id" | "title" | "updatedAt" | "version">>
> {
  const health = await checkIndexedDBHealth();
  if (!health.available) return [];

  const raw = await recoverAllFromIndexedDB();
  const live = raw.filter((d) => d.deletedAt == null);
  StorageLogger.recovery(live.length, "idb");

  const safeTitle = (doc: DocumentRecord): string => {
    const trimmed = doc.title.trim();
    if (trimmed) return trimmed;
    return deriveTitle(doc.content, "(未命名)");
  };

  return live
    .filter((d) => typeof d.id === "string" && d.id.length > 0)
    .map((d) => ({
      id: d.id,
      title: safeTitle(d),
      updatedAt: typeof d.updatedAt === "number" ? d.updatedAt : Date.now(),
      version: typeof d.version === "number" ? d.version : 1,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function loadAllFromIDB(): Promise<DocumentRecord[]> {
  const health = await checkIndexedDBHealth();
  if (!health.available || health.documentCount === 0) return [];

  const cutoff = Date.now() - DELETION_RETENTION_MS;
  purgeDeletedOlderThan(cutoff).catch((error) => {
    StorageLogger.error("purgeDeletedOlderThan", error);
  });

  const raw = await recoverAllFromIndexedDB();
  StorageLogger.recovery(raw.length, "idb");
  return raw
    .filter((d: DocumentRecord) => typeof d.id === "string" && d.id.length > 0)
    .map((d) => normalizeDoc(d));
}

function normalizeDoc(doc: DocumentRecord): DocumentRecord {
  const now = Date.now();
  const content = Array.isArray(doc.content)
    ? (doc.content as Value)
    : cloneValue(INITIAL_DOCUMENT_CONTENT);
  const title =
    typeof doc.title === "string" && doc.title.trim()
      ? doc.title
      : deriveTitle(content, INITIAL_DOCUMENT_TITLE);

  return {
    ...doc,
    content,
    title,
    version: typeof doc.version === "number" ? doc.version : 1,
    createdAt: typeof doc.createdAt === "number" ? doc.createdAt : now,
    updatedAt: typeof doc.updatedAt === "number" ? doc.updatedAt : now,
    deletedAt: typeof doc.deletedAt === "number" ? doc.deletedAt : undefined,
  };
}

export { makeDefaultDoc } from "@/types/storage";
