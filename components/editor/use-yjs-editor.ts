"use client";

import * as React from "react";
import * as Y from "yjs";
import { createPlateEditor, type AnyPluginConfig } from "platejs";
import { withTYjs, YjsEditor } from "@platejs/yjs";

import { useEditorSettings } from "@/components/editor/settings/editor-settings-provider";
import type { MyValue } from "@/types/plate-elements";
import { IndexeddbPersistence } from "@/lib/yjs/indexeddb-persistence";
import { seedJsonIntoYDocIfEmpty } from "@/lib/yjs/seed";

type UseYjsEditorOptions = {
  docId: string | null;
  enabled?: boolean;
  getLegacyJson?: () => Promise<MyValue | null>;
};

type UseYjsEditorResult = {
  editor: YjsEditor<MyValue> | null;
  ydoc: Y.Doc | null;
  fragment: Y.XmlFragment | null;
  whenSynced: Promise<void>;
};

export function useYjsEditor({
  docId,
  enabled = true,
  getLegacyJson,
}: UseYjsEditorOptions): UseYjsEditorResult {
  const { buildPlugins } = useEditorSettings();

  const plugins = React.useMemo<AnyPluginConfig[]>(
    () => buildPlugins() as AnyPluginConfig[],
    [buildPlugins],
  );

  const effectiveEnabled = Boolean(enabled && docId);

  const ydoc = React.useMemo(() => {
    if (!effectiveEnabled) return null;
    void docId;
    return new Y.Doc();
  }, [effectiveEnabled, docId]) as Y.Doc | null;

  const fragment = React.useMemo(() => {
    if (!ydoc) return null;
    return ydoc.getXmlFragment("content");
  }, [ydoc]);

  const editor = React.useMemo(() => {
    if (!fragment || !effectiveEnabled) return null;
    const base = createPlateEditor<MyValue>({
      plugins,
    });
    return withTYjs(base, fragment as unknown as Y.XmlText, {
      autoConnect: false,
    }) as YjsEditor<MyValue>;
  }, [effectiveEnabled, fragment, plugins]);

  const [whenSynced, setWhenSynced] = React.useState<Promise<void>>(
    Promise.resolve(),
  );

  React.useEffect(() => {
    if (!effectiveEnabled || !docId || !ydoc || !fragment) {
      setWhenSynced(Promise.resolve());
      return;
    }

    const provider = new IndexeddbPersistence(`openai-writer:doc:${docId}`, ydoc);

    const handleSynced = async () => {
      if (fragment.length === 0 && getLegacyJson) {
        try {
          const legacy = await getLegacyJson();
          if (legacy && legacy.length > 0) {
            await seedJsonIntoYDocIfEmpty(fragment, legacy, plugins);
          }
        } catch (error) {
          console.warn("[useYjsEditor] seed legacy JSON failed", error);
        }
      }
    };

    const syncPromise = provider
      .whenSynced()
      .then(handleSynced)
      .catch((error) => {
        console.warn("[useYjsEditor] IndexedDB sync failed", error);
      });
    setWhenSynced(syncPromise);

    return () => {
      provider.destroy();
      ydoc.destroy();
    };
  }, [docId, effectiveEnabled, fragment, getLegacyJson, plugins, ydoc]);

  React.useEffect(() => {
    if (!editor || !fragment || !effectiveEnabled) return;
    YjsEditor.connect(editor, fragment as unknown as Y.XmlText);
    return () => {
      YjsEditor.disconnect(editor, fragment as unknown as Y.XmlText);
    };
  }, [editor, effectiveEnabled, fragment]);

  return {
    editor,
    ydoc,
    fragment,
    whenSynced,
  };
}
