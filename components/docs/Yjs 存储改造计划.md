---
title: Yjs 存储改造计划 (手工 withYjs 绑定)
owner: @codex
status: implemented
updated: 2025-11-01
expires: 2026-02-01
tier: foundational
relates: [ADR-001, ADR-002, ADR-003, ADR-006]
---

# 0. 目标（P0）

- **把正文内容的单一事实源切换为 Y.Doc**，编辑器内部不再依赖 React 受控 value。
- **本地持久化改用 IndexedDB**，所有正文增量写入交给 provider；我们只维持 meta。
- **Plate ↔ Yjs 双向绑定**：通过 `@platejs/yjs` 的 `withTYjs` + `@slate-yjs/core` 的 `YjsEditor` 驱动视图。
- **Meta 继续由 Zustand + Facade 管理**，字段包含标题、时间戳、置顶、删除标记、迁移标记等。

> 结果：切换/刷新/离线编辑稳定不丢内容，为 Stage 6.2 引入 `y-websocket`、AI/协同共存打通底座。

---

# 1. 范围（Scope）与非目标

- ✅ 完成：Y.Doc 接入、Plate 绑定（手工 withYjs）、本地持久化、旧 JSON → Y.Doc 一次性迁移、Y.Doc → meta.updatedAt 桥接。
- ✅ 完成：移除自研正文持久化路径、保留 meta Facade、整理文档/ADR。
- ✅ 完成：移除 `@udecode/plate-common@42` 旧依赖，统一使用 v51 生态。
- ✅ 完成：统一使用 `Y.XmlText` 类型，避免类型冲突。
- ❌ 本轮不做：WebSocket/多端协同、AI Prompt 协议改造、回收站/同步语义变更、受控编辑。

---

# 2. 架构边界

## 2.1 新的真源划分

| 领域         | 真源                                              | 持久化/通信                            |
| ------------ | ------------------------------------------------- | -------------------------------------- |
| 正文内容     | `Y.Doc` (`Y.XmlText` named `content`)            | `IndexeddbPersistence`（增量、离线优先） |
| 文档元数据   | Zustand `docsStore.meta: Map<string, DocMeta>`   | `lib/storage/meta-cache`（localStorage/IDB） |
| 运行态上下文 | React 状态（选中文档、UI 状态）                  | 不直接写盘                              |
| 远端同步     | 暂未启用（Stage 6.2 评估 `y-websocket`）         | N/A                                    |

## 2.2 生命周期（单文档 - 手工 withYjs）

1. `useYjsEditor` Hook 创建 `Y.Doc` 和 `sharedRoot = ydoc.get("content", Y.XmlText)`。
2. 通过 `useEditorKit` 创建基础 Plate 编辑器。
3. 用 `withYjs(baseEditor, sharedRoot, { autoConnect: false })` 绑定。
4. 调用 `YjsEditor.connect(editor)` 激活双向同步。
5. `IndexeddbPersistence` 装载本地增量；若为空则从 Legacy JSON seed。
6. `Y.Doc` `update` 事件驱动 `meta.updatedAt`、保存 meta。
7. 切换/关闭时 `YjsEditor.disconnect` → `provider.destroy` → `ydoc.destroy`。

## 2.3 依赖与配置

- **核心依赖**：
  - `yjs` v13.6.27
  - `@platejs/yjs` v51.0.0 (withTYjs)
  - `@slate-yjs/core` v1.0.2 (YjsEditor)
  - `@slate-yjs/react` v1.1.0 (远程光标)
  - `y-protocols` v1.0.5 (Awareness)
  
- **版本策略**：锁定三方版本并记录在 ADR-006。
- **Feature flag**：`STAGE6_YJS_CONTENT`（默认 true）。

---

# 3. 代码实现清单

## 3.1 Yjs 编辑器 Hook

<details>
<summary>文件：components/editor/use-yjs-editor.ts</summary>

```ts
export function useYjsEditor({
  docId,
  enabled = true,
  getLegacyJson,
}: UseYjsEditorOptions): UseYjsEditorResult {
  const effectiveEnabled = Boolean(enabled && docId);

  // 1. 创建基础编辑器
  const initialValue = React.useMemo<MyValue>(() => [], [docId]);
  const { editor: baseEditor } = useEditorKit(initialValue);

  // 2. 创建 Y.Doc
  const ydoc = React.useMemo(() => {
    if (!effectiveEnabled) return null;
    return new Y.Doc();
  }, [effectiveEnabled, docId]);

  // 3. 获取 XmlText (统一使用这种方式)
  const sharedRoot = React.useMemo(() => {
    if (!ydoc) return null;
    return ydoc.get("content", Y.XmlText) as Y.XmlText;
  }, [ydoc]);

  // 4. withYjs 绑定
  const editor = React.useMemo(() => {
    if (!sharedRoot || !effectiveEnabled || !baseEditor) return null;
    return withYjs(baseEditor, sharedRoot, { autoConnect: false });
  }, [baseEditor, effectiveEnabled, sharedRoot]);

  // 5. connect/disconnect
  React.useEffect(() => {
    if (!editor || !sharedRoot) return;
    YjsEditor.connect(editor);
    return () => YjsEditor.disconnect(editor);
  }, [editor, sharedRoot]);

  // 6. IndexedDB provider + seed
  const providerRef = React.useRef<IndexeddbPersistence | null>(null);
  const [synced, setSynced] = React.useState(!effectiveEnabled);

  React.useEffect(() => {
    if (!effectiveEnabled || !docId || !ydoc || !sharedRoot || !editor) {
      providerRef.current = null;
      setSynced(!effectiveEnabled);
      return;
    }

    const provider = new IndexeddbPersistence(`${APP_NAMESPACE}:doc:${docId}`, ydoc);
    providerRef.current = provider;
    setSynced(false);

    const handleSynced = async () => {
      try {
        if (sharedRoot.length === 0 && getLegacyJson) {
          const legacy = await getLegacyJson();
          if (legacy?.length > 0) {
            await seedJsonIntoYDocIfEmpty(editor, sharedRoot, legacy);
          }
        }
      } finally {
        setSynced(true);
      }
    };

    provider.whenSynced().then(handleSynced).catch(() => setSynced(true));

    return () => {
      providerRef.current = null;
      provider.destroy();
      ydoc.destroy();
    };
  }, [docId, editor, effectiveEnabled, getLegacyJson, sharedRoot, ydoc]);

  return { editor, ydoc, provider: providerRef.current, status: { synced } };
}
```
</details>

## 3.2 Legacy JSON 迁移工具

<details>
<summary>文件：lib/yjs/seed.ts</summary>

```ts
export async function seedJsonIntoYDocIfEmpty(
  editor: any,
  sharedRoot: Y.XmlText,
  legacy: MyValue,
): Promise<boolean> {
  if (!editor || sharedRoot.length > 0 || !legacy || legacy.length === 0) {
    return false;
  }

  const doc = sharedRoot.doc;
  if (!doc) return false;

  try {
    doc.transact(() => {
      editor.children = legacy;
      if (typeof editor.onChange === 'function') {
        editor.onChange();
      }
    });
    return true;
  } catch (error) {
    console.error('[seedJsonIntoYDocIfEmpty] Failed', error);
    return false;
  }
}
```
</details>

## 3.3 Meta 桥接

<details>
<summary>文件：lib/yjs/use-ydoc-meta-bridge.ts</summary>

```ts
export function useYDocMetaBridge(
  docId: string | null,
  ydoc: Y.Doc | null,
  { throttleMs = 1000 }: Options = {},
) {
  const setMeta = useDocsState((state) => state.setMeta);

  useEffect(() => {
    if (!docId || !ydoc) return undefined;

    // 统一使用 Y.XmlText
    const fragment = ydoc.get("content", Y.XmlText) as Y.XmlText;

    const commit = () => {
      const now = Date.now();
      const title = deriveTitle(fragment);
      setMeta(docId, { updatedAt: now, ...(title ? { title } : {}) });
      saveMetasDebounced(metas);
    };

    const handleUpdate = () => {
      // 节流逻辑...
      commit();
    };

    ydoc.on("update", handleUpdate);
    return () => ydoc.off("update", handleUpdate);
  }, [docId, ydoc, throttleMs]);
}
```
</details>

## 3.4 Plate 编辑器壳层

<details>
<summary>文件：components/editor/plate-editor.tsx</summary>

```tsx
export function PlateEditor() {
  const { activeDocumentId, isHydrated, getLegacyContentSnapshot } = useDocuments();
  const ready = Boolean(isHydrated && activeDocumentId);

  const getLegacyJson = React.useCallback(() => {
    if (!ready || !activeDocumentId) return Promise.resolve<MyValue | null>(null);
    return getLegacyContentSnapshot(activeDocumentId);
  }, [activeDocumentId, getLegacyContentSnapshot, ready]);

  // useYjsEditor 内部创建 editor
  const { editor, ydoc, status } = useYjsEditor({
    docId: activeDocumentId ?? null,
    enabled: ready,
    getLegacyJson,
  });

  useEditorHotkeys(editor);
  useYDocMetaBridge(ready ? activeDocumentId : null, ydoc);

  // 同步前显示加载
  if (!ready || !editor || !ydoc || !status.synced) {
    return <LoadingSkeleton />;
  }

  return <Plate key={activeDocumentId} editor={editor}>...</Plate>;
}
```
</details>

---

# 4. 关键修复

## 4.1 统一使用 Y.XmlText

**问题**：混用 `getXmlFragment` 和 `Y.XmlText` 导致 "Type with name content already defined"

**解决**：所有地方统一使用
```ts
const sharedRoot = ydoc.get("content", Y.XmlText) as Y.XmlText;
```

**影响文件**：
- [`use-yjs-editor.ts`](components/editor/use-yjs-editor.ts:48)
- [`use-ydoc-meta-bridge.ts`](lib/yjs/use-ydoc-meta-bridge.ts:24)
- [`seed.ts`](lib/yjs/seed.ts:12)

## 4.2 withYjs vs YjsPlugin

**决策**：采用手工 `withYjs` 绑定

**原因**：
1. YjsPlugin 需要在编辑器创建时就配置 ydoc，架构上需要倒置依赖
2. 我们的 ydoc 需要随 docId 变化动态创建/销毁
3. 手工方式更灵活，生命周期控制更精确

**实现**：
```ts
const editor = withYjs(baseEditor, sharedRoot, { autoConnect: false });
YjsEditor.connect(editor);
// cleanup: YjsEditor.disconnect(editor)
```

---

# 5. 测试矩阵

| 场景             | 步骤                                | 预期                                    |
| ---------------- | ----------------------------------- | --------------------------------------- |
| 编辑器加载       | 打开文档                            | "正在加载"消失，编辑器正常显示          |
| 内容输入         | 输入文字                            | sidebar 时间戳更新                      |
| 刷新持久化       | 输入 → 刷新页面                     | 内容保留，无闪烁                        |
| 切换文档         | 文档 A 输入 → 切换 B → 切回 A       | 内容不丢失                              |
| 旧文档迁移       | 首次打开 legacy JSON 文档           | 内容正确迁移，console 显示 seed 日志    |
| 离线编辑         | 断网 → 输入 → 刷新                  | 内容仍在，无报错                        |
| 多标签页         | Tab A 输入 → Tab B 打开同文档       | 内容同步                                |
| 类型一致性       | 运行时                              | 无 "Type with name content" 错误        |

---

# 6. 风险与对策

| 风险                     | 描述                                    | 对策                                                         |
| ------------------------ | --------------------------------------- | ------------------------------------------------------------ |
| Y.Doc 类型冲突          | 同一 key 用不同类型定义                 | 统一使用 `ydoc.get("content", Y.XmlText)`                    |
| Provider 未同步         | whenSynced 未触发导致内容丢失           | 添加 timeout fallback，确保 setSynced(true)                  |
| Seed 覆盖错误           | 重复 seed 覆盖用户输入                  | 检查 `sharedRoot.length === 0`，标记 `migratedAt`            |
| 内存泄漏                | ydoc/provider 未正确销毁                | 确保 cleanup 顺序：disconnect → destroy → ydoc.destroy       |
| 类型断言                | `as unknown as PlateEditor` 不安全      | 仅在必要处使用，等待官方类型完善                              |

---

# 7. 验收标准（DoD）

- ✅ 任何文档在切换、刷新、离线状态下内容保持一致。
- ✅ 旧 JSON 仅首次打开时写入 Y.Doc，后续依赖 IndexedDB。
- ✅ `useYjsEditor` 返回 `{ editor, ydoc, provider, status }`。
- ✅ 所有地方统一使用 `ydoc.get("content", Y.XmlText)`。
- ✅ 无 "Type with name content already defined" 错误。
- ✅ 无 "Path doesn't match yText" 错误。
- ✅ 回归测试矩阵通过。
- ✅ 移除 `@udecode/plate-common@42` 依赖。

---

# 8. 实施清单

- [x] `useYjsEditor`：手工 withYjs 绑定，返回 `{ editor, ydoc, provider, status }`
- [x] `seedJsonIntoYDocIfEmpty`：`doc.transact(() => { editor.children = legacy; editor.onChange(); })`
- [x] `useYDocMetaBridge`：统一使用 `ydoc.get("content", Y.XmlText)`
- [x] `PlateEditor`：调用 `useYjsEditor`，等待 `status.synced` 后渲染
- [x] `package.json`：移除 `@udecode/plate-common@42`，添加 `@slate-yjs/core@1.0.2`
- [x] 文档：更新 `Yjs 存储改造计划.md`、`ADR-006`、`今日todo.md`

---

> 完成本计划后，Stage 6.2 只需接入 `y-websocket` 或第三方 Provider，即可复用同一 `Y.Doc` 真源来实现协同编辑或 AI 服务端直写能力。
