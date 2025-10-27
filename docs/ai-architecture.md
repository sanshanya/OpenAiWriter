# AI 能力架构速览（Stage 4 基线）

本页记录项目当前（Stage 4 完成后）的 AI 集成方案，作为后续演进与官方模板对齐的基准。

## 1. 服务端路由与模型接入

| 路径 | 职责 | 模型调用 | 备注 |
| --- | --- | --- | --- |
| `app/api/ai/helper/route.ts` | AI 面板（草稿/润色/大纲）统一入口，输出纯文本流 | `streamText(openai.chat(model))` | 按模式注入额外 system 提示，支持 maxTokens/temperature/自定义 key 覆写 |
| `app/api/ai/command/route.ts` | AI Chat / 命令流（生成、编辑、评论） | `createUIMessageStream` + `openai.chat(model)` | 启用 tool 选择、评论工具流式返回，统一读取 DeepSeek/OpenAI 兼容配置；针对 DeepSeek 追加 JSON Schema ↔ 降级容错 |
| `app/api/ai/copilot/route.ts` | Copilot 内联补全 | `streamText(openai.chat(model))` | 结构化 system 提示，限制 tokens 并走 `stripMarkdown` 去噪 |

所有路由均通过 `lib/ai/config.ts` 的 `resolve*` 方法解析 `DEEPSEEK_*` 环境变量，可被请求体覆写，默认限制 maxTokens 以降低延迟。

## 2. 前端集成与流式处理

### 2.1 AI 面板（`components/ai/ai-panel.tsx`）
- 使用原生 `fetch` + `ReadableStream` 逐块读取 helper 路由，实时写入 `output`。
- `AbortController` 支持取消；错误优先读取响应 JSON 的 `error` 字段。
- UI 在流式期间保留 Loading 提示，同时展示已收到的内容。

### 2.2 AI Chat / Command（`components/editor/plugins/ai/ai-kit.tsx`）
- 通过 `AIChatPlugin` + `useChatChunk` 处理 `streamText` 分片：
  - `mode === "insert"` 时使用 `streamInsertChunk` 写入 AI 块，并保持流式滚动。
  - `toolName === "edit"` 时用 `applyAISuggestions` 替换选区。
  - 评论工具结合 `aiCommentToRange` 将 AI 返回的评论映射到 Block selection。
- Transport 使用 `DefaultChatTransport`，fetch 时追加 `chatOptions.body` 中的自定义参数。

### 2.3 Copilot（`components/editor/plugins/ai/copilot-kit.tsx`）
- `CopilotPlugin.configure` 指向 `/api/ai/copilot`，`getPrompt` 只序列化当前 block 并截取最后 600 字符。
- `onFinish` 拿到 completion 后调用 `api.copilot.setBlockSuggestion`；`onError` 停止请求避免残留 ghost text。
- 默认触发快捷键 `Ctrl+Space` 由 `hooks/use-editor-hotkeys.ts` 统一注册，保持编辑器壳层简洁。

## 3. 编辑器装配与复用

- 新建 `components/editor/editor-kit.tsx` 暴露 `useEditorKit(initialValue)`，集中生成插件配置并创建编辑器实例。
- 通过 `hooks/use-documents.tsx` 提供的 `DocumentsProvider` 管理多文档列表与活跃文档；`plate-editor.tsx` 仅负责渲染、粘贴处理与变更通知，快捷键逻辑继续由 `hooks/use-editor-hotkeys.ts` 管理。
- Fixed Toolbar 默认禁用，需通过设置面板启用（避免与自定义布局冲突）。

## 4. 流式集成注意事项

1. **后端**：优先使用 `openai.chat(model)`，避免误调用 `/v1/responses`；所有流式接口返回 `toTextStreamResponse()`，取消时捕获 `AbortError`。评论工具会先尝试 JSON Schema 流式解析，若模型不支持或响应异常，降级为纯文本解析并输出日志。
2. **前端**：读取 `ReadableStream` 时用 `TextDecoder` 保持 `stream: true`，并处理 `decoder.decode()` 的余量；取消需 `reader.cancel()` 或依赖 abort signal。
3. **Markdown 片段**：Copilot 和 Command 在流式写入时都使用 `stripMarkdown` 或 `markdownJoinerTransform`，防止将原生 Markdown 原样落入编辑器。
4. **错误处理**：统一记录 `console.error`，前端向用户展示友好提示，同时尽量保持 `output` 内容不清空。

## 5. 后续工作指引

- 持续观察 `use-documents.tsx` 的 IndexedDB/LocalStorage 回退日志，评估是否需要额外容量提示或同步机制。
- 为 `/api/ai/*` 路由补充最小单测或日志采集，便于排查流式超时问题。
- 关注 DeepSeek 是否开放 `json_schema` 模式，一旦支持即可移除自定义解析兜底。
- 若对齐官方模板更新，务必同步更新 `docs/kit-diff.md` 中的差异记录。
