import { KEYS } from "platejs";
import type { TElement, TText } from "platejs";

import { type EnabledPluginKey } from "@/lib/editor/enabled-plugins";

export { enabledPluginKeys } from "@/lib/editor/enabled-plugins";
export type { EnabledPluginKey } from "@/lib/editor/enabled-plugins";

/** ===== 常量真源 ===== */

export const ELEMENTS = {
  paragraph: KEYS.p,
  h1: KEYS.h1,
  h2: KEYS.h2,
  h3: KEYS.h3,
  h4: KEYS.h4,
  h5: KEYS.h5,
  h6: KEYS.h6,
  blockquote: KEYS.blockquote,
  hr: KEYS.hr,
  ul: KEYS.ul,
  ol: KEYS.ol,
  callout: KEYS.callout,
  codeBlock: KEYS.codeBlock,
  codeLine: KEYS.codeLine,
  link: KEYS.link,
  table: KEYS.table,
  tableRow: KEYS.tr,
  tableCell: KEYS.td,
  toc: KEYS.toc,
  toggle: KEYS.toggle,
  column: KEYS.column,
  mediaEmbed: KEYS.mediaEmbed,
  image: KEYS.img,
  video: KEYS.video,
  audio: KEYS.audio,
  file: KEYS.file,
  equation: KEYS.equation,
  inlineEquation: KEYS.inlineEquation,
  date: KEYS.date,
  excalidraw: KEYS.excalidraw,
  aiChat: KEYS.aiChat,
} as const;

export const MARKS = {
  bold: KEYS.bold,
  italic: KEYS.italic,
  underline: KEYS.underline,
  strikethrough: KEYS.strikethrough,
  code: KEYS.code,
  highlight: KEYS.highlight,
  kbd: KEYS.kbd,
  sub: KEYS.sub,
  sup: KEYS.sup,
  color: KEYS.color,
  backgroundColor: KEYS.backgroundColor,
  fontSize: KEYS.fontSize,
  comment: KEYS.comment,
  suggestion: KEYS.suggestion,
  ai: KEYS.ai,
} as const;

const pluginKey = <T extends EnabledPluginKey>(key: T) => key;

export const PLUGINS = {
  basicBlocks: pluginKey("core-blocks"),
  basicMarks: pluginKey("core-marks"),
  markdownParser: pluginKey("markdown-parser"),
  markdownAutoformat: pluginKey("markdown-autoformat"),
  markdownList: pluginKey("markdown-list"),
  markdownCode: pluginKey("markdown-code"),
  markdownLink: pluginKey("markdown-link"),
  markdownTable: pluginKey("markdown-table"),
  markdownMedia: pluginKey("markdown-media"),
  markdownMath: pluginKey("markdown-math"),
  markdownToc: pluginKey("markdown-toc"),
  slash: pluginKey("slash"),
  aiCore: pluginKey("ai-core"),
  aiCopilot: pluginKey("ai-copilot"),
  blockSelection: pluginKey("block-selection"),
  comment: pluginKey("comment"),
  discussion: pluginKey("discussion"),
  suggestion: pluginKey("suggestion"),
  dnd: pluginKey("dnd"),
  fixedToolbar: pluginKey("fixed-toolbar"),
  floatingToolbar: pluginKey("floating-toolbar"),
  blockMenu: pluginKey("block-menu"),
  blockPlaceholder: pluginKey("block-placeholder"),
} as const;

export type ElementKey = (typeof ELEMENTS)[keyof typeof ELEMENTS];
export type MarkKey = (typeof MARKS)[keyof typeof MARKS];
export const ALL_ELEMENT_KEYS = Object.values(ELEMENTS) as readonly ElementKey[];
export const ALL_MARK_KEYS = Object.values(MARKS) as readonly MarkKey[];

export const PLUGIN_ELEMENT_MAP: Record<EnabledPluginKey, readonly ElementKey[]> =
  {
    [PLUGINS.basicBlocks]: [
      ELEMENTS.paragraph,
      ELEMENTS.h1,
      ELEMENTS.h2,
      ELEMENTS.h3,
      ELEMENTS.h4,
      ELEMENTS.h5,
      ELEMENTS.h6,
      ELEMENTS.blockquote,
      ELEMENTS.hr,
    ],
    [PLUGINS.basicMarks]: [],
    [PLUGINS.markdownParser]: [],
    [PLUGINS.markdownAutoformat]: [],
    [PLUGINS.markdownList]: [ELEMENTS.ul, ELEMENTS.ol],
    [PLUGINS.markdownCode]: [ELEMENTS.codeBlock, ELEMENTS.codeLine],
    [PLUGINS.markdownLink]: [ELEMENTS.link],
    [PLUGINS.markdownTable]: [
      ELEMENTS.table,
      ELEMENTS.tableRow,
      ELEMENTS.tableCell,
    ],
    [PLUGINS.markdownMedia]: [
      ELEMENTS.image,
      ELEMENTS.video,
      ELEMENTS.audio,
      ELEMENTS.file,
      ELEMENTS.mediaEmbed,
    ],
    [PLUGINS.markdownMath]: [ELEMENTS.inlineEquation, ELEMENTS.equation],
    [PLUGINS.markdownToc]: [ELEMENTS.toc],
    [PLUGINS.slash]: [],
    [PLUGINS.aiCore]: [ELEMENTS.aiChat],
    [PLUGINS.aiCopilot]: [],
    [PLUGINS.blockSelection]: [],
    [PLUGINS.comment]: [],
    [PLUGINS.discussion]: [],
    [PLUGINS.suggestion]: [],
    [PLUGINS.dnd]: [],
    [PLUGINS.fixedToolbar]: [],
    [PLUGINS.floatingToolbar]: [],
    [PLUGINS.blockMenu]: [],
    [PLUGINS.blockPlaceholder]: [],
  } as const;

export const PLUGIN_MARK_MAP: Record<EnabledPluginKey, readonly MarkKey[]> = {
  [PLUGINS.basicBlocks]: [],
  [PLUGINS.basicMarks]: [
    MARKS.bold,
    MARKS.italic,
    MARKS.underline,
    MARKS.strikethrough,
    MARKS.code,
    MARKS.highlight,
    MARKS.kbd,
    MARKS.sub,
    MARKS.sup,
  ],
  [PLUGINS.markdownParser]: [MARKS.comment, MARKS.suggestion],
  [PLUGINS.markdownAutoformat]: [],
  [PLUGINS.markdownList]: [],
  [PLUGINS.markdownCode]: [],
  [PLUGINS.markdownLink]: [],
  [PLUGINS.markdownTable]: [],
  [PLUGINS.markdownMedia]: [],
  [PLUGINS.markdownMath]: [],
  [PLUGINS.markdownToc]: [],
  [PLUGINS.slash]: [],
  [PLUGINS.aiCore]: [MARKS.ai],
  [PLUGINS.aiCopilot]: [],
  [PLUGINS.blockSelection]: [],
  [PLUGINS.comment]: [MARKS.comment],
  [PLUGINS.discussion]: [],
  [PLUGINS.suggestion]: [MARKS.suggestion],
  [PLUGINS.dnd]: [],
  [PLUGINS.fixedToolbar]: [],
  [PLUGINS.floatingToolbar]: [],
  [PLUGINS.blockMenu]: [],
  [PLUGINS.blockPlaceholder]: [],
} as const;

/** ===== 结构真源：元素/文本接口 ===== */

export interface ParagraphElement extends TElement {
  type: typeof ELEMENTS.paragraph;
}

export interface H1Element extends TElement {
  type: typeof ELEMENTS.h1;
}

export interface H2Element extends TElement {
  type: typeof ELEMENTS.h2;
}

export interface H3Element extends TElement {
  type: typeof ELEMENTS.h3;
}

export interface H4Element extends TElement {
  type: typeof ELEMENTS.h4;
}

export interface H5Element extends TElement {
  type: typeof ELEMENTS.h5;
}

export interface H6Element extends TElement {
  type: typeof ELEMENTS.h6;
}

export interface BlockquoteElement extends TElement {
  type: typeof ELEMENTS.blockquote;
}

export interface HrElement extends TElement {
  type: typeof ELEMENTS.hr;
}

export interface UlElement extends TElement {
  type: typeof ELEMENTS.ul;
}

export interface OlElement extends TElement {
  type: typeof ELEMENTS.ol;
}

export interface CodeBlockElement extends TElement {
  type: typeof ELEMENTS.codeBlock;
  language?: string;
}

export interface CodeLineElement extends TElement {
  type: typeof ELEMENTS.codeLine;
}

export interface LinkElement extends TElement {
  type: typeof ELEMENTS.link;
  url: string;
}

export interface CalloutElement extends TElement {
  type: typeof ELEMENTS.callout;
  variant?: "info" | "warn" | "error" | "success";
}

export interface TableElement extends TElement {
  type: typeof ELEMENTS.table;
}

export interface TableRowElement extends TElement {
  type: typeof ELEMENTS.tableRow;
}

export interface TableCellElement extends TElement {
  type: typeof ELEMENTS.tableCell;
}

export interface TocElement extends TElement {
  type: typeof ELEMENTS.toc;
}

export interface ToggleElement extends TElement {
  type: typeof ELEMENTS.toggle;
}

export interface ColumnElement extends TElement {
  type: typeof ELEMENTS.column;
}

export interface MediaEmbedElement extends TElement {
  type: typeof ELEMENTS.mediaEmbed;
}

export interface ImageElement extends TElement {
  type: typeof ELEMENTS.image;
  url?: string;
}

export interface VideoElement extends TElement {
  type: typeof ELEMENTS.video;
  url?: string;
}

export interface AudioElement extends TElement {
  type: typeof ELEMENTS.audio;
  url?: string;
}

export interface FileElement extends TElement {
  type: typeof ELEMENTS.file;
  url?: string;
  name?: string;
}

export interface EquationElement extends TElement {
  type: typeof ELEMENTS.equation;
  tex: string;
}

export interface InlineEquationElement extends TElement {
  type: typeof ELEMENTS.inlineEquation;
  tex: string;
}

export interface DateElement extends TElement {
  type: typeof ELEMENTS.date;
}

export interface ExcalidrawElement extends TElement {
  type: typeof ELEMENTS.excalidraw;
}

export interface AIChatElement extends TElement {
  type: typeof ELEMENTS.aiChat;
}

export type MyElement =
  | ParagraphElement
  | H1Element
  | H2Element
  | H3Element
  | H4Element
  | H5Element
  | H6Element
  | BlockquoteElement
  | HrElement
  | UlElement
  | OlElement
  | CodeBlockElement
  | CodeLineElement
  | LinkElement
  | CalloutElement
  | TableElement
  | TableRowElement
  | TableCellElement
  | TocElement
  | ToggleElement
  | ColumnElement
  | MediaEmbedElement
  | ImageElement
  | VideoElement
  | AudioElement
  | FileElement
  | EquationElement
  | InlineEquationElement
  | DateElement
  | ExcalidrawElement
  | AIChatElement;

export type BaseText = TText & {
  [MARKS.bold]?: true;
  [MARKS.italic]?: true;
  [MARKS.underline]?: true;
  [MARKS.strikethrough]?: true;
  [MARKS.code]?: true;
  [MARKS.highlight]?: true;
  [MARKS.kbd]?: true;
  [MARKS.sub]?: true;
  [MARKS.sup]?: true;
  [MARKS.color]?: string;
  [MARKS.backgroundColor]?: string;
  [MARKS.fontSize]?: string;
  [MARKS.comment]?: boolean;
  [MARKS.suggestion]?: boolean;
  [MARKS.ai]?: true;
};

export type MyText = BaseText;

export type MyNode = MyElement | MyText;
export type MyValue = MyElement[];

/** ===== 工具：块/行内判定 & 守卫 ===== */

export type BlockElementKey =
  | typeof ELEMENTS.paragraph
  | typeof ELEMENTS.h1
  | typeof ELEMENTS.h2
  | typeof ELEMENTS.h3
  | typeof ELEMENTS.h4
  | typeof ELEMENTS.h5
  | typeof ELEMENTS.h6
  | typeof ELEMENTS.blockquote
  | typeof ELEMENTS.hr
  | typeof ELEMENTS.ul
  | typeof ELEMENTS.ol
  | typeof ELEMENTS.callout
  | typeof ELEMENTS.codeBlock
  | typeof ELEMENTS.codeLine
  | typeof ELEMENTS.table
  | typeof ELEMENTS.tableRow
  | typeof ELEMENTS.tableCell
  | typeof ELEMENTS.toc
  | typeof ELEMENTS.toggle
  | typeof ELEMENTS.column
  | typeof ELEMENTS.mediaEmbed
  | typeof ELEMENTS.image
  | typeof ELEMENTS.video
  | typeof ELEMENTS.audio
  | typeof ELEMENTS.file
  | typeof ELEMENTS.equation
  | typeof ELEMENTS.excalidraw
  | typeof ELEMENTS.aiChat;

export type InlineElementKey =
  | typeof ELEMENTS.link
  | typeof ELEMENTS.inlineEquation
  | typeof ELEMENTS.date;

const BLOCK_ELEMENT_KEYS = new Set<BlockElementKey>([
  ELEMENTS.paragraph,
  ELEMENTS.h1,
  ELEMENTS.h2,
  ELEMENTS.h3,
  ELEMENTS.h4,
  ELEMENTS.h5,
  ELEMENTS.h6,
  ELEMENTS.blockquote,
  ELEMENTS.hr,
  ELEMENTS.ul,
  ELEMENTS.ol,
  ELEMENTS.callout,
  ELEMENTS.codeBlock,
  ELEMENTS.codeLine,
  ELEMENTS.table,
  ELEMENTS.tableRow,
  ELEMENTS.tableCell,
  ELEMENTS.toc,
  ELEMENTS.toggle,
  ELEMENTS.column,
  ELEMENTS.mediaEmbed,
  ELEMENTS.image,
  ELEMENTS.video,
  ELEMENTS.audio,
  ELEMENTS.file,
  ELEMENTS.equation,
  ELEMENTS.excalidraw,
  ELEMENTS.aiChat,
]);

const INLINE_ELEMENT_KEYS = new Set<InlineElementKey>([
  ELEMENTS.link,
  ELEMENTS.inlineEquation,
  ELEMENTS.date,
]);

type AssertTrue<T extends true> = T;

export type BlockInlineNoOverlapCheck = AssertTrue<
  Extract<BlockElementKey, InlineElementKey> extends never ? true : false
>;
export type AllElementsClassifiedCheck = AssertTrue<
  Exclude<ElementKey, BlockElementKey | InlineElementKey> extends never
    ? true
    : false
>;
export type NoUnknownKeysCheck = AssertTrue<
  Exclude<BlockElementKey | InlineElementKey, ElementKey> extends never
    ? true
    : false
>;

export const isBlock = (key: ElementKey): key is BlockElementKey =>
  BLOCK_ELEMENT_KEYS.has(key as BlockElementKey);

export const isInline = (key: ElementKey): key is InlineElementKey =>
  INLINE_ELEMENT_KEYS.has(key as InlineElementKey);

export const isLinkElement = (element: TElement): element is LinkElement =>
  (element as LinkElement).type === ELEMENTS.link;

export const isTableElement = (element: TElement): element is TableElement =>
  (element as TableElement).type === ELEMENTS.table;
