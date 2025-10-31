"use client";

import * as React from "react";

import {
  buildEditorPlugins,
  defaultEnabledOptionalPluginIds,
  optionalPluginGroups,
  type OptionalPluginGroup,
} from "@/components/editor/plugins";
import type { EnabledPluginKey } from "@/types/plate-elements";

type EditorSettingsContextValue = {
  enabledOptionalPluginIds: EnabledPluginKey[];
  toggleOptionalPlugin: (id: EnabledPluginKey) => void;
  isOptionalPluginEnabled: (id: EnabledPluginKey) => boolean;
  restoreDefaultOptionalPlugins: () => void;
  optionalPluginGroups: OptionalPluginGroup[];
  buildPlugins: (
    ids?: EnabledPluginKey[],
  ) => ReturnType<typeof buildEditorPlugins>;
};

const EditorSettingsContext =
  React.createContext<EditorSettingsContextValue | null>(null);

export function EditorSettingsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [enabledOptionalPluginIds, setEnabledOptionalPluginIds] =
    React.useState<EnabledPluginKey[]>(defaultEnabledOptionalPluginIds);

  const toggleOptionalPlugin = React.useCallback((id: EnabledPluginKey) => {
    setEnabledOptionalPluginIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      return [...prev, id];
    });
  }, []);

  const restoreDefaultOptionalPlugins = React.useCallback(() => {
    setEnabledOptionalPluginIds(defaultEnabledOptionalPluginIds);
  }, []);

  const isOptionalPluginEnabled = React.useCallback(
    (id: EnabledPluginKey) => enabledOptionalPluginIds.includes(id),
    [enabledOptionalPluginIds],
  );

  const buildPluginsWithState = React.useCallback(
    (ids?: EnabledPluginKey[]) =>
      buildEditorPlugins(ids ?? enabledOptionalPluginIds),
    [enabledOptionalPluginIds],
  );

  const value = React.useMemo<EditorSettingsContextValue>(
    () => ({
      enabledOptionalPluginIds,
      toggleOptionalPlugin,
      isOptionalPluginEnabled,
      restoreDefaultOptionalPlugins,
      optionalPluginGroups,
      buildPlugins: buildPluginsWithState,
    }),
    [
      enabledOptionalPluginIds,
      toggleOptionalPlugin,
      isOptionalPluginEnabled,
      restoreDefaultOptionalPlugins,
      buildPluginsWithState,
    ],
  );

  return (
    <EditorSettingsContext.Provider value={value}>
      {children}
    </EditorSettingsContext.Provider>
  );
}

export function useEditorSettings() {
  const context = React.useContext(EditorSettingsContext);
  if (!context) {
    throw new Error("useEditorSettings 必须在 EditorSettingsProvider 中使用。");
  }
  return context;
}
