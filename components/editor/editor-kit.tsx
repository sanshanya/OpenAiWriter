"use client";

import * as React from "react";

import { usePlateEditor } from "platejs/react";

import { useEditorSettings } from "@/components/editor/settings/editor-settings-provider";
import type { MyValue } from "@/types/plate-elements";

export function useEditorKit(initialValue: MyValue) {
  const { buildPlugins } = useEditorSettings();

  const plugins = React.useMemo(() => buildPlugins(), [buildPlugins]);

  const editorOptions = React.useMemo(
    () => ({
      plugins,
      value: initialValue,
    }),
    [plugins, initialValue],
  );

  const editor = usePlateEditor<MyValue>(
    editorOptions as never,
    [plugins, initialValue],
  );

  return { editor, plugins };
}
