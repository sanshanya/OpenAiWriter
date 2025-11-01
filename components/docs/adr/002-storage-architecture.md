
# ADR-002: 编辑存储内核的不变量与简化

## 背景

曾出现“切换文档导致内容串台”的问题。根因：`onChange` 以全局 activeId 写入，晚到回调将 A 文档内容写入 B 文档。

## 决策（不变量）

1. **事件按对象路由**：任何状态写入必须携带所属对象的 stable id（docId）。`update(docId, patch)`，禁止使用全局 activeId 推断。
2. **单一持久化出口**：localStorage / IndexedDB / 远端同步，统一在一个提交器（Effect/Adapter）内完成；UI/Reducer 不触存储。
3. **纯状态演算**：`documentsReducer` 负责创建/更新/软删/恢复/永久删；可回放、可单测。
4. **墓碑优先**：删除默认软删（`deletedAt`）；内存恢复时包含已删文档（供回收站显示），UI 层按需过滤。
5. **适配器隔离副作用**：读写策略收敛于 `lib/storage-adapter.ts`，UI 只 dispatch，不关心持久化细节。

## 后果

- **优点**：消灭切换竞态类问题；写路径唯一、可观测；测试颗粒清晰；灾备/回收站语义一致。
- **代价**：初期多一个适配层，但复杂度集中、长期维护成本更低。

## 替代方案

- 以 next-tick/熔断等时序补丁兜底 —— 能止血，非本质，维护成本高。

## 迁移步骤

- 已完成：`updateDocumentContent(docId, value)`、单一持久化出口、墓碑与回收站、IDB 灾备。
- 本次：抽出 `lib/storage-adapter.ts`，统一提交。
- 后续：在 adapter 内接入远端同步（防抖 + 待同步队列），不改 UI 与 reducer。
