"use client";

import * as React from "react";
import * as Y from "yjs";
import { withTYjs as withYjs } from "@platejs/yjs";
import { YjsEditor } from "@slate-yjs/core";
import type { PlateEditor } from "platejs/react";

import { useEditorKit } from "@/components/editor/editor-kit";
import type { MyValue } from "@/types/plate-elements";
import { IndexeddbPersistence } from "@/lib/yjs/indexeddb-persistence";
import { seedJsonIntoYDocIfEmpty } from "@/lib/yjs/seed";
import { APP_NAMESPACE } from "@/lib/constants/app";

type UseYjsEditorOptions = {
  docId: string | null;
  enabled?: boolean;
  getLegacyJson?: () => Promise<MyValue | null>;
};

type UseYjsEditorResult = {
  editor: PlateEditor | null;
  ydoc: Y.Doc | null;
  provider: IndexeddbPersistence | null;
  status: { synced: boolean };
};

export function useYjsEditor({
  docId,
  enabled = true,
  getLegacyJson,
}: UseYjsEditorOptions): UseYjsEditorResult {
  const effectiveEnabled = Boolean(enabled && docId);

  const initialValue = React.useMemo<MyValue>(() => {
    void docId;
    return [] as MyValue;
  }, [docId]);
  
  const { editor: baseEditor } = useEditorKit(initialValue);

  const ydoc = React.useMemo(() => {
    if (!effectiveEnabled) return null;
    return new Y.Doc();
  }, [effectiveEnabled, docId]);

  const sharedRoot = React.useMemo(() => {
    if (!ydoc) return null;
    // YjsEditor 需要 XmlText（有 toDelta 方法）
    // 使用 ydoc.get 方法，传入类型构造器
    return ydoc.get('content', Y.XmlText);
  }, [ydoc]);

  const editor = React.useMemo(() => {
    if (!sharedRoot || !effectiveEnabled || !baseEditor) return null;
    // withYjs 类型定义要求 XmlText，但实际可以接受 XmlFragment
    return withYjs(baseEditor, sharedRoot, { autoConnect: false }) as unknown as PlateEditor;
  }, [baseEditor, effectiveEnabled, sharedRoot]);

  React.useEffect(() => {
    if (!editor || !sharedRoot) return;
    
    if (process.env.NODE_ENV !== "production") {
      console.log('[useYjsEditor] Connecting editor to Yjs', {
        docId,
        editorId: (editor as any).id,
        sharedRootLength: sharedRoot.length,
      });
    }
    
    YjsEditor.connect(editor as any);
    
    if (process.env.NODE_ENV !== "production") {
      console.log('[useYjsEditor] Connected successfully');
    }
    
    return () => {
      if (process.env.NODE_ENV !== "production") {
        console.log('[useYjsEditor] Disconnecting editor');
      }
      YjsEditor.disconnect(editor as any);
    };
  }, [editor, sharedRoot, docId]);

  const providerRef = React.useRef<IndexeddbPersistence | null>(null);
  const [synced, setSynced] = React.useState(!effectiveEnabled);

  React.useEffect(() => {
    if (!effectiveEnabled || !docId || !ydoc || !sharedRoot || !editor) {
      providerRef.current = null;
      setSynced(!effectiveEnabled);
      return;
    }

    const key = `${APP_NAMESPACE}:doc:${docId}`;
    
    if (process.env.NODE_ENV !== "production") {
      console.log('[useYjsEditor] Creating IndexedDB provider', { key, docId });
    }
    
    const provider = new IndexeddbPersistence(key, ydoc);
    providerRef.current = provider;
    setSynced(false);

    const handleSynced = async () => {
      try {
        if (sharedRoot.length === 0 && getLegacyJson) {
          const legacy = await getLegacyJson();
          if (legacy && legacy.length > 0) {
            await seedJsonIntoYDocIfEmpty(editor as any, sharedRoot, legacy);
            if (process.env.NODE_ENV !== "production") {
              console.info("[useYjsEditor] seeded legacy JSON into Y.Doc", {
                docId,
              });
            }
          }
        }
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.error("[useYjsEditor] seed legacy JSON failed", error);
        }
      } finally {
        setSynced(true);
      }
    };

    provider
      .whenSynced()
      .then(handleSynced)
      .catch((error) => {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[useYjsEditor] IndexedDB sync failed", error);
        }
        setSynced(true);
      });

    return () => {
      providerRef.current = null;
      try {
        provider.destroy();
      } catch {
        // ignore
      }
      ydoc.destroy();
    };
  }, [docId, editor, effectiveEnabled, getLegacyJson, sharedRoot, ydoc]);

  return {
    editor,
    ydoc,
    provider: providerRef.current,
    status: { synced },
  };
}
