"use client";

import * as React from "react";
import { Plate } from "platejs/react";

import { useYjsEditor } from "@/components/editor/use-yjs-editor";
import { useEditorHotkeys } from "@/hooks/use-editor-hotkeys";
import { useDocuments } from "@/hooks/use-documents";
import { useYDocMetaBridge } from "@/lib/yjs/use-ydoc-meta-bridge";
import { Editor, EditorContainer } from "@/components/ui/editor";
import type { MyValue } from "@/types/plate-elements";

export function PlateEditor() {
  const {
    activeDocumentId,
    activeMeta,
    isHydrated,
    getLegacyContentSnapshot,
  } = useDocuments();

  const ready = Boolean(isHydrated && activeDocumentId);

  const getLegacyJson = React.useCallback(() => {
    if (!ready || !activeDocumentId) return Promise.resolve<MyValue | null>(null);
    return getLegacyContentSnapshot(activeDocumentId);
  }, [activeDocumentId, getLegacyContentSnapshot, ready]);

  const { editor, ydoc, whenSynced } = useYjsEditor({
    docId: activeDocumentId ?? null,
    enabled: ready,
    getLegacyJson,
  });

  useEditorHotkeys(editor);
  useYDocMetaBridge(ready ? activeDocumentId : null, ydoc);

  const [isSynced, setSynced] = React.useState(!ready);

  React.useEffect(() => {
    if (!ready) {
      setSynced(false);
      return;
    }
    setSynced(false);
    let cancelled = false;
    whenSynced
      .finally(() => {
        if (!cancelled) {
          setSynced(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSynced(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeDocumentId, ready, whenSynced]);

  const showLoading =
    !ready || !editor || !ydoc || !isSynced || !activeDocumentId;

  if (showLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <span className="rounded-full bg-neutral-900/80 px-3 py-1 text-xs text-neutral-50 shadow">
          正在加载文档…
        </span>
      </div>
    );
  }

  return (
    <Plate key={activeDocumentId} editor={editor}>
      <EditorContainer>
        <Editor
          variant="fullWidth"
          className="w-full !max-w-none px-0"
          placeholder={
            activeMeta?.title
              ? `正在编辑「${activeMeta.title || "未命名文档"}」…`
              : "输入文本，按空格启用 AI，按 '/' 启用指令…"
          }
        />
      </EditorContainer>
    </Plate>
  );
}
