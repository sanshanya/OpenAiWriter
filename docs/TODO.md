# AI Writer Frontend - Iteration Roadmap

## Stage 1: Core Scaffolding & Basic AI Integration

This initial phase focused on establishing the project's core structure and integrating a foundational AI capability. Key achievements include:

- **Project Identity:** Adjusted `README.md` and `app/layout.tsx` to define the project as an "AI Writer Frontend."
- **AI Interaction MVP:** Implemented a basic AI panel UI and connected it to a simple backend API route (`/api/ai/helper/route.ts`) for initial text generation, proving out the end-to-end workflow.

## Stage 2: Configuration, UX, and Persistence

Building on the MVP, this stage enhanced the editor's flexibility and user experience:

- **Plugin Framework:** Refactored editor plugins into `core` and `optional` categories, managed via a new settings panel, allowing for a configurable user experience.
- **AI UX Refinement:** Improved the AI interaction loop with loading indicators, cancellation, retry logic, and result copying to provide clear user feedback.
- **Content Persistence:** Implemented local storage to save and restore editor content automatically, ensuring user work is not lost between sessions. A manual QA checklist was created to validate core interactions.

---

## Stage 3: WYSIWYG Markdown Integration

This stage focused on integrating a seamless, real-time Markdown editing experience. All planned features, including the installation and integration of Markdown plugins, dynamic plugin enable/disable management, and verification of the WYSIWYG experience, have been successfully completed. This includes the proper integration of Blockquote and Horizontal Rule plugins.

---

## Stage 4: Native AI Assistant (Copilot-style) Implementation

This stage transitions from a separate AI panel to a deeply integrated, contextual AI assistant within the editor，现已完成流式 Copilot、Command 与 Helper，并接入 DeepSeek/OpenAI 兼容模型。

### Preparation Phase: Environment Setup & Configuration

- [X] **Environment Variable Management**:
  - [X] Set `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`, and `DEEPSEEK_MODEL` in the created `.env.local` file.
- [X] **Dynamic AI Configuration**:
  - [X] Implemented logic in the created `lib/ai/config.ts` module to dynamically resolve the API key, base URL, and model ID, prioritizing environment variables. This completes a flexible configuration layer that allows overriding settings per request.

### Main Tasks

#### 1. Configure `CopilotKit` for Inline Suggestions

- [X] **`components/editor/plugins/ai/copilot-kit.tsx`**：
  - `/api/ai/copilot` 已接入真实流式补全，`getPrompt` 仅序列化当前 block 并截取最后 600 字符。
  - `onFinish` 调用 `api.copilot.setBlockSuggestion`，`onError` 会停止请求并记录错误，快捷键保持与官方一致。

#### 2. Configure `AIKit` for Chat and Commands

- [X] **`components/editor/plugins/ai/ai-kit.tsx`**：
  - `chatOptions.api` 指向 `/api/ai/command`，transport 会合并自定义 body。
  - `useChatChunk` 已串联流式插入、编辑模式替换以及评论工具。

#### 3. Wire up the Plugins in `plate-editor.tsx`

- [X] `CopilotKit` 与 `AIKit` 通过 `useEditorKit` 聚合进入插件数组，并由 `Ctrl+Space` 触发补全。

#### 4. Create and Verify AI API Routes

- [X] **`app/api/ai/copilot/route.ts`**：DeepSeek/OpenAI 兼容流式接口，处理上下文压缩与错误兜底。
- [X] **`app/api/ai/command/route.ts`**：基于 `createUIMessageStream`，支持工具选择、评论流式返回。
- [X] **`app/api/ai/helper/route.ts`**：AI 面板流式输出，按模式注入 system 提示。

#### 5. Test the Integration

- [X] **Bug:** “Ask AI Anything” 输入未触发翻译/生成，只发送 POST（已修复）
- [X] **DeepSeek JSON 优化（评论工具）**：增强 fallback prompt，并通过多轮 JSON 解析策略自动修复 DeepSeek 返回的半结构化内容。

### Architecture Refactoring

- [X] **`components/editor/editor-kit.tsx`**：已抽离插件装配与编辑器创建逻辑。
- [X] **`hooks/use-documents.tsx`**：新增文档上下文，统一管理多文档列表、激活文档与本地持久化。
- [X] **`hooks/use-editor-hotkeys.ts`**：已抽离补全快捷键绑定，便于后续扩展。
- [X] **`plate-editor.tsx` 精简**：通过 DocumentsProvider + Hooks 收敛持久化与快捷键逻辑，仅保留粘贴处理与渲染。

### 类型集中管理（新增）
- [ ] `types/plate-elements.ts`：整理当前项目启用插件的 Plate 节点/文本类型，作为类型真源，新增/裁剪插件时同步维护。

--- 

## Stage 5: 数据持久化与高级特性

> 目标：在保持前端流畅体验的同时，提供可靠的后端持久化与导入导出能力，为后续 AI 编排和多端协作打基础。

### 5.1 双层持久化基线
- [X] **本地草稿 Hook**：完成 `hooks/use-documents.tsx`，以 IndexedDB 优先、localStorage 兜底的方式管理多文档草稿。
- [ ] **远程权威存储**：设计 PostgreSQL 表结构（`documents` 存 Markdown、`document_blocks` 缓存 block JSON、`document_revisions` 记录版本、`document_assets` 记录资源、`document_ai_logs` 记录 AI 操作）。
- [ ] **保存流程**：前端提交编辑内容 → 后端校验版本 → 先写数据库 → 返回成功并广播更新；如版本冲突，返回需合并的块级 diff。

### 5.2 导入导出与附件
- [ ] **Markdown 导入/导出**：复用 Plate 序列化管线，导入时生成新版 Markdown 与 block 快照；导出支持单篇与批量。
- [ ] **HTML 导出**：基于只读渲染或服务端转换提供自包含 HTML 文件（含 CSS 引用）。
- [ ] **多媒体上传**：集成 UploadThing/S3；上传后写入 `document_assets`，正文仅存引用 URL，并在导出时可选择打包资源。

### 5.3 AI 编排迁移
- [ ] **后端编排服务**：将 `/api/ai/*` 的核心逻辑迁移到后端服务，负责调用模型、写库、记录日志。
- [ ] **Block 级并发**：AI 请求按 block 拆分（block id + 选区），支持并发处理、返回分批结果。
- [ ] **结果落库**：AI 生成的文本、评论、建议等先写数据库，再推送给前端（SSE/WebSocket）。

### 5.4 后续优化
- [ ] **版本与协同预研**：调研 block 级版本合并策略（哈希/CRDT），为多人协同奠定基础。
- [ ] **安全合规**：梳理 key 管理、日志脱敏及模型调用审计需求。
- [ ] **监控与重放**：为 AI 调用增加指标、错误日志，并保留重放数据以抽查质量。

---

## Future UI/UX Optimizations（略）
