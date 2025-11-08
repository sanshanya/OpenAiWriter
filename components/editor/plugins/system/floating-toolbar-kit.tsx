"use client";

import { createPlatePlugin } from "platejs/react";

import { FloatingToolbar } from "@/components/ui/editor/floating-toolbar";
import { FloatingToolbarButtons } from "@/components/ui/editor/floating-toolbar-buttons";

export const FloatingToolbarKit = [
  createPlatePlugin({
    key: "floating-toolbar",
    render: {
      afterEditable: () => (
        <FloatingToolbar>
          <FloatingToolbarButtons />
        </FloatingToolbar>
      ),
    },
  }),
];
