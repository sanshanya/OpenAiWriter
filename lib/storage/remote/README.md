# 远端同步模块（已归档）

## 状态
🔴 未启用，待未来重新评估

## 背景
Stage5 阶段引入的快照/事件双模式同步，但实际未完成：
- `_archived_remote-sync.ts`：快照模式 + 事件模式框架
- `_archived_outbox.ts`：事件流追加逻辑
- `_archived_sync-loop.ts`：后台循环框架

## 推荐方案
采用 **Yjs + Plate.js 官方集成** 替代自研：
- 代码量 -75%
- 解决多标签页、CRDT 冲突、性能一步到位
- 参考：`docs/nextstep/architecture-analysis-and-refactoring-plan.md`

## 如需重新启用
1. 评估 Yjs 方案是否更合适
2. 若仍需自研，从这些文件恢复
3. 补充完整的测试用例
