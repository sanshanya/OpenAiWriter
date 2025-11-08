import { BaseMentionPlugin } from "@platejs/mention";

import { MentionElementStatic } from "@/components/ui/editor/mention-node-static";

export const BaseMentionKit = [
  BaseMentionPlugin.withComponent(MentionElementStatic),
];
