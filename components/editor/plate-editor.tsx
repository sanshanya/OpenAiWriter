"use client";

import * as React from "react";
import { Plate } from "platejs/react";

import { useEditorKit } from "@/components/editor/editor-kit";
import { useEditorHotkeys } from "@/hooks/use-editor-hotkeys";
import { Editor, EditorContainer } from "@/components/ui/editor/editor";
import { useDocuments } from "@/hooks/use-documents";
import type { MyValue } from "@/types/plate-elements";
import { cloneValue, type DocumentRecord } from "@/types/storage";

/**
 * 单文档编辑实例
 * - 使用 docId 绑定 onChange，消灭“切换串台”竞态
 * - key 用 docId，强制切换时完整重挂载
 */
const EditorInstance = React.memo(
  ({
    doc,
    onContentChange,
  }: {
    doc: DocumentRecord;
    onContentChange: (docId: string, value: MyValue) => void;
  }) => {
    const contentVersion = doc.contentVersion ?? 0;
    const initialValue = React.useMemo(
      () => cloneValue<MyValue>(doc.initialContent),
      [doc.initialContent],
    );

    const { editor } = useEditorKit(initialValue);
    useEditorHotkeys(editor);

    const handleChange = React.useCallback(
      ({ value }: { value: MyValue }) => {
        onContentChange(doc.id, value);
      },
      [doc.id, onContentChange],
    );

    return (
      <Plate<MyValue>
        key={`${doc.id}:${contentVersion}`}
        editor={editor}
        onChange={handleChange}
      >
        <EditorContainer>
          <Editor
            variant="fullWidth"
            className="w-full !max-w-none px-0"
            placeholder="输入文本，按空格启用 AI，按 '/' 启用指令…"
          />
        </EditorContainer>
      </Plate>
    );
  },
);
EditorInstance.displayName = "EditorInstance";

export function PlateEditor() {
  const { activeDocument, updateDocumentContent } = useDocuments();

  if (!activeDocument) {
    return (
      <div className="flex h-96 items-center justify-center">
        <span className="rounded-full bg-neutral-900/80 px-3 py-1 text-xs text-neutral-50 shadow">
          正在加载文档…
        </span>
      </div>
    );
  }

  const isReady =
    Array.isArray(activeDocument.content) &&
    ((activeDocument.contentVersion ?? 0) > 0 ||
      activeDocument.content.length > 0);

  if (!isReady) {
    return (
      <div className="flex h-96 items-center justify-center">
        <span className="rounded-full bg-neutral-900/80 px-3 py-1 text-xs text-neutral-50 shadow">
          正在加载文档…
        </span>
      </div>
    );
  }

  return (
    <EditorInstance
      doc={activeDocument}
      onContentChange={updateDocumentContent}
    />
  );
}
