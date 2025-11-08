"use client";

import { CursorOverlayPlugin } from "@platejs/selection/react";

import { CursorOverlay } from "@/components/ui/editor/cursor-overlay";

export const CursorOverlayKit = [
  CursorOverlayPlugin.configure({
    render: {
      afterEditable: () => <CursorOverlay />,
    },
  }),
];
