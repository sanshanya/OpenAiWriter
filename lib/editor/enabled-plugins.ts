export const enabledPluginKeys = [
  "core-blocks",
  "core-marks",
  "markdown-parser",
  "markdown-autoformat",
  "markdown-list",
  "markdown-code",
  "markdown-link",
  "markdown-table",
  "markdown-media",
  "markdown-math",
  "markdown-toc",
  "slash",
  "ai-core",
  "ai-copilot",
  "block-selection",
  "comment",
  "discussion",
  "suggestion",
  "dnd",
  "fixed-toolbar",
  "floating-toolbar",
  "block-menu",
  "block-placeholder",
] as const;

export type EnabledPluginKey = (typeof enabledPluginKeys)[number];

