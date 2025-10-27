# Kit 差异追踪（相对 Plate 官方模板）

记录相对于 `plate-playground-template` 的自定义调整，便于后续同步官方更新或回滚差异。

## 总览

| 分组 | 项目 | 官方默认行为 | 当前项目调整 | 备注 |
| --- | --- | --- | --- | --- |
| System | `FixedToolbarKit` | 默认启用固定工具栏 | **默认禁用**，需在设置面板显式开启 | 减少与自定义布局冲突，避免占位空间影响 |
| System | `AIKit` | `AIChatPlugin` 连接 `/api/ai/chat`，默认 mock | 指向 `/api/ai/command`，使用 `DefaultChatTransport` 合并自定义请求体；`useChatChunk` 追加流式插入/评论逻辑 | 与 DeepSeek 流式 API 对齐，保留评论工具 |
| System | `CopilotKit` | 直接序列化当前 block | 序列化后截取最后 600 字符，`onError` 停止并记录错误 | 降低上下文长度，避免残留 ghost text |
| System | `DiscussionKit` | 可选开启，示例数据仅在 Playground 出现 | 默认启用并挂载真实评论讨论面板，提供用户/讨论上下文配合 Comment 插件 | 评论体验依赖 DiscussionKit，开启后方可弹出面板 |
| Markdown | `MarkdownKit` | 与官方一致 | **保持一致** | 当前无差异，如有裁剪需在此登记 |
| System | `SlashKit` 等 | 与官方一致 | **保持一致** | 未作修改 |

> 若引入新差异（例如覆盖 `render`、调整快捷键或默认值），请在上表补充或更新备注，并同步通知文档维护者。

## 调整指南

1. **新增自定义行为**：在对应 Kit 入口（`components/editor/plugins/...-kit.tsx`）注释说明，并在表格补充“当前项目调整”描述。
2. **回归官方实现**：在 PR 中勾除该行，注明已恢复官方模板。
3. **模板升级时核对**：参考此表逐项确认差异是否仍需保留，或是否需要迁移至官方提供的新能力。
