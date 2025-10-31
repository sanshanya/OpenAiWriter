﻿# AI Writer Frontend - Iteration Roadmap

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

## Stage 5: 本地持久化基线巩固

> 目标：保持纯前端方案稳定可靠，为后续后端化迭代奠定基线。

- [X] `hooks/use-documents.tsx` + `lib/storage` Facade，IndexedDB 为主、localStorage 兜底。
- [X] `types/storage.ts`、`lib/storage/constants.ts` 建立类型/常量真源。
- [X] 文档整合：`docs/architecture/storage-overview.md` 汇总现状，历史方案归档至 `docs/archive/legacy-storage/`。

---

## Stage 6: 服务化与架构升级（规划中）

> 目标：把关键业务从前端抽离，形成 React 前端 + Rust 服务的现代架构，为桌面/Web 双线预留空间。

### 6.1 AI 服务化

- [ ] 将 `/api/ai/*` 核心逻辑迁移到独立服务（首版可用 Rust + SQLite/LibSQL），统一提示词、调用与日志。
- [ ] 前端仅保留 UI 与流式消费逻辑，SDK 对接后端的 SSE/WebSocket。
- [ ] 建立基础监控：提示词审计、响应时间、错误率。

### 6.2 权威存储后端化

- [ ] 以 SQLite/LibSQL 验证文档模型（documents / revisions / assets），后续可平滑迁移至 PostgreSQL。
- [ ] 设计 OCC 保存流程：前端提交 → 后端校验 → 数据落库 → 推送增量；冲突返回 block 级 diff。
- [ ] 提供 CLI / DevTool 便于调试版本、冲突、审计数据。
- [ ] 结合 block 级结构，预研 Yjs 等 CRDT 方案以支撑协同。

### 6.3 协同与产品形态探索

- [ ] 评估 Tauri 桌面化 vs Web 持续迭代的路线，确定主攻方向。
- [ ] 规划资产与附件的统一上传/转换/打包方案。

---

## Backlog & UI/UX

- [ ] 解决 Markdown / HTML 混合粘贴失败问题。
- [ ] 导入导出能力（Markdown/HTML/多媒体）与服务化阶段同步推进。
