"use client";

import * as React from "react";
import { NodeApi, nanoid, type Value } from "platejs";
import {
  getCachedDocuments,
  saveAllDocuments,
  type StoredDocument,
} from "@/hooks/use-persistence";
import {
  INITIAL_DOCUMENT_CONTENT,
  INITIAL_DOCUMENT_TITLE,
} from "@/components/editor/initial-value";

type DocumentRecord = StoredDocument;
type DocumentMeta = Omit<StoredDocument, "content">;

type DocumentsContextValue = {
  documents: DocumentMeta[];
  activeDocument: DocumentRecord | null;
  activeDocumentId: string | null;
  createDocument: () => void;
  selectDocument: (id: string) => void;
  updateDocumentContent: (value: Value) => void;
  deleteDocument: (id: string) => void;
};

const DocumentsContext = React.createContext<DocumentsContextValue | null>(null);

export function DocumentsProvider({ children }: { children: React.ReactNode }) {
  // ============================================================
  // React State - The Single Source of Truth
  // =================================K===========================
  const [documents, setDocuments] = React.useState<DocumentRecord[]>([]);
  const [activeDocumentId, setActiveDocumentId] = React.useState<string | null>(null);

  // A snapshot ref to prevent redundant saves on selection change, etc.
  const lastSavedSnapshot = React.useRef<Record<string, string>>({});

  // --- Initialization Effect ---
  React.useEffect(() => {
    // This effect runs only once on the client
    const cached = getCachedDocuments();
    if (cached.length > 0) {
      setDocuments(cached);
      setActiveDocumentId(cached[0].id);
      cached.forEach(doc => {
        lastSavedSnapshot.current[doc.id] = JSON.stringify(doc.content);
      });
    } else {
      const newDoc = createDocumentRecord();
      setDocuments([newDoc]);
      setActiveDocumentId(newDoc.id);
      saveAllDocuments([newDoc]); // Persist initial document
      lastSavedSnapshot.current[newDoc.id] = JSON.stringify(newDoc.content);
    }
  }, []);

  // --- Memoized Derived State ---
  const activeDocument = React.useMemo(
    () => documents.find((doc) => doc.id === activeDocumentId) || null,
    [documents, activeDocumentId]
  );

  const documentMetas = React.useMemo(
    () =>
      documents
        .map(({ content: _, ...meta }) => meta)
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [documents]
  );

  // --- Core Operations ---

  const createDocument = React.useCallback(() => {
    const newDoc = createDocumentRecord();
    setDocuments((prevDocs) => {
      const newDocs = [newDoc, ...prevDocs];
      saveAllDocuments(newDocs);
      lastSavedSnapshot.current[newDoc.id] = JSON.stringify(newDoc.content);
      return newDocs;
    });
    setActiveDocumentId(newDoc.id);
  }, []);

  const selectDocument = React.useCallback(
    (id: string) => {
      if (id !== activeDocumentId) {
        // CRITICAL FIX FOR DATA LOSS:
        // By wrapping the state update in a timeout, we push it to the next
        // event loop tick. This gives React time to process any pending
        // state updates from `onChange` that were triggered right before
        // the user clicked the switch button. This ensures we don't switch
        // the active ID before the latest content has been saved to the state.
        setTimeout(() => {
          setActiveDocumentId(id);
        }, 0);
      }
    },
    [activeDocumentId],
  );

  const updateDocumentContent = React.useCallback(
    (value: Value) => {
      if (!activeDocumentId) return;

      const snapshot = JSON.stringify(value);
      if (lastSavedSnapshot.current[activeDocumentId] === snapshot) {
        return; // Content hasn't changed, no need to update
      }

      const now = Date.now();

      // Use functional update to prevent re-creating the entire array on every keystroke
      setDocuments((prevDocs) => {
        const newDocs = prevDocs.map((doc) => {
          if (doc.id === activeDocumentId) {
            return {
              ...doc,
              content: value,
              title: deriveTitle(value, doc.title),
              updatedAt: now,
              version: (doc.version ?? 1) + 1,
            };
          }
          return doc;
        });

        // Save immediately after state is updated
        saveAllDocuments(newDocs);
        lastSavedSnapshot.current[activeDocumentId] = snapshot;
        
        return newDocs;
      });
    },
    [activeDocumentId]
  );

  const deleteDocument = React.useCallback(
    (id: string) => {
      setDocuments((prevDocs) => {
        const newDocs = prevDocs.filter((doc) => doc.id !== id);
        delete lastSavedSnapshot.current[id];

        if (newDocs.length === 0) {
          const newDoc = createDocumentRecord();
          saveAllDocuments([newDoc]);
          lastSavedSnapshot.current[newDoc.id] = JSON.stringify(newDoc.content);
          setActiveDocumentId(newDoc.id);
          return [newDoc];
        } else {
          saveAllDocuments(newDocs);
          if (activeDocumentId === id) {
            const sorted = [...newDocs].sort(
              (a, b) => b.updatedAt - a.updatedAt,
            );
            setActiveDocumentId(sorted[0].id);
          }
          return newDocs;
        }
      });
    },
    [activeDocumentId],
  );

  // --- Context Value ---

  const value = React.useMemo<DocumentsContextValue>(
    () => ({
      documents: documentMetas,
      activeDocument,
      activeDocumentId,
      createDocument,
      selectDocument,
      updateDocumentContent,
      deleteDocument,
    }),
    [
      documentMetas,
      activeDocument,
      activeDocumentId,
      createDocument,
      selectDocument,
      updateDocumentContent,
      deleteDocument,
    ]
  );

  return (
    <DocumentsContext.Provider value={value}>
      {children}
    </DocumentsContext.Provider>
  );
}

export function useDocuments() {
  const context = React.useContext(DocumentsContext);
  if (!context) {
    throw new Error("useDocuments must be used within a DocumentsProvider");
  }
  return context;
}

// ============================================================
// Helper Functions
// ============================================================

function createDocumentRecord(title?: string): DocumentRecord {
  const now = Date.now();
  const content = cloneValue(INITIAL_DOCUMENT_CONTENT);
  return {
    id: nanoid(),
    title: title?.trim() || deriveTitle(content, INITIAL_DOCUMENT_TITLE),
    content,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

function deriveTitle(value: Value, fallback: string): string {
  for (const node of value) {
    const text = NodeApi.string(node).trim();
    if (text.length > 0) {
      return truncateTitle(text);
    }
  }
  return truncateTitle(fallback);
}

function truncateTitle(text: string, maxLength = 60): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength)}…`;
}

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}
