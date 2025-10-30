# Docs Index

## 核心指南
- AI生产实践指导.md — 团队写作与交付规范。
- editor-architecture.md — 编辑器骨架总览（插件真源、渲染映射、设置层、持久化入口）。
- ai-architecture.md — AI 插件基线（CopilotKit / AIKit / Helper 以及路由策略）。
- storage-overview.md — 持久化当前基线与 Facade 入口说明。

## 插件生态
- plugin-workflow.md — 接入/裁剪插件的流水线（依赖、UI、验证、文档约定）。
- markdown-plugin-coverage.md — Markdown 能力矩阵与依赖清单。
- kit-alignment.md — 与官方模板的对齐状态。
- kit-diff.md — 与官方模板的差异追踪。

## 项目规划
- TODO.md — 迭代路线图（Stage 1-5 进度与后续目标）。
- ADR/ — 架构决策记录（以编号区分主题）。

## 存档（Archive）
- archive/legacy-storage/ — 历史存储方案、失败案例、代码审查往来。
- archive/templates/ — Plate Playground 技术解读等参考资料。
- archive/ — 其他阶段性文档（含 V1/V2/V3 复盘、Bug 修复总结）。

> 约定：
> - 新增或裁剪插件时，需同步更新 `plugin-workflow.md`、`markdown-plugin-coverage.md`、`kit-diff.md`。
> - 对存储层的结构性调整，请更新 `storage-overview.md` 并补充对应 ADR。
