# Kit 对齐追踪

> 目标：记录各类插件与 plate-playground-template 的一致性情况，便于后续“先拉齐，再按需瘦身”。

| 分组     | Kit                | 当前状态      | 备注/下一步                                              |
| -------- | ------------------ | ------------- | -------------------------------------------------------- |
| Core     | BasicBlocksKit     | ✅ 已对齐     | 继续关注 break rules/toolbar 需求                        |
| Core     | BasicMarksKit      | ✅ 已对齐     |                                                          |
| Markdown | MarkdownKit        | ✅ 已对齐     | remark 配置保持同步                                      |
| Markdown | AutoformatKit      | ✅ 已对齐     |                                                          |
| Markdown | ListKit            | ⚠️ 部分对齐 | 需使用官方 `IndentKit + BlockList`（本次已同步）       |
| Markdown | CodeBlockKit       | ⚠️ 部分对齐 | 官方含 UI + shortcuts（本次已同步）                      |
| Markdown | LinkKit            | ⚠️ 部分对齐 | 需要 `LinkElement + LinkFloatingToolbar`（本次已同步） |
| Markdown | TableKit           | ⚠️ 部分对齐 | 需绑定 table UI 组件（本次已同步）                       |
| Markdown | MediaKit           | ✅ 已对齐     | 使用官方媒体套件                                         |
| Markdown | MathKit            | ✅ 已对齐     |                                                          |
| Markdown | TocKit             | ✅ 已对齐     |                                                          |
| System   | SlashKit           | ✅ 已对齐     | `/` 命令逻辑在 `components/editor/transforms.ts`     |
| System   | IndentKit          | ✅ 已对齐     | 部分 Kit 复用，已迁移至单独文件                          |
| System   | AIKit              | ✅ 已对齐     | AI 核心功能                                              |
| System   | CopilotKit         | ✅ 已对齐     | AI 智能补全                                              |
| System   | BlockSelectionKit  | ✅ 已对齐     | 块选择                                                   |
| System   | CommentKit         | ✅ 已对齐     | 评论                                                     |
| System   | SuggestionKit      | ✅ 已对齐     | 建议                                                     |
| System   | DndKit             | ✅ 已对齐     | 拖拽                                                     |
| System   | FixedToolbarKit    | ✅ 已对齐     | 固定工具栏                                               |
| System   | FloatingToolbarKit | ✅ 已对齐     | 浮动工具栏                                               |
| System   | BlockMenuKit       | ✅ 已对齐     | 块菜单                                                   |

> 状态说明：✅ 已与官方一致；⚠️ 部分对齐/需继续维护；⭕ 未接入（暂不在表中）。完成一次对齐后请更新此表，以便团队了解当前基线。




# Kit 差异追踪（相对 Plate 官方模板）

记录相对于 `plate-playground-template` 的自定义调整，便于后续同步官方更新或回滚差异。

## 总览

| 分组     | 项目                | 官方默认行为                                      | 当前项目调整                                                                                                     | 备注                                           |
| -------- | ------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| System   | `FixedToolbarKit` | 默认启用固定工具栏                                | **默认禁用**，需在设置面板显式开启                                                                         | 减少与自定义布局冲突，避免占位空间影响         |
| System   | `AIKit`           | `AIChatPlugin` 连接 `/api/ai/chat`，默认 mock | 指向 `/api/ai/command`，使用 `DefaultChatTransport` 合并自定义请求体；`useChatChunk` 追加流式插入/评论逻辑 | 与 DeepSeek 流式 API 对齐，保留评论工具        |
| System   | `CopilotKit`      | 直接序列化当前 block                              | 序列化后截取最后 600 字符，`onError` 停止并记录错误                                                            | 降低上下文长度，避免残留 ghost text            |
| System   | `DiscussionKit`   | 可选开启，示例数据仅在 Playground 出现            | 默认启用并挂载真实评论讨论面板，提供用户/讨论上下文配合 Comment 插件                                             | 评论体验依赖 DiscussionKit，开启后方可弹出面板 |
| Markdown | `MarkdownKit`     | 与官方一致                                        | **保持一致**                                                                                               | 当前无差异，如有裁剪需在此登记                 |
| System   | `SlashKit` 等     | 与官方一致                                        | **保持一致**                                                                                               | 未作修改                                       |

> 若引入新差异（例如覆盖 `render`、调整快捷键或默认值），请在上表补充或更新备注，并同步通知文档维护者。

## 调整指南

1. **新增自定义行为**：在对应 Kit 入口（`components/editor/plugins/...-kit.tsx`）注释说明，并在表格补充“当前项目调整”描述。
2. **回归官方实现**：在 PR 中勾除该行，注明已恢复官方模板。
3. **模板升级时核对**：参考此表逐项确认差异是否仍需保留，或是否需要迁移至官方提供的新能力。

# Kit 差异追踪（相对 Plate 官方模板）

记录相对于 `plate-playground-template` 的自定义调整，便于后续同步官方更新或回滚差异。

## 总览

| 分组     | 项目                | 官方默认行为                                      | 当前项目调整                                                                                                     | 备注                                           |
| -------- | ------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| System   | `FixedToolbarKit` | 默认启用固定工具栏                                | **默认禁用**，需在设置面板显式开启                                                                         | 减少与自定义布局冲突，避免占位空间影响         |
| System   | `AIKit`           | `AIChatPlugin` 连接 `/api/ai/chat`，默认 mock | 指向 `/api/ai/command`，使用 `DefaultChatTransport` 合并自定义请求体；`useChatChunk` 追加流式插入/评论逻辑 | 与 DeepSeek 流式 API 对齐，保留评论工具        |
| System   | `CopilotKit`      | 直接序列化当前 block                              | 序列化后截取最后 600 字符，`onError` 停止并记录错误                                                            | 降低上下文长度，避免残留 ghost text            |
| System   | `DiscussionKit`   | 可选开启，示例数据仅在 Playground 出现            | 默认启用并挂载真实评论讨论面板，提供用户/讨论上下文配合 Comment 插件                                             | 评论体验依赖 DiscussionKit，开启后方可弹出面板 |
| Markdown | `MarkdownKit`     | 与官方一致                                        | **保持一致**                                                                                               | 当前无差异，如有裁剪需在此登记                 |
| System   | `SlashKit` 等     | 与官方一致                                        | **保持一致**                                                                                               | 未作修改                                       |

> 若引入新差异（例如覆盖 `render`、调整快捷键或默认值），请在上表补充或更新备注，并同步通知文档维护者。

## 调整指南

1. **新增自定义行为**：在对应 Kit 入口（`components/editor/plugins/...-kit.tsx`）注释说明，并在表格补充“当前项目调整”描述。
2. **回归官方实现**：在 PR 中勾除该行，注明已恢复官方模板。
3. **模板升级时核对**：参考此表逐项确认差异是否仍需保留，或是否需要迁移至官方提供的新能力。
