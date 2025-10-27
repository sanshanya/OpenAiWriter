# 项目概述

AI Writer UI（暂定名）是一套基于 Next.js App Router 与 Plate 生态构建的 AI 写作前端。目标是在可控的插件体系下，逐步搭载生成、润色、批注等能力，并保持"最小可行产品 + 按需扩展"的节奏。

- 前端框架：Next.js 16 + React 19
- 富文本内核：Plate（`@platejs/basic-nodes` + 自定义 UI 映射）
- UI 体系：Tailwind 新工作流 + shadcn 风格组件（自建）

## 快速启动

```bash
pnpm install
pnpm dev
```


访问 `http://localhost:3000`，默认主页即编辑器工作台。

## 目录指引

- `app/page.tsx`：三栏布局的首页，承载编辑器与左右侧功能面板。
- `app/api/ai/helper/route.ts`：AI Helper 服务端入口，提供真实流式生成/润色能力。
- `components/editor/plugins/*`：插件注册中心，包含核心/可选插件拆分与构建函数。
- `components/editor/plate-editor.tsx`：编辑器入口（渲染与本地持久化逻辑）。
- `components/editor/settings/*`：可选插件开关与左侧设置面板。
- `components/ai/ai-panel.tsx`：右侧 AI 工作台（生成 / 取消 / 重试 / 复制）。
- `components/ui/*`：Plate 节点与 marks 对应的渲染组件。
- `lib/utils.ts`：基础工具函数。
- `docs/editor-architecture.md`：编辑器架构概览。
- `docs/markdown-plugin-coverage.md`：Markdown 插件覆盖说明。
- `docs/kit-diff.md`：相对官方模板的 Kit 差异记录。
- `docs/manual-qa-checklist.md`：基础交互手动测试清单（第二阶段验证用）。
- `docs/ai-architecture.md`：AI 能力架构速览（Stage 4 基线）。
- `TODO.md`：阶段推进计划（迭代优先级）。
- 本地存储：文档内容缓存到 `localStorage` 的 `aiwriter:documents:active` 键，编辑时自动更新。

## 开发守则

1. **插件唯一真源**：在 `components/editor/plugins` 内统一定义插件数组，再映射到 UI 层，避免散落配置；左侧设置面板区块预留可选插件开关（当前全部启用，后续扩展时再开放）。
2. **最小化改动**：每次迭代限定范围，必要时写明测试样例（参考 `TODO.md`）。
3. **证据优先**：遇到实现疑问，优先查阅 Plate [官方文档](https://platejs.org/docs) 与 [plate-playground-template](https://github.com/udecode/plate-playground-template) 仓库。

## 下一步

围绕 `TODO.md` 中的阶段任务推进，阶段完成后进行复盘与下一步确认。

## AI 模块规划

| 模块    | 作用                                                     | 默认路由                       |
| ------- | -------------------------------------------------------- | ------------------------------ |
| Helper  | 面板式生成/润色（当前已接入，走 `/api/ai/helper`）     | `/app/api/ai/helper`         |
| Command | Commander 风格命令/批处理（按模块 `command` 目录实现） | `/app/api/ai/command` (预留) |
| Copilot | 内联补全/浮动文本（按模块 `copilot` 目录实现）         | `/app/api/ai/copilot` (预留) |

三种模式共用 OpenAI-Like 配置，建议在 `.env.local` 中维护：

| 变量                                                                 | 说明                    | 示例值                             |
| -------------------------------------------------------------------- | ----------------------- | ---------------------------------- |
| `OPENAI_API_KEY` / `AI_API_KEY`                                  | 默认密钥                | `sk-***`                         |
| `AI_BASE_URL` / `AI_GATEWAY_URL`                                 | 兼容 OpenAI 的 Base URL | `https://api.deepseek...`        |
| `AI_HELPER_MODEL` / `AI_COMMAND_MODEL` / `AI_COPILOT_MODEL`    | 各模式默认模型          | `gpt-4o`, `gpt-4o-mini` 等     |
| `AI_TEMPERATURE` / `AI_MAX_OUTPUT_TOKENS` / `AI_SYSTEM_PROMPT` | 行为参数                | `0.7` / `256` / `You are...` |

未来真正前后端分离时，只需让 `/api/ai/*` 代理到后端服务即可，前端调用方式保持一致。

```

这个项目看起来是一个基于 Next.js 和 Plate 编辑器构建的 AI 写作工具，具有模块化的 AI 功能集成和良好的架构设计。
```
