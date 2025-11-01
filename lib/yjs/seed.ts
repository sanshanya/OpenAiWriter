import * as Y from "yjs";

import type { MyValue } from "@/types/plate-elements";

/**
 * 将 legacy JSON 内容 seed 到空的 Y.Doc
 *
 * 使用 Yjs transact 直接写入
 */
export async function seedJsonIntoYDocIfEmpty(
  editor: any,
  sharedRoot: Y.XmlText,
  legacy: MyValue,
): Promise<boolean> {
  if (!editor || sharedRoot.length > 0 || !legacy || legacy.length === 0) {
    return false;
  }

  const doc = sharedRoot.doc;
  if (!doc) return false;

  try {
    // 直接通过 editor.children 赋值，让 withYjs 同步到 Y.Doc
    doc.transact(() => {
      editor.children = legacy;
      if (typeof editor.onChange === 'function') {
        editor.onChange();
      }
    });

    return true;
  } catch (error) {
    console.error('[seedJsonIntoYDocIfEmpty] Failed to seed', error);
    return false;
  }
}
