# Kit 对齐追踪

> 目标：记录各类插件与 plate-playground-template 的一致性情况，便于后续“先拉齐，再按需瘦身”。

| 分组     | Kit                | 当前状态    | 备注/下一步                                            |
| -------- | ------------------ | ----------- | ------------------------------------------------------ |
| Core     | BasicBlocksKit     | ✅ 已对齐   | 继续关注 break rules/toolbar 需求                      |
| Core     | BasicMarksKit      | ✅ 已对齐   |                                                        |
| Markdown | MarkdownKit        | ✅ 已对齐   | remark 配置保持同步                                    |
| Markdown | AutoformatKit      | ✅ 已对齐   |                                                        |
| Markdown | ListKit            | ⚠️ 部分对齐 | 需使用官方 `IndentKit + BlockList`（本次已同步）       |
| Markdown | CodeBlockKit       | ⚠️ 部分对齐 | 官方含 UI + shortcuts（本次已同步）                    |
| Markdown | LinkKit            | ⚠️ 部分对齐 | 需要 `LinkElement + LinkFloatingToolbar`（本次已同步） |
| Markdown | TableKit           | ⚠️ 部分对齐 | 需绑定 table UI 组件（本次已同步）                     |
| Markdown | MediaKit           | ✅ 已对齐   | 使用官方媒体套件                                       |
| Markdown | MathKit            | ✅ 已对齐   |                                                        |
| Markdown | TocKit             | ✅ 已对齐   |                                                        |
| System   | SlashKit           | ✅ 已对齐   | `/` 命令逻辑在 `components/editor/transforms.ts`       |
| System   | IndentKit          | ✅ 已对齐   | 部分 Kit 复用，已迁移至单独文件                        |
| System   | AIKit              | ✅ 已对齐   | AI 核心功能                                            |
| System   | CopilotKit         | ✅ 已对齐   | AI 智能补全                                            |
| System   | BlockSelectionKit  | ✅ 已对齐   | 块选择                                                 |
| System   | CommentKit         | ✅ 已对齐   | 评论                                                   |
| System   | SuggestionKit      | ✅ 已对齐   | 建议                                                   |
| System   | DndKit             | ✅ 已对齐   | 拖拽                                                   |
| System   | FixedToolbarKit    | ✅ 已对齐   | 固定工具栏                                             |
| System   | FloatingToolbarKit | ✅ 已对齐   | 浮动工具栏                                             |
| System   | BlockMenuKit       | ✅ 已对齐   | 块菜单                                                 |

> 状态说明：✅ 已与官方一致；⚠️ 部分对齐/需继续维护；⭕ 未接入（暂不在表中）。完成一次对齐后请更新此表，以便团队了解当前基线。
