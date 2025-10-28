<div align=center> <img src="https://sansme.oss-cn-beijing.aliyuncs.com/markdown/20251028002529587.png" width="360" height="480"></div>

# 项目概述

AI Writer UI（暂定名）是一套基于 Next. js App Router 与 Plate 生态构建的 AI 写作前端。目标是在可控的插件体系下，逐步搭载生成、润色、批注等能力，并保持"最小可行产品 + 按需扩展"的节奏。

- 前端框架：Next. js 16 + React 19
- 富文本内核：Plate（`@platejs/basic-nodes` + 自定义 UI 映射）
- UI 体系：Tailwind 新工作流 + shadcn 风格组件（自建）

## 快速启动

```bash
pnpm install
pnpm dev
```

访问 `http://localhost:3000`，默认主页即编辑器工作台。

## 目录指引

- docs 文件夹内放有本项目开发目录
- 围绕其中 `TODO.md` 中的阶段任务推进，阶段完成后进行复盘与下一步确认。

## AI 模块规划

| 模块    | 作用                                                     | 默认路由                  |
| ------- | -------------------------------------------------------- | ------------------------- |
| Helper  | 面板式生成/润色（当前已接入，走 `/api/ai/helper`）     | `/app/api/ai/helper`    |
| Command | Commander 风格命令/批处理（按模块 `command` 目录实现） | `/app/api/ai/command`  |
| Copilot | 内联补全/浮动文本（按模块 `copilot` 目录实现）         | `/app/api/ai/copilot`  |

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
