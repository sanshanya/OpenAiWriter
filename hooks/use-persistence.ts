"use client";

import { normalizeNodeId, type Value } from "platejs";
import {
  INITIAL_DOCUMENT_CONTENT,
  INITIAL_DOCUMENT_TITLE,
} from "@/components/editor/initial-value";

const LOCAL_STORAGE_KEY = "aiwriter:documents";

export type StoredDocument = {
  id: string;
  title: string;
  content: Value;
  createdAt: number;
  updatedAt: number;
  version: number;
  deletedAt?: number; // ← 新增：墓碑（软删除标记），ms 时间戳
};

// --- Helper Functions ---

function cloneValue<T>(value: T): T {
  // structuredClone is faster and more robust
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Validates a raw object to ensure it's a valid StoredDocument.
 * Provides default values for missing/invalid fields.
 */
function sanitizeStoredDocument(raw: any): StoredDocument | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const id =
    typeof raw.id === "string" && raw.id.trim().length > 0 ? raw.id.trim() : null;
  if (!id) return null;

  return {
    id,
    title:
      typeof raw.title === "string" && raw.title.trim().length > 0
        ? raw.title.trim()
        : INITIAL_DOCUMENT_TITLE,
    content: Array.isArray(raw.content)
      ? (normalizeNodeId(cloneValue(raw.content)) as Value)
      : cloneValue(INITIAL_DOCUMENT_CONTENT),
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : Date.now(),
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : Date.now(),
    version: typeof raw.version === "number" ? raw.version : 1,
    deletedAt: typeof raw.deletedAt === "number" ? raw.deletedAt : undefined, // ← 新增
  };
}

// --- localStorage Interaction ---

/**
 * Reads all documents directly from localStorage.
 * This is a synchronous operation, intended for client-side initialization.
 */
export function getCachedDocuments(): StoredDocument[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as (StoredDocument[] | Record<string, StoredDocument>);

    // Support both old (object) and new (array) format for migration
    const documentsArray = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object' && 'documents' in parsed && typeof parsed.documents === 'object' // Check for V2 format
      ? Object.values((parsed as any).documents)
      : Array.isArray(parsed)
      ? parsed
      : [];


    return documentsArray
      .map(sanitizeStoredDocument)
      .filter((doc): doc is StoredDocument => !!doc)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (error) {
    console.warn("[persistence] Failed to read from localStorage:", error);
    return [];
  }
}

/**
 * Saves the entire list of documents to localStorage.
 * This is a synchronous operation.
 */
export function saveAllDocuments(documents: StoredDocument[]) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const data = JSON.stringify(documents);
    window.localStorage.setItem(LOCAL_STORAGE_KEY, data);
  } catch (error) {
    console.error("[persistence] Failed to save to localStorage:", error);
  }
}
