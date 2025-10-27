"use client";

import * as React from "react";

import type { AnyPluginConfig, Value } from "platejs";
import { usePlateEditor } from "platejs/react";

import { useEditorSettings } from "@/components/editor/settings/editor-settings-provider";

export function useEditorKit(value: Value) {
  const { buildPlugins } = useEditorSettings();

  const plugins = React.useMemo<AnyPluginConfig[]>(
    () => buildPlugins() as AnyPluginConfig[],
    [buildPlugins],
  );

  const editor = usePlateEditor(
    {
      plugins,
      value,
    },
    [plugins],
  );

  return { editor, plugins };
}
