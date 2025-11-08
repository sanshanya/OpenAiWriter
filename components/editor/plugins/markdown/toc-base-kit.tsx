import { BaseTocPlugin } from "@platejs/toc";

import { TocElementStatic } from "@/components/ui/editor/toc-node-static";

export const BaseTocKit = [BaseTocPlugin.withComponent(TocElementStatic)];
