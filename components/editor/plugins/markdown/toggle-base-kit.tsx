import { BaseTogglePlugin } from "@platejs/toggle";

import { ToggleElementStatic } from "@/components/ui/editor/toggle-node-static";

export const BaseToggleKit = [
  BaseTogglePlugin.withComponent(ToggleElementStatic),
];
