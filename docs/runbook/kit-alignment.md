# Kit 对齐与差异追踪

> 目标：一次性掌握当前各 Kit 与 plate-playground-template 的一致性程度，以及我们保留的自定义差异，方便在模板升级或裁剪时对照执行。

## 1. 对齐现状总览

| 分组 | Kit/能力 | 与官方模板的一致性 | 自定义差异 | 下一步检查点 |
| --- | --- | --- | --- | --- |
| Core | `BasicBlocksKit` | ✅ 已对齐 | — | 关注 break rules/toolbar 需求 |
| Core | `BasicMarksKit` | ✅ 已对齐 | — | — |
| Markdown | `MarkdownKit` | ✅ 已对齐 | — | remark 配置保持同步 |
| Markdown | `AutoformatKit` | ✅ 已对齐 | — | — |
| Markdown | `ListKit` | ⚠️ 部分对齐 | 使用 `IndentKit + BlockList`，保留 Slash 行为调整 | 升级官方后复核列表缩进逻辑 |
| Markdown | `CodeBlockKit` | ⚠️ 部分对齐 | 同步官方 UI + 快捷键，但保留我们的语言选择器 UX | 观察 lowlight 升级影响 |
| Markdown | `LinkKit` | ⚠️ 部分对齐 | 引入 `sanitizeHref` + 自定义浮层 | 新增/裁剪链接逻辑时同步更新 sanitizer/doc |
| Markdown | `TableKit` | ⚠️ 部分对齐 | 使用官方 UI，额外增加表格工具栏体验 | 关注表格拖拽兼容性 |
| Markdown | `MediaKit` | ✅ 已对齐 | — | 媒体 UI 升级时同步 shadcn 资源 |
| Markdown | `MathKit` | ✅ 已对齐 | — | — |
| Markdown | `TocKit` | ✅ 已对齐 | — | — |
| System | `SlashKit` | ✅ 已对齐 | Slash 逻辑集中在 `components/editor/transforms.ts` | 新增指令记得补 transforms + 文档 |
| System | `IndentKit` | ✅ 已对齐 | — | — |
| System | `AIKit` | ✅ 已对齐 | API 指向 `/api/ai/command`，添加 `useChatChunk` 自定义处理 | 模型/传输策略变化时同步本表 |
| System | `CopilotKit` | ✅ 已对齐 | 控制上下文截取、错误兜底 | — |
| System | `DiscussionKit` | ✅ 已对齐 | 默认启用，挂载真实讨论上下文 | 评论体验依赖该 Kit，禁用前需确认流程 |
| System | `BlockSelectionKit` | ✅ 已对齐 | — | — |
| System | `CommentKit` | ✅ 已对齐 | — | — |
| System | `SuggestionKit` | ✅ 已对齐 | — | — |
| System | `DndKit` | ✅ 已对齐 | — | — |
| System | `FixedToolbarKit` | ✅ 已对齐 | **默认禁用**，通过设置面板开启 | 模板升级后复核默认项 |
| System | `FloatingToolbarKit` | ✅ 已对齐 | — | — |
| System | `BlockMenuKit` | ✅ 已对齐 | — | — |
| System | `BlockPlaceholderKit` | ✅ 已对齐 | — | — |

> 状态说明：✅ 与官方一致；⚠️ 部分对齐/存在定制；⭕ 未接入（表中不列）。新增或裁剪 Kit 后务必补充本表。

## 2. 自定义差异清单

| 分组 | 项目 | 官方默认行为 | 当前项目调整 | 备注 |
| --- | --- | --- | --- | --- |
| System | `FixedToolbarKit` | 默认启用固定工具栏 | **默认禁用**，由设置面板显式开启 | 减少与自定义布局冲突，保留 toolbar 入口 |
| System | `AIKit` | `AIChatPlugin` 连接 `/api/ai/chat`（mock） | 指向 `/api/ai/command`，`DefaultChatTransport` 合并自定义请求体，`useChatChunk` 增强流式插入/评论 | 与 DeepSeek/OpenAI 兼容 API 对齐 |
| System | `CopilotKit` | 序列化完整 block | 仅保留末尾 600 字符，上报错误时停止补全 | 降低上下文长度，避免 ghost text |
| System | `DiscussionKit` | 可选开启，Playground 提供示例数据 | 默认启用，挂载真实讨论上下文，配合 CommentKit 使用 | 评论面板依赖该 Kit |
| System | `SlashKit` 系列 | 官方行为 | Slash 指令逻辑集中在 `components/editor/transforms.ts`，保持自定义命令 | 新增命令记得更新 transforms 与此表 |
| Markdown | `LinkKit` | 默认 `isUrl` 判定较宽 | 引入 `lib/editor/sanitize.ts` 的 `isLikelyUrl` + `sanitizeHref`，在 `LinkKit` 中做最小规范化 | 任何链接策略变动需同步 sanitizer |

> 新增或回滚差异时，请更新此表，并在对应 Kit 文件添加注释指向本节。

## 3. 更新指引

1. **新增 / 裁剪插件时**：
   - 更新 `lib/editor/enabled-plugins.ts`，保持启用列表真源唯一。
   - 按照 [插件接入流程](./plugin-workflow.md) 接入，并在本页补充对齐状态与差异说明。
2. **模板升级前后**：
   - 逐项比对“自定义差异清单”，确认是否仍需保留。
   - 若官方已提供等价能力，记录回归情况并移除表中条目。
3. **文档维护约定**：
   - 本页为唯一的 Kit 对齐 & 差异来源，`kit-diff.md` 仅保留跳转指引。
   - Markdown 能力详细矩阵请参考 [`markdown-plugin-coverage.md`](./markdown-plugin-coverage.md)。
