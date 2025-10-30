# ADR-003: 存储类型与常量统一

## 背景

在 V3 存储实现中，`DocumentRecord` / `StoredDocument` / `DocMeta` 等类型分散定义于 `hooks/use-documents.tsx`、`hooks/use-persistence.ts`、`lib/storage-adapter.ts` 等位置，导致：

- 类型重复维护且易产生漂移；
- 工具函数（如 `deriveTitle`、`cloneValue`、`makeDefaultDoc`）在多个文件实现；
- 常量（如 localStorage key、IndexedDB 名称与版本）硬编码，难以统一调整。

为支撑后续存储分层重构与 Yjs 迁移，需要先完成类型与常量的集中管理。

## 决策

1. 新增 `types/storage.ts`，定义 `DocumentRecord`、`DocumentMeta` 以及通用工具函数（`cloneValue`、`deriveTitle`、`makeDefaultDoc`）。
2. 新增 `lib/storage/constants.ts`，集中维护本地持久化相关常量（localStorage key、IndexedDB 名称/Store/版本、各类延迟配置）。
3. 所有存储相关模块（`hooks/use-documents.tsx`、`lib/storage-adapter.ts`、`lib/idb.ts`、`lib/meta-cache.ts`、`lib/remote-sync.ts`、`lib/outbox.ts` 等）统一引用上述类型与常量。
4. 删除遗留的 `hooks/use-persistence.ts`、`types/documents.ts`，避免重复定义。

## 后果

- ✅ 类型单一真源，减少维护成本；
- ✅ 工具函数集中复用，避免行为不一致；
- ✅ 常量统一，后续重构（Facade、分层）更易推进；
- ⚠️ 依赖 `types/storage.ts` 的模块需遵循新的导入路径，重构期间需注意循环依赖。

## 备选方案

- **保持现状**：延迟统一，继续容忍重复类型与常量 —— 已被证明会导致实现漂移与维护困难，因此放弃。
- **仅统一类型**：先保留常量硬编码 —— 无法解决 key 漂移与配置不一致的问题，同样被放弃。
