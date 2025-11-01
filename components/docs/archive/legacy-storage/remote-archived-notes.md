# 远端同步归档说明（Stage 5）

> 状态：已归档，当前版本未启用  
> 背景：Stage5 尝试自研“快照/事件”同步，但方案未完成且存在性能隐患

## 历史产物

- `remote-sync`（快照/事件双模式框架）
- `outbox`（事件流追加与重试）
- `sync-loop`（后台轮询框架）

以上源码现已从 `lib/storage/remote/` 删除，保留此文档作为索引。

## 推荐方向

- 优先采用 **Yjs + Plate.js 官方集成**：显著降低代码量并原生解决多标签页/CRDT 冲突。
- 参考文档：`docs/archive/legacy-storage/nextstep/architecture-analysis-and-refactoring-plan.md`。

## 若需重新启用

1. 基于上述“推荐方向”重新评估需求，确认确实需要自研同步。
2. 结合本仓库的 ADR / 复盘文档梳理现有存储不变量。
3. 在单独分支恢复相关原型代码，并配套完善的测试与监控方案后再合并。
