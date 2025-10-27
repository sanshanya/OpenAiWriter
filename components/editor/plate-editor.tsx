"use client";

import * as React from "react";
import { KEYS, type Value } from "platejs";
import { MarkdownPlugin } from "@platejs/markdown";
import { Plate } from "platejs/react";

import { useEditorKit } from "@/components/editor/editor-kit";
import { useEditorHotkeys } from "@/hooks/use-editor-hotkeys";
import { Editor, EditorContainer } from "@/components/ui/editor";
import { useDocuments } from "@/hooks/use-documents";
import { INITIAL_DOCUMENT_CONTENT } from "@/components/editor/initial-value";


/**
 * This component is the core of the editor.
 * It is memoized and will only re-render when the active document is ready.
 * A key based on the document ID is used to force a full re-mount on document switch.
 */
const EditorInstance = React.memo(({ document, onContentChange }: { document: any, onContentChange: (value: Value) => void }) => {
  const initialValue = React.useMemo(() => document.content, [document.content]);
  const { editor } = useEditorKit(initialValue);
  useEditorHotkeys(editor);

  return (
    <Plate
      editor={editor}
      onChange={({ value }) => onContentChange(value)}
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
});
EditorInstance.displayName = 'EditorInstance';


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

  return (
    <EditorInstance
      key={activeDocument.id}
      document={activeDocument}
      onContentChange={updateDocumentContent}
    />
  );
}
