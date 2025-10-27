# Docs Index

## 核心架构
- editor-architecture.md — 编辑器架构速览（插件唯一真源、渲染映射、设置层、持久化）
- ai-architecture.md — AI 能力架构速览（Stage 4 基线 + DeepSeek 容错策略）

## 插件管理
- plugin-workflow.md — 插件接入与维护流程（安装依赖、拉 UI、注册 kit、验证、经验教训）
- markdown-plugin-coverage.md — Markdown 能力覆盖与依赖清单（包含媒体、Math、ToC、Slash）
- kit-diff.md — 相对官方模板的 Kit 调整记录（自研/裁剪/默认值差异）

## 存储系统
- storage-retrospective.md — Stage5 持久化 V1 复盘（初次尝试的失败经验）
- storage-retrospective-V2.md — Storage V2 完整历史归档（包含原始设计、修复尝试与失败复盘）⚠️
- storage-retrospective-V3.md - Storage V3 最终重构复盘（成功方案与根本原因分析）
- 切换新建刷新bug修复.md — 切换/新建/刷新 Bug 的最终修复方案总结

> ⚠️ 重要：storage-retrospective-V2.md 是失败者的客观自省，包含了所有设计缺陷和根本问题，建议接手者优先阅读。

## 项目规划
- TODO.md — 迭代路线图（Stage 1-5 完成情况与未来规划）

> 约定：
> - 新增或裁剪插件时，务必同步更新 plugin-workflow.md、markdown-plugin-coverage.md、kit-diff.md 三处文档。
> - 对存储逻辑的任何重大修改，都应在 `storage-retrospective-V3.md` 中留下新的复盘记录。
