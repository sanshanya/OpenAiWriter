"use client";

import { TocPlugin } from "@platejs/toc/react";

import { TocElement } from "@/components/ui/toc-node";

export const TocKit = [
  TocPlugin.configure({
    options: {
      // 如果需要粘附定位可启用 isScroll
      topOffset: 80,
    },
  }).withComponent(TocElement),
];
