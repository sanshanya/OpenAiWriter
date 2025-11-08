---
title: ADR-004: AI Gateway 与流程编排基线
owner: @sans
status: active
tier: foundational
updated: 2025-02-14
relates: [DOC-ai-module-backend-v1]
supersedes: null
superseded_by: null
---

## 背景

- Stage 4 中 `/api/ai/*` 直接由 Next Route 调用模型，Prompt 构造、上下文裁剪、鉴权与观测分散在前端与多个 API 里，造成密钥暴露风险、撤销一致性差以及预算不可控。
- 《AI 模块设计与后端规划（v1）》已定义“前端瘦、后端厚”的边界、SSE 事件契约、`flow_runs/steps` 存储与 LCG（长上下文编排）策略，但仓库中尚无可执行的决策记录，难以推动代码改造。
- 需要先确立统一的 Gateway/Flow Service 决策，约束前端数据契约、后端流程内核与观测留痕，以便后续的 Node/Rust 实现均遵守相同接口。

## 决策

1. **单一 Gateway**  
   - `/api/ai/gateway` 作为唯一面向前端的 AI 入口，所有“续写/改写/总结/修复”都通过 `intent + flow@version` 选择编排策略。  
   - 请求体必须包含 `doc.version`、`context`（Markdown）、`selectionRef`（含 `snapshot`、`blockIds`、`snapshotHash`）以及 `client.runId`，后端负责生成 `context_hash`。  
   - Gateway 统一做鉴权、上下文长度闸门（4k 软上限 / 16k 硬上限）、灰度配置下发与模型路由解析。

2. **结构化 SSE 协议**  
   - 首帧固定发送 `event: step` + `{"type":"step","phase":"start","name":"<flow-step>","renderMode":"streaming-text|atomic-patch","docVersion":<number>}`。  
   - 过程按类型输出：`token`（增量文本）、`patch`（结构化替换）、`plan/map/reduce`（LCG）、`artifact`、`usage`、`final`、`error`。  
   - 任何非成功结束都要推送 `final:{status:"failed|cancelled"}`，前端依靠 `docVersion` 与 `runId` 决定是否应用。

3. **流程编排内核**  
   - 引入 Flow Registry（`flow@version` → [步骤 | 渲染模式 | 限额 | 降级链]），每步声明 `deterministic/retryable/resumable`，失败策略遵循 §18.3 恢复矩阵。  
   - 编排器负责：preflight（预算、token 限额、LCG 决策）、Prompt 模板绑定、工具调用、幂等恢复（`resume_from`）与取消检查。  
   - 运行期所有状态写入 `flow_runs`（轻记录）、`flow_steps`（步骤元数据 + 哈希 + 对象存储指针）、`run_artifacts` / `events`（按需入对象存储）。

4. **可靠性与治理**  
   - 预算控制：配置 `max_model_tokens`、`reserved_output_tokens`、`budget_usd`，在模型流读取 loop 中以固定步长（32 tokens 或 200ms）检查，超限主动取消并推送 `error:BUDGET_EXCEEDED`。  
   - 上下文治理：LCG（Chunker/Map/Reduce）优先按 Markdown 块切分，保留 `blockId/hash` 以便复用，同步推送 `plan/chunk` 指标。  
   - 观测：每个 `runId` 建立 trace/span，输出 `tokens/cost/latency/degradation` 指标，所有日志 JSON 化并默认脱敏。

## 后果

- **优点**：  
  - 前端彻底摆脱 Prompt/模型细节，只需发送意图与上下文，撤销/一致性逻辑由 `docVersion` 守卫。  
  - Gateway 收敛鉴权、配额与路由，SSE 事件语义单一，便于前端渲染模式协商与重放。  
  - Flow Registry + `flow_runs/steps` 提供可恢复、可观测的执行基线，可平滑从 Node 过渡到 Rust 实现。  
  - 上下文/预算/降级策略集中，可快速对齐成本与稳定性目标。
- **代价**：  
  - 首期需要补齐大量基础设施（Zod 契约、事件 writer、存储表、Chunker 工具），开发成本高。  
  - SSE 协议自定义后无法直接复用 `streamText().toTextStreamResponse()`，需要维护自建 writer 与客户端解析逻辑。
- **对开发者的影响**：  
  1. 前端调用 `/api/ai/*` 必须携带 `doc.id + doc.version + selectionRef + context`，应用响应前校验 `docVersion` & `runId`。  
  2. 新增/调整流程时，必须在 Flow Registry 登记 `flow@version`，同步更新 `docs/ai_模块设计…` 与本 ADR。  
  3. 任何对 `flow_runs/*` 表结构、LCG 或预算策略的变更都要更新监控面板与告警，且写入 `run_artifacts`/`events` 需要对象存储指针，不得直接混入 DB。  
  4. API 只能返回定义内的事件类型；新增事件需与前端渲染协议评审，通过后再落地。

## 替代方案（为何不用）

1. **继续由前端/Next Route 直接调用模型** —— 无法落实密钥隔离、预算控制和流程恢复，撤销/并发守卫依旧脆弱。  
2. **简单 HTTP JSON 响应** —— 不支持长流程与流式渲染，且无法在同一连接内推送 `plan/usage/error/final` 组合事件。  
3. **完全依赖队列 + 轮询** —— 破坏实时体验，且仍需单独的 SSE/WS 层来弥补交互反馈，整体复杂度更高且不满足 P0 流式需求。
