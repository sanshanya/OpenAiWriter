"use client";

import { TextApi, type NodeEntry, type Range, type TElement, type TText } from "platejs";
import { createPlatePlugin, type PlateEditor } from "platejs/react";

import {
  computePreviewDecorations,
  stableKey,
  type PreviewInput,
} from "@/packages/plate-ai-adapter/src/suggestion-preview";

export type AiPreviewOptions = {
  activePreview: PreviewInput | null;
  docVersion: number;
};

export const AiPreviewPlugin = createPlatePlugin<"ai-preview", AiPreviewOptions>(() => {
  let memoKey = "";
  let memoDecorations: Map<string, Range[]> = new Map();

  return {
    key: "ai-preview",
    options: {
      activePreview: null,
      docVersion: 0,
    },
    decorate: ({ editor, plugin, entry }) => {
      const [node, path] = entry as NodeEntry<TElement | TText>;
      if (!TextApi.isText(node)) return [];

      const preview = editor.getOption(plugin, "activePreview");
      if (!preview) return [];

      const docVersion =
        editor.getOption(plugin, "docVersion") || preview.docVersion;

      const cacheKey = stableKey({
        docVersion,
        snapshot: preview.snapshot,
        replacement: preview.replacement,
      });

      if (cacheKey !== memoKey) {
        memoDecorations = computePreviewDecorations(editor, {
          ...preview,
          docVersion,
        });
        memoKey = cacheKey;
      }

      return memoDecorations.get(JSON.stringify(path)) ?? [];
    },
  };
});

export const AiPreviewKit = [AiPreviewPlugin];

export function setActivePreview(editor: PlateEditor, preview: PreviewInput | null) {
  editor.setOption(AiPreviewPlugin, "activePreview", preview);
}

export function clearActivePreview(editor: PlateEditor) {
  editor.setOption(AiPreviewPlugin, "activePreview", null);
}

export function setPreviewDocVersion(editor: PlateEditor, version: number) {
  editor.setOption(AiPreviewPlugin, "docVersion", version);
}
