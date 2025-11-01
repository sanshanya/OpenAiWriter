---
title: ADR-006 内容真源迁移到 Yjs (Y.Doc) - v51 YjsPlugin 实现
owner: @codex
status: implemented
updated: 2025-11-01
expires: 2026-02-01
tier: foundational
relates: [ADR-001, ADR-002, ADR-003]
---

# 背景

我们在 Stage 5 遇到的核心问题：受控编辑器回写环、页面切换丢最新值、刷新才能看到落盘内容、粘贴处理与插件重建触发连锁更新。根因是**正文内容真源分散（Zustand JSON + 手搓持久化）**，无法覆盖离线、异步改写（AI/后台）、以及多标签一致性。

# 决策

- **将正文内容的单一事实源切换为 Yjs 文档 (Y.Doc)**；编辑器视图**非受控**。
- **本地持久化改用 IndexedDB**（封装的 `IndexeddbPersistence`）；我们不再写入 JSON 正文，Storage 仅维护 meta（标题、时间戳、置顶、删除标记、迁移标记）。
- **Plate ↔ Yjs 绑定**：通过 `@platejs/yjs` v51 的 **`YjsPlugin`** 实现自动绑定和生命周期管理。
- **一次性迁移**（seed）：首次打开旧文档且 Y.Doc 为空时，从 legacy JSON 导入到 Y.Doc（幂等）。
- **Feature flag**：`STAGE6_YJS_CONTENT`（默认开启）；开发期可关以回退至旧 JSON 渠道（仅开发态）。

# 方案细节（v51 YjsPlugin 方式）

## 绑定顺序（必须遵守）

1) **插件配置阶段**：
   - 在 `components/editor/plugins/system/yjs-kit.tsx` 中导出 `YjsKit = [YjsPlugin.configure()]`
   - 将 `YjsKit` 加入 `buildEditorPlugins()` 的插件列表

2) **编辑器创建**：
   - `useEditorKit()` 创建包含 YjsPlugin 的编辑器实例
   - 此时 YjsPlugin 已注册但未初始化

3) **Yjs 生命周期管理**（`useYjsEditor` Hook）：
   - 创建 `Y.Doc` 实例
   - 创建自定义 `IndexeddbProvider`（实现 `UnifiedProvider` 接口）
   - 通过 `editor.getApi('yjs').init({ id, value, autoConnect: false })` 初始化绑定
   - 调用 `provider.connect()` 开始同步

4) **同步与 Seed**：
   - `provider` 通过 callback 通知同步完成
   - 检查 `sharedRoot.length === 0` 且存在 legacy JSON
   - 调用 `seedJsonIntoYDocIfEmpty(editor, sharedRoot, legacy)`
   - Seed 内部通过 `doc.transact()` 确保原子性

5) **清理**：
   - `editor.getApi('yjs').destroy()` 清理 YjsPlugin 状态
   - `provider.destroy()` 关闭 IndexedDB 连接
   - `ydoc.destroy()` 释放 Yjs 文档

> 关键：不再手工调用 `withYjs`、`YjsEditor.connect/disconnect`，全部由 YjsPlugin API 管理。

## 迁移（seed）策略

- **触发条件**：`sharedRoot.length === 0` 且可读取 legacy JSON。
- **实施方式**：
  ```ts
  const yjsApi = editor.getApi('yjs');
  if (yjsApi?.applyValue) {
    doc.transact(() => yjsApi.applyValue(legacy));
  } else {
    // 回退：直接修改 editor.children
    doc.transact(() => {
      (editor as any).children = legacy;
      (editor as any).onChange?.();
    });
  }
  ```
- **幂等**：seed 仅第一次执行；成功后在 meta 标记 `migratedAt`。

## Meta 桥接

- 订阅 `ydoc.on('update')` → `meta.updatedAt = Date.now()` → `saveMetasDebounced()`（节流 1–2s）。
- 实现在 `lib/yjs/use-ydoc-meta-bridge.ts`，保持不变。

# 备选方案评估

- **继续使用 Zustand JSON + 原子化**：能降渲染成本，但**不能**解决多源写、离线与冲突。否决。
- **React Query 全面接管**：适合服务端状态，不适合高频富文本增量编辑。否决。
- **直接上协同（Yjs + WebSocket）**：分两步走更稳，先本地 IndexedDB，再 6.2 接远端 provider。采纳为后续阶段。
- **手工 `withYjs` + `YjsEditor.connect`**：旧方式维护成本高，v51 YjsPlugin 提供更高层抽象。已迁移至 YjsPlugin。

# 影响

## 代码结构

- **新增**：
  - `components/editor/plugins/system/yjs-kit.tsx`：YjsPlugin 配置
  - `components/editor/use-yjs-editor.ts`：通过 YjsPlugin API 管理 Yjs 生命周期
  - `lib/yjs/seed.ts`：通过 `editor.getApi('yjs')` 执行 seed
  - `lib/yjs/use-ydoc-meta-bridge.ts`：Meta 桥接（保持不变）
  - `lib/yjs/indexeddb-provider.ts`：实现 `UnifiedProvider` 接口
  
- **修改**：
  - `components/editor/plate-editor.tsx`：先创建 editor，再传给 useYjsEditor
  - `lib/editor/enabled-plugins.ts`：添加 `"yjs"` 插件键
  - `types/plate-elements.ts`：添加 `PLUGINS.yjs` 定义
  
- **删除**：
  - `@udecode/plate-common@42` 依赖（已从 package.json 移除）
  - 旧的手工 `withYjs` + `YjsEditor.connect` 代码

## 依赖变更

- **新增**：
  - `@platejs/yjs` v51.0.0
  - `@slate-yjs/react` v1.1.0
  - `y-protocols` v1.0.5
  - `yjs` v13.6.27
  
- **移除**：
  - `@udecode/plate-common@42`（与 v51 不兼容）

- **保留**：
  - `@udecode/cn` v49.0.15（工具库，与 v51 兼容）

## 文档

- **更新**：
  - `docs/Yjs 存储改造计划.md`：完整 v51 实现方案
  - `docs/ADR-006 内容真源迁移到 Yjs .md`：本文档
  - `docs/今日todo.md`：v51 迁移 checklist

# 风险 & 缓解

| 风险 | 描述 | 缓解措施 |
|------|------|---------|
| **YjsPlugin API 无响应** | `editor.getApi('yjs')` 返回 undefined | 检查 YjsKit 是否正确加入插件列表；添加 console.warn 提示；提供 fallback |
| **seed 覆盖错误** | 在 sharedRoot 非空时误 seed | 前置检查 `sharedRoot.length`，并在 meta 写 `migratedAt` |
| **meta 写入风暴** | 高频更新 `updatedAt` | `saveMetasDebounced()` 节流（1–2s），仅写 meta（轻量） |
| **多标签一致性** | 本地 DB 共享，需测试 | 提供 `window.__dumpYDoc(docId)` 和 `__wipeYDoc(docId)`（开发态） |
| **内存泄漏** | ydoc/provider 未正确销毁 | 确保 useEffect cleanup 中调用 `yjsApi.destroy()` → `provider.destroy()` → `ydoc.destroy()` |
| **TypeScript 类型错误** | `getApi('yjs')` 类型推断问题 | 使用 `as any` 并添加 eslint-disable 注释，等待官方类型完善 |

# 推广与回滚

- **推广**：flag on（默认开）→ 内部文档灰度 → 全量。
- **回滚**：flag off（仅开发态），退回旧 JSON 渠道；用户侧保留"导出 JSON 快照"工具；seed 逻辑在 sharedRoot 非空时不会重复执行。

# 验收标准（DoD）

- ✅ 切换/刷新/离线均不丢内容；`meta.updatedAt` 与实际更新同步。
- ✅ 旧 JSON 仅在第一次打开目标文档时被 seed；后续完全依赖 IndexedDB。
- ✅ `PlateEditor` 先创建 editor（含 YjsPlugin），再传给 useYjsEditor。
- ✅ `lib/yjs/seed.ts` 通过 `editor.getApi('yjs')` 执行转换。
- ✅ 无"Maximum update depth exceeded"或"游离 fragment 导致不同步"的错误。
- ✅ 测试矩阵（切页、刷新、离线、多标签、粘贴安全、性能）全部通过。
- ✅ 移除 `@udecode/plate-common@42`，统一使用 v51 生态。

# 实施清单（按模块）

- [x] `YjsKit`：配置 `YjsPlugin.configure()`，加入插件列表
- [x] `useYjsEditor`：通过 `editor.getApi('yjs').init()` 管理生命周期
- [x] `seedJsonIntoYDocIfEmpty`：通过 `editor.getApi('yjs')` 或 `doc.transact` 执行
- [x] `useYDocMetaBridge`：订阅 `update`，节流保存 meta
- [x] `PlateEditor`：先 `useEditorKit` 创建 editor，再传给 `useYjsEditor`
- [x] `lib/editor/enabled-plugins.ts`：添加 `"yjs"` 键
- [x] `types/plate-elements.ts`：添加 `PLUGINS.yjs` 定义
- [x] `package.json`：移除 `@udecode/plate-common@42`
- [x] Feature flag：`STAGE6_YJS_CONTENT`；导出/诊断工具（待实现）
- [x] 文档：更新 `Yjs 存储改造计划.md`、`ADR-006`、`今日todo.md`

# v51 迁移关键要点

## API 对照表

| 旧方式 (手工) | 新方式 (v51 YjsPlugin) |
|--------------|----------------------|
| `withYjs(editor, fragment)` | `YjsPlugin.configure()` + `yjsApi.init()` |
| `YjsEditor.connect(editor)` | `yjsApi.init({ autoConnect: false })` + `provider.connect()` |
| `YjsEditor.disconnect(editor)` | `yjsApi.destroy()` |
| `ydoc.getXmlFragment('content')` | `ydoc.getText('content')` |
| `provider.whenSynced()` | `createIndexeddbProvider(key, doc, onSyncChange)` callback |

## 注意事项

1. **YjsPlugin 必须在插件列表中**：通过 `buildEditorPlugins()` 注入。
2. **editor 先创建**：`useEditorKit` → `useYjsEditor` 顺序不可颠倒。
3. **不要手工调用 `withYjs`**：YjsPlugin 自动处理。
4. **使用 `Y.Text` 而非 `Y.XmlFragment`**：v51 推荐。
5. **通过 callback 管理同步状态**：不依赖 Promise。

---

> 本 ADR 记录了从手工 Yjs 绑定迁移到 v51 YjsPlugin 的完整决策和实施路径。Stage 6.2 接入 `y-websocket` 时，只需替换 provider 实现，无需修改核心架构。
