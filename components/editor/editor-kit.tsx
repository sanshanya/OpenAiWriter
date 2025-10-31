"use client";

import * as React from "react";

import type { AnyPluginConfig } from "platejs";
import { usePlateEditor } from "platejs/react";

import { useEditorSettings } from "@/components/editor/settings/editor-settings-provider";
import type { MyElement, MyText, MyValue } from "@/types/plate-elements";

export function useEditorKit(initialValue: MyValue) {
  const { buildPlugins } = useEditorSettings();

  const plugins = React.useMemo<AnyPluginConfig[]>(
    () => buildPlugins() as AnyPluginConfig[],
    [buildPlugins],
  );

  const editorOptions = React.useMemo(
    () => ({
      plugins,
      value: initialValue,
    }),
    [plugins, initialValue],
  );

  const editor = usePlateEditor<MyValue, MyElement, MyText>(
    editorOptions,
    [plugins, initialValue],
  );

  return { editor, plugins };
}
