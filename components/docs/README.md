# Docs Index

## 核心指南

- architecture/ai-architecture.md — AI 插件基线与路由策略。
- architecture/editor-architecture.md — 编辑器骨架（插件真源、渲染映射、设置层）。
- architecture/storage-overview.md — 本地持久化真源与 Facade 入口。

## 项目规划

- TODO.md — 当前迭代路线与优先级。
- adr/ — 编号决策记录，配合代码约束。

## 操作手册

- runbook/AI生产实践指导.md — 团队写作与交付准则。
- runbook/plugin-workflow.md — 插件接入/裁剪流水线。
- runbook/markdown-plugin-coverage.md — Markdown 能力矩阵与依赖清单。
- runbook/kit-alignment.md — 与官方模板的对齐状态与官方模板的差异追踪。。

## 存档（Archive）

- archive/legacy-storage/ — 历史存储方案、失败案例与复盘。
- archive/templates/ — 参考模板与外部资料。
- archive/ — 其他阶段性文档（V1/V2/V3 复盘、Bug 修复总结等）。

> 约定：
>
> - 改动 `/src/lib/storage/**` 必须同步更新 `architecture/storage-overview.md` 并视情况补充 ADR。
> - 新增或裁剪插件需更新 `runbook/plugin-workflow.md`、`runbook/markdown-plugin-coverage.md`、`runbook/kit-diff.md`。
> - 文档新增/调整请遵循 `docs/文档指南.md`，从对应目录的 `TEMPLATE.md` 复制起步。
