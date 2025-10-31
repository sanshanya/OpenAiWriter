# 存储系统基线（Stage 5.5）

> 本页概述当前前端持久化的设计真源，并指向需要关注的代码入口。

## 核心结构

- **类型真源**：`types/storage.ts`
  - `DocumentRecord` / `DocumentMeta` 统一描述运行态与持久化态字段。
  - `cloneValue` / `deriveTitle` / `makeDefaultDoc` 提供共享工具函数。
- **常量配置**：`lib/storage/constants.ts`
  - `STORAGE_KEYS`：localStorage / IndexedDB 标识。
  - `STORAGE_CONFIG`：持久化防抖、冷备清理等时序参数。
- **统一 Facade**：`lib/storage/index.ts`
  - 本地：`loadMetas` / `saveMetas`、`idbGetDoc` / `persistDocChange` / `removeDocsFromIDB`。
  - 恢复：`getIDBRecoveryMetas` / `loadAllFromIDB` / `makeDefaultDoc`。
  - 监控：`getStorageHealth`、`StorageLogger`。

## 数据流回顾

1. **Provider 初始化**：`hooks/use-documents.tsx`
   - 读取 metas → 懒加载正文（`hydrateDocContent`）→ `dispatch({ type: "INIT" })`。
   - 未命中缓存时触发灾难恢复对话框，调用 `Storage.loadAllFromIDB()`。
2. **状态驱动持久化**：
   - Reducer (`hooks/documents-model.ts`) 维护 `DocumentRecord[]` 与 `activeId`。
   - `useEffect` 监听 `state.docs`：
     - 持久化 metas（稳定排序）；
     - 计算增量 → `Storage.persistDocChange(meta, content)`；
     - 差集 ID → `Storage.removeDocsFromIDB(ids)`。
3. **写入调度**：`lib/storage/adapter/persistence.ts`
   - 采用 `Map` 批次聚合 + `requestIdleCallback`/`setTimeout` 异步 flush。
   - 落盘后通过 `StorageLogger` 记录耗时。
4. **恢复逻辑**：`lib/storage/adapter/recovery.ts`
   - 统一使用 `DocumentRecord`，负责标题兜底、墓碑清理、冷备清扫。

## 开发约定

- **不要绕过 Facade**：新的读写逻辑一律经由 `lib/storage/index.ts`，避免再次出现多真源。
- **类型新增必更新**：调整文档字段时同步修改 `types/storage.ts` + 相关工具。
- **持久化只关心已水合文档**：`loadedContentRef` 是写入阀门，新增路径需尊重该约束。
- **记录重大改动**：架构决策统一收敛到 `docs/adr`，同时在本页更新可操作的入口说明。

## 后续关注

- **Stage 6 选型**：基于 `docs/archive/legacy-storage/` 内的历史方案评估 Yjs 集成。
- **健康检查对接**：`lib/storage/health.ts` 留出接口，可在 DevTools 面板或后端探针中调用。
- **远端同步**：旧的快照/事件实现已整理至 `docs/archive/legacy-storage/remote-archived-notes.md`，如需重启项目先基于该文档及 nextstep 方案重新评估。

> 历史方案、失败复盘与详细计划已整合至 `docs/archive/legacy-storage/`，仅在需要回顾背景或执行差距分析时查阅。
