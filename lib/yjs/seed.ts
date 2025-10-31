import * as Y from "yjs";
import { createPlateEditor, type AnyPluginConfig } from "platejs";
import { withTYjs, YjsEditor } from "@platejs/yjs";

import type { MyValue } from "@/types/plate-elements";
import { BasicNodesKit } from "@/components/editor/plugins";

export async function seedJsonIntoYDocIfEmpty(
  fragment: Y.XmlFragment,
  legacy: MyValue,
  plugins?: AnyPluginConfig[],
): Promise<boolean> {
  if (fragment.length > 0 || !legacy || legacy.length === 0) {
    return false;
  }

  const doc = fragment.doc;
  if (!doc) return false;

  const editor = withTYjs(
    createPlateEditor<MyValue>({
      plugins: plugins && plugins.length > 0 ? plugins : BasicNodesKit,
      value: [],
    }),
    fragment as unknown as Y.XmlText,
    { autoConnect: false },
  ) as YjsEditor<MyValue>;

  doc.transact(() => {
    YjsEditor.connect(editor, fragment as unknown as Y.XmlText);
    editor.children = legacy as unknown as typeof editor.children;
    editor.onChange();
    YjsEditor.disconnect(editor, fragment as unknown as Y.XmlText);
  });

  return true;
}
