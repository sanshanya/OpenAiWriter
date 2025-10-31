// lib/storage/adapter/normalize.ts
"use client";

import type { MyValue } from "@/types/plate-elements";
import {
  INITIAL_DOCUMENT_CONTENT,
  INITIAL_DOCUMENT_TITLE,
} from "@/components/editor/initial-value";
import { cloneValue, deriveTitle, type DocumentRecord } from "@/types/storage";

export function normalizeDoc(doc: DocumentRecord): DocumentRecord {
  const now = Date.now();
  const content: MyValue = Array.isArray(doc.content)
    ? doc.content
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
