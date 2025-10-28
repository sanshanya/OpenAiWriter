# ADR-001: V3 存储架构设计（与冷备恢复）

## 背景

V1/V2 因为 React 状态与编辑器内部状态时序冲突、以及多真源覆盖导致数据丢失。V3 以 React State 为唯一真源，并通过 key 重建与异步切换解决“切换/刷新覆盖输入”的闭环问题。参考复盘与细则。

## 决策

1) React State 为唯一真源；PlateEditor 仅渲染与上报 onChange。
2) 切换文档 `setTimeout(0)`，key 用 `activeDocument.id` 强制重建实例。
3) localStorage 同步热备、IndexedDB 异步冷备；IDB 失败只记日志。
4) localStorage 为空且 IDB 有数据 → 弹出灾难恢复对话框，由用户决定恢复。

## 后果

- 优点：简单、可预测、用户数据有兜底；故障不降级体验。
- 代价：切换重建带来微小开销；多一层恢复 UI 与观测逻辑。

## 备选

- Worker+防抖的提前优化（推迟到远端同步阶段再评估）。
