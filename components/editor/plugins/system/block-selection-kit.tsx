"use client";

import { AIChatPlugin } from "@platejs/ai/react";
import { BlockSelectionPlugin } from "@platejs/selection/react";
import { getPluginTypes, isHotkey, KEYS, type TElement } from "platejs";
import type { PlateElementProps } from "platejs/react";
import type { SlateEditor } from "platejs";

import { BlockSelection } from "@/components/ui/editor/block-selection";

export const BlockSelectionKit = [
  BlockSelectionPlugin.configure(({ editor }) =>
    ({
      options: {
        enableContextMenu: true,
      isSelectable: (element: TElement) => {
        return !getPluginTypes(editor, [
          KEYS.column,
          KEYS.codeLine,
          KEYS.td,
        ]).includes(element.type);
      },
      onKeyDownSelecting: (editor: SlateEditor, e: KeyboardEvent) => {
        if (isHotkey("mod+j")(e)) {
          editor.getApi(AIChatPlugin).aiChat.show();
        }
      },
    },
    render: {
      belowRootNodes: (props: PlateElementProps) => {
        if (!props.attributes.className?.includes("slate-selectable"))
          return null;

        return <BlockSelection {...props} />;
      },
    },
    }) as never,
  ),
];
