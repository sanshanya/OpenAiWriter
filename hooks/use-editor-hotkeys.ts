"use client";

import { CopilotPlugin } from "@platejs/ai/react";
import type { PlateEditor } from "platejs/react";
import { useHotkeys } from "platejs/react";

export function useEditorHotkeys(editor: PlateEditor | null) {
  useHotkeys(
    "ctrl+space",
    (event) => {
      event.preventDefault();
      editor?.getApi(CopilotPlugin).copilot.triggerSuggestion();
    },
    { enableOnFormTags: true },
    [editor],
  );
}
