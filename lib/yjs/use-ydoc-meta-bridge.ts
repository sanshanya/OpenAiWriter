import { useEffect, useRef } from "react";
import * as Y from "yjs";

import { useDocsState } from "@/state/docs";
import { saveMetasDebounced } from "@/lib/storage/local/meta-cache";

type Options = {
  throttleMs?: number;
};

export function useYDocMetaBridge(
  docId: string | null,
  ydoc: Y.Doc | null,
  { throttleMs = 1000 }: Options = {},
) {
  const setMeta = useDocsState((state) => state.setMeta);

  const timerRef = useRef<number | null>(null);
  const lastCommitRef = useRef<number>(0);

  useEffect(() => {
    if (!docId || !ydoc) return undefined;

    const fragment = ydoc.getXmlFragment("content");

    const commit = () => {
      const now = Date.now();
      lastCommitRef.current = now;
      const title = deriveTitle(fragment);
      setMeta(docId, {
        updatedAt: now,
        ...(title ? { title } : {}),
      });
      try {
        const metas = Array.from(useDocsState.getState().meta.values()).map(
          (entry) => {
            const { migratedAt, ...meta } = entry;
            void migratedAt;
            return meta;
          },
        );
        saveMetasDebounced(metas);
      } catch (error) {
        console.warn("[useYDocMetaBridge] saveMetasDebounced failed", error);
      }
    };

    const handleUpdate = () => {
      if (throttleMs <= 0) {
        commit();
        return;
      }

      const now = Date.now();
      const elapsed = now - lastCommitRef.current;
      if (elapsed >= throttleMs) {
        if (timerRef.current !== null) {
          window.clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        commit();
      } else {
        if (timerRef.current !== null) {
          window.clearTimeout(timerRef.current);
        }
        timerRef.current = window.setTimeout(() => {
          commit();
          timerRef.current = null;
        }, throttleMs - elapsed);
      }
    };

    ydoc.on("update", handleUpdate);

    return () => {
      ydoc.off("update", handleUpdate);
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = null;
    };
  }, [docId, setMeta, throttleMs, ydoc]);
}

function deriveTitle(fragment: Y.XmlFragment) {
  try {
    const json = fragment.toJSON();
    if (!Array.isArray(json)) return undefined;

    for (const node of json) {
      const text = extractText(node);
      if (text.trim().length > 0) {
        return text.trim().slice(0, 80);
      }
    }
  } catch (error) {
    console.warn("[useYDocMetaBridge] deriveTitle failed", error);
  }
  return undefined;
}

function extractText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  if ("text" in (node as Record<string, unknown>)) {
    const value = (node as { text?: unknown }).text;
    return typeof value === "string" ? value : "";
  }
  if ("children" in (node as Record<string, unknown>)) {
    const children = (node as { children?: unknown }).children;
    if (Array.isArray(children)) {
      return children.map((child) => extractText(child)).join("");
    }
  }
  return "";
}
