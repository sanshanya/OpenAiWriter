import { BasicBlocksKit } from "./core/basic-blocks-kit";
import { BasicMarksKit } from "./core/basic-marks-kit";
import { AutoformatKit } from "./markdown/autoformat-kit";
import { CodeBlockKit } from "./markdown/code-block-kit";
import { LinkKit } from "./markdown/link-kit";
import { ListKit } from "./markdown/list-kit";
import { MarkdownKit } from "./markdown/markdown-kit";
import { MathKit } from "./markdown/math-kit";
import { MediaKit } from "./markdown/media-kit";
import { TableKit } from "./markdown/table-kit";
import { TocKit } from "./markdown/toc-kit";
import { SlashKit } from "./system/slash-kit";

// stage 4 add
import { AIKit } from "./ai/ai-kit";
import { CopilotKit } from "./ai/copilot-kit";
import { BlockSelectionKit } from "./system/block-selection-kit";
import { CommentKit } from "./system/comment-kit";
import { DiscussionKit } from "./system/discussion-kit";
import { SuggestionKit } from "./system/suggestion-kit";
import { DndKit } from "./system/dnd-kit";
import { FixedToolbarKit } from "./system/fixed-toolbar-kit";
import { FloatingToolbarKit } from "./system/floating-toolbar-kit";
import { BlockMenuKit } from "./system/block-menu-kit";

// stage 5 add
import { BlockPlaceholderKit } from "./system/block-placeholder-kit";
import { PLUGINS, type EnabledPluginKey } from "@/types/plate-elements";

type PluginCategory = "core" | "markdown" | "system";

type PluginKit = {
  id: EnabledPluginKey;
  label: string;
  description?: string;
  category: PluginCategory;
  optional?: boolean;
  enabledByDefault?: boolean;
  plugins: ReadonlyArray<unknown>;
};

const pluginKits: PluginKit[] = [
  {
    id: PLUGINS.basicBlocks,
    label: "基础块",
    description: "段落、标题、引用、分割线等核心块级节点。",
    category: "core",
    plugins: BasicBlocksKit,
  },
  {
    id: PLUGINS.basicMarks,
    label: "基础行内样式",
    description: "粗体、斜体、下划线、代码等基础 Mark。",
    category: "core",
    plugins: BasicMarksKit,
  },
  {
    id: PLUGINS.markdownParser,
    label: "Markdown 解析/序列化",
    description:
      "保持 Markdown ↔ Slate 的语义同步（含 GFM、Math、Mention、MDX）。",
    category: "markdown",
    optional: true,
    enabledByDefault: true,
    plugins: MarkdownKit,
  },
  {
    id: PLUGINS.markdownAutoformat,
    label: "Markdown 快捷输入",
    description: "根据 Markdown 前缀（##、**、> 等）自动转换为对应块或标记。",
    category: "markdown",
    optional: true,
    enabledByDefault: true,
    plugins: AutoformatKit,
  },
  {
    id: PLUGINS.markdownList,
    label: "列表",
    description: "无序/有序/任务列表 + Tab 缩进支持。",
    category: "markdown",
    optional: true,
    enabledByDefault: true,
    plugins: ListKit,
  },
  {
    id: PLUGINS.markdownCode,
    label: "代码块",
    description: "``` fenced code ``` + 语法高亮。",
    category: "markdown",
    optional: true,
    enabledByDefault: true,
    plugins: CodeBlockKit,
  },
  {
    id: PLUGINS.markdownLink,
    label: "链接",
    description: "解析/渲染 Markdown 链接，内建 URL 校验。",
    category: "markdown",
    optional: true,
    enabledByDefault: true,
    plugins: LinkKit,
  },
  {
    id: PLUGINS.markdownTable,
    label: "表格",
    description: "GFM 表格节点，支持单元格编辑与合并。",
    category: "markdown",
    optional: true,
    enabledByDefault: true,
    plugins: TableKit,
  },
  {
    id: PLUGINS.markdownMedia,
    label: "图片 / 嵌入",
    description: "支持 `![]()` 图片与基础嵌入，默认仅允许 URL 插入。",
    category: "markdown",
    optional: true,
    enabledByDefault: true,
    plugins: MediaKit,
  },
  {
    id: PLUGINS.markdownMath,
    label: "Math (LaTeX)",
    description: "解析 `$...$` / `$$...$$`，可在后续迭代中扩展 UI。",
    category: "markdown",
    optional: true,
    enabledByDefault: true,
    plugins: MathKit,
  },
  {
    id: PLUGINS.markdownToc,
    label: "目录（ToC）",
    description: "根据文档标题自动生成目录，并可配置滚动定位。",
    category: "markdown",
    optional: true,
    enabledByDefault: true,
    plugins: TocKit,
  },
  {
    id: PLUGINS.slash,
    label: "Slash 命令",
    description: "输入 `/` 呼出命令面板，便捷插入块/内联元素。",
    category: "system",
    optional: true,
    enabledByDefault: true,
    plugins: SlashKit,
  },
  {
    id: PLUGINS.aiCore,
    label: "AI Core",
    description: "核心 AI 功能，提供基础 AI 能力。",
    category: "system",
    optional: true,
    enabledByDefault: true,
    plugins: AIKit,
  },

  {
    id: PLUGINS.aiCopilot,
    label: "AI Copilot",
    description: "AI 智能补全功能，提供内联建议。",
    category: "system",
    optional: true,
    enabledByDefault: true,
    plugins: CopilotKit,
  },
  {
    id: PLUGINS.blockSelection,
    label: "Block Selection",
    description: "块选择功能。",
    category: "system",
    optional: true,
    enabledByDefault: true,
    plugins: BlockSelectionKit,
  },
  {
    id: PLUGINS.comment,
    label: "Comment",
    description: "评论功能。",
    category: "system",
    optional: true,
    enabledByDefault: true,
    plugins: CommentKit,
  },
  {
    id: PLUGINS.discussion,
    label: "Discussion Panel",
    description: "为评论提供讨论面板与用户上下文。",
    category: "system",
    optional: true,
    enabledByDefault: true,
    plugins: DiscussionKit,
  },
  {
    id: PLUGINS.suggestion,
    label: "Suggestion",
    description: "建议功能。",
    category: "system",
    optional: true,
    enabledByDefault: true,
    plugins: SuggestionKit,
  },
  {
    id: PLUGINS.dnd,
    label: "Drag & Drop",
    description: "Drag and drop blocks.",
    category: "system",
    optional: true,
    enabledByDefault: true,
    plugins: DndKit,
  },
  {
    id: PLUGINS.fixedToolbar,
    label: "Fixed Toolbar",
    description: "固定工具栏。",
    category: "system",
    optional: true,
    enabledByDefault: false,
    plugins: FixedToolbarKit,
  },
  {
    id: PLUGINS.floatingToolbar,
    label: "Floating Toolbar",
    description: "浮动工具栏。",
    category: "system",
    optional: true,
    enabledByDefault: true,
    plugins: FloatingToolbarKit,
  },
  {
    id: PLUGINS.blockMenu,
    label: "Block Menu",
    description: "块菜单。",
    category: "system",
    optional: true,
    enabledByDefault: true,
    plugins: BlockMenuKit,
  },
  {
    id: PLUGINS.blockPlaceholder,
    label: "Block Placeholder",
    description: "块提示",
    category: "system",
    optional: true,
    enabledByDefault: true,
    plugins: BlockPlaceholderKit,
  }
];

export type OptionalPluginGroup = Omit<PluginKit, "plugins"> & {
  plugins: PluginKit["plugins"];
};

export const optionalPluginGroups: OptionalPluginGroup[] = pluginKits.filter(
  (kit) => kit.optional,
);

const _exhaustivePluginsCheck = (arr: EnabledPluginKey[]) => arr;

export const defaultEnabledOptionalPluginIds: EnabledPluginKey[] =
  optionalPluginGroups
    .filter((kit) => kit.enabledByDefault ?? true)
    .map((kit) => kit.id);

export function buildEditorPlugins(
  enabledOptionalPluginIds: EnabledPluginKey[] = defaultEnabledOptionalPluginIds,
) {
  _exhaustivePluginsCheck(enabledOptionalPluginIds);
  const enabledOptionalIds = new Set(enabledOptionalPluginIds);

  return pluginKits.flatMap((kit) => {
    if (!kit.optional) {
      return kit.plugins;
    }
    return enabledOptionalIds.has(kit.id) ? kit.plugins : [];
  });
}

export const BasicNodesKit = buildEditorPlugins();

// 只读/SSR 用的 base kit（名称以 BaseBasic* 开头）
export { BaseBasicBlocksKit } from "./core/basic-blocks-base-kit";
export { BaseBasicMarksKit } from "./core/basic-marks-base-kit";
export { BaseMediaKit } from "./markdown/media-base-kit";
export { BaseTocKit } from "./markdown/toc-base-kit";
