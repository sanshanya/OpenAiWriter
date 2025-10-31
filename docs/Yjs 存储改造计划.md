---
title: Yjs 存储改造计划
owner: @codex
status: draft
updated: 2025-02-17
expires: 2025-04-01
tier: foundational
relates: [ADR-001, ADR-002, ADR-003]
---

# 0. 目标（P0）

- **把正文内容的单一事实源切换为 Y.Doc**，编辑器内部不再依赖 React 受控 value。
- **本地持久化改用 `y-indexeddb`**，所有正文增量写入交给 provider；我们只维持 meta。
- **Plate ↔ Yjs 双向绑定**：`@platejs/yjs` 驱动视图，保留既有插件体系与设置层。
- **Meta 继续由 Zustand + Facade 管理**，字段包含标题、时间戳、置顶、删除标记、迁移标记等。

> 结果：切换/刷新/离线编辑稳定不丢内容，为 Stage 6.2 引入 `y-websocket`、AI/协同共存打通底座。

---

# 1. 范围（Scope）与非目标

- ✅ 完成：Y.Doc 接入、Plate 绑定、本地持久化、旧 JSON → Y.Doc 一次性迁移、Y.Doc → meta.updatedAt 桥接。
- ✅ 完成：移除自研正文持久化路径、保留 meta Facade、整理文档/ADR。
- ❌ 本轮不做：WebSocket/多端协同、AI Prompt 协议改造、回收站/同步语义变更、受控编辑。

---

# 2. 架构边界

## 2.1 新的真源划分

| 领域         | 真源                                              | 持久化/通信                            |
| ------------ | ------------------------------------------------- | -------------------------------------- |
| 正文内容     | `Y.Doc` (`Y.XmlFragment` named `content`)        | `IndexeddbPersistence`（增量、离线优先） |
| 文档元数据   | Zustand `docsStore.meta: Map<string, DocMeta>`   | `lib/storage/meta-cache`（localStorage/IDB） |
| 运行态上下文 | React 状态（选中文档、UI 状态）                  | 不直接写盘                              |
| 远端同步     | 暂未启用（Stage 6.2 评估 `y-websocket`）         | N/A                                    |

## 2.2 生命周期（单文档）

1. `DocumentsProvider` 确定 `activeId` → `useYjsDocument(docId)` 初始化 `Y.Doc`。
2. `IndexeddbPersistence` 装载本地增量；若为空则从 Legacy JSON seed。
3. `withTYjs` 把 Plate 编辑器实例挂到 `Y.Doc` 的 `content` 片段。
4. `Y.Doc` `update` 事件驱动 `meta.updatedAt`、保存 meta。
5. 切换/关闭无需手动 flush 正文；meta 仍由 Facade 防抖写入。

## 2.3 依赖与配置

- 新增依赖：`yjs`, `y-indexeddb`, `@platejs/yjs`.
- 版本策略：锁定三方版本并记录在新 ADR（参考 `package.json` resolutions）。
- Feature flag：`STAGE6_YJS_CONTENT`（默认 true，允许在开发阶段退回 JSON 流程）。

---

# 3. 代码改造清单

## 3.1 Yjs 编辑器 Hook

- **文件**：`components/editor/use-yjs-editor.ts`
- **职责**：创建带 Yjs 能力的 Plate 编辑器、管理 `IndexeddbPersistence`、暴露 `ydoc`/`provider`。

```ts
import * as React from "react";
import * as Y from "yjs";
import { createPlateEditor, type AnyPluginConfig } from "platejs";
import { withTYjs, YjsEditor } from "@platejs/yjs";

import { useEditorSettings } from "@/components/editor/settings/editor-settings-provider";
import type { MyValue } from "@/types/plate-elements";
import { IndexeddbPersistence } from "@/lib/yjs/indexeddb-persistence";
import { seedJsonIntoYDocIfEmpty } from "@/lib/yjs/seed";

type UseYjsEditorOptions = {
  docId: string | null;
  enabled?: boolean;
  getLegacyJson?: () => Promise<MyValue | null>;
};

type UseYjsEditorResult = {
  editor: YjsEditor<MyValue> | null;
  ydoc: Y.Doc | null;
  fragment: Y.XmlFragment | null;
  whenSynced: Promise<void>;
};

export function useYjsEditor({
  docId,
  enabled = true,
  getLegacyJson,
}: UseYjsEditorOptions): UseYjsEditorResult {
  const { buildPlugins } = useEditorSettings();
  const plugins = React.useMemo<AnyPluginConfig[]>(
    () => buildPlugins() as AnyPluginConfig[],
    [buildPlugins],
  );

  const effectiveEnabled = Boolean(enabled && docId);

  const ydoc = React.useMemo(() => {
    if (!effectiveEnabled) return null;
    void docId;
    return new Y.Doc();
  }, [effectiveEnabled, docId]);

  const fragment = React.useMemo(
    () => (ydoc ? ydoc.getXmlFragment("content") : null),
    [ydoc],
  );

  const editor = React.useMemo(() => {
    if (!fragment || !effectiveEnabled) return null;
    const base = createPlateEditor<MyValue>({ plugins });
    return withTYjs(
      base,
      fragment as unknown as Y.XmlText,
      { autoConnect: false },
    ) as YjsEditor<MyValue>;
  }, [effectiveEnabled, fragment, plugins]);

  const [whenSynced, setWhenSynced] = React.useState<Promise<void>>(
    Promise.resolve(),
  );

  React.useEffect(() => {
    if (!effectiveEnabled || !docId || !ydoc || !fragment) {
      setWhenSynced(Promise.resolve());
      return;
    }

    const provider = new IndexeddbPersistence(`openai-writer:doc:${docId}`, ydoc);

    const handleSynced = async () => {
      if (fragment.length === 0 && getLegacyJson) {
        const legacy = await getLegacyJson();
        if (legacy && legacy.length > 0) {
          await seedJsonIntoYDocIfEmpty(fragment, legacy, plugins);
        }
      }
    };

    const syncPromise = provider
      .whenSynced()
      .then(handleSynced)
      .catch((error) => {
        console.warn("[useYjsEditor] IndexedDB sync failed", error);
      });

    setWhenSynced(syncPromise);

    return () => {
      provider.destroy();
      ydoc.destroy();
    };
  }, [docId, effectiveEnabled, fragment, getLegacyJson, plugins, ydoc]);

  React.useEffect(() => {
    if (!editor || !fragment || !effectiveEnabled) return;
    YjsEditor.connect(editor, fragment as unknown as Y.XmlText);
    return () => {
      YjsEditor.disconnect(editor, fragment as unknown as Y.XmlText);
    };
  }, [editor, effectiveEnabled, fragment]);

  return { editor, ydoc, fragment, whenSynced };
}
```

## 3.2 Legacy JSON 迁移工具

- **文件**：`lib/yjs/seed.ts`
- **职责**：把 Plate JSON 转换成 Yjs 节点；仅在 `fragment.length === 0` 时运行；写入完后返回 bool。

```ts
import * as Y from "yjs";
import { createPlateEditor, type AnyPluginConfig } from "platejs";
import { withTYjs, YjsEditor } from "@platejs/yjs";

import type { MyValue } from "@/types/plate-elements";
import { BasicNodesKit } from "@/components/editor/plugins";

export async function seedJsonIntoYDocIfEmpty(
  fragment: Y.XmlFragment,
  legacy: MyValue,
  plugins?: AnyPluginConfig[],
): Promise<boolean> {
  if (fragment.length > 0 || !legacy || legacy.length === 0) return false;

  const doc = fragment.doc;
  if (!doc) return false;

  const tempEditor = withTYjs(
    createPlateEditor<MyValue>({
      plugins: plugins && plugins.length > 0 ? plugins : BasicNodesKit,
      value: [],
    }),
    fragment as unknown as Y.XmlText,
    { autoConnect: false },
  ) as YjsEditor<MyValue>;

  doc.transact(() => {
    YjsEditor.connect(tempEditor, fragment as unknown as Y.XmlText);
    tempEditor.children = legacy as unknown as typeof tempEditor.children;
    tempEditor.onChange();
    YjsEditor.disconnect(tempEditor, fragment as unknown as Y.XmlText);
  });

  return true;
}
```

## 3.3 文档状态（Zustand）瘦身

- **文件**：`state/docs.ts`（新建）
- **变化**：只保存 `meta`、`activeId`、`migratedAt` 等；移除正文 `content`。
- **对外 API**：`useDocsState`, `setMeta`, `upsertMeta`, `removeMeta`, `markMigrated`.

```ts
type DocMetaState = {
  meta: Map<string, DocMeta>;
  activeId: string | null;
  setMeta: (id: string, patch: Partial<DocMeta>) => void;
  markMigrated: (id: string) => void;
};
```

`DocumentsProvider` 改为：

```ts
const activeMeta = useDocsState((s) =>
  s.activeId ? s.meta.get(s.activeId) ?? null : null,
);
const docList = useDocsState((s) =>
  Array.from(s.meta.values()).map(({ id, title, updatedAt, pinned }) => ({
    id,
    title,
    updatedAt,
    pinned,
  })),
);
```

## 3.4 Meta 桥接

- **文件**：`lib/yjs/use-ydoc-meta-bridge.ts`
- **作用**：监听 `Y.Doc` `update` → 更新 meta → 触发 `saveMetasDebounced`。

```ts
import { useEffect, useRef } from "react";
import * as Y from "yjs";

import { useDocsState } from "@/state/docs";
import { saveMetasDebounced } from "@/lib/storage/local/meta-cache";

type Options = { throttleMs?: number };

export function useYDocMetaBridge(
  docId: string | null,
  ydoc: Y.Doc | null,
  { throttleMs = 1000 }: Options = {},
) {
  const setMeta = useDocsState((state) => state.setMeta);
  const timerRef = useRef<number | null>(null);
  const lastCommitRef = useRef<number>(0);

  useEffect(() => {
    if (!docId || !ydoc) return;
    const fragment = ydoc.getXmlFragment("content");

    const commit = () => {
      const now = Date.now();
      lastCommitRef.current = now;
      const title = deriveTitle(fragment);
      setMeta(docId, { updatedAt: now, ...(title ? { title } : {}) });
      const metas = Array.from(useDocsState.getState().meta.values()).map(
        ({ migratedAt, ...meta }) => {
          void migratedAt;
          return meta;
        },
      );
      saveMetasDebounced(metas);
    };

    const handleUpdate = () => {
      if (throttleMs <= 0) {
        commit();
        return;
      }

      const elapsed = Date.now() - lastCommitRef.current;
      if (elapsed >= throttleMs) {
        if (timerRef.current !== null) {
          window.clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        commit();
      } else {
        if (timerRef.current !== null) {
          window.clearTimeout(timerRef.current);
        }
        timerRef.current = window.setTimeout(() => {
          commit();
          timerRef.current = null;
        }, throttleMs - elapsed);
      }
    };

    ydoc.on("update", handleUpdate);
    return () => {
      ydoc.off("update", handleUpdate);
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = null;
    };
  }, [docId, setMeta, throttleMs, ydoc]);
}

function deriveTitle(fragment: Y.XmlFragment) {
  try {
    const json = fragment.toJSON();
    if (!Array.isArray(json)) return undefined;
    for (const node of json) {
      const text = extractText(node);
      if (text.trim().length > 0) {
        return text.trim().slice(0, 80);
      }
    }
  } catch {
    // 忽略异常，保持标题不变
  }
  return undefined;
}

function extractText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  if ("text" in (node as Record<string, unknown>)) {
    const value = (node as { text?: unknown }).text;
    return typeof value === "string" ? value : "";
  }
  if ("children" in (node as Record<string, unknown>)) {
    const children = (node as { children?: unknown }).children;
    if (Array.isArray(children)) {
      return children.map((child) => extractText(child)).join("");
    }
  }
  return "";
}
```

## 3.5 Storage Facade 清理

- 移除：`saveDocContentJSON`, `readDocContentJSON`, 内容写入相关的 `flushPendingWritesNow`.
- 保留：`saveMetasImmediate`, `saveMetasDebounced`, `loadMetas`, `getIDBRecoveryMetas`.
- 新增：`readLegacyJsonSnapshot(docId)`（迁移期间使用），迁移完成后可删除。

## 3.6 Plate 编辑器壳层

- **文件**：`components/editor/plate-editor.tsx`
- 使用 `useYjsEditor({ docId, enabled })` 获取实例，`enabled=false` 时只渲染骨架；同步完成后再渲染 `Plate`。
- 移除 `initialValue`/`value` props，保留粘贴/快捷键/设置层逻辑不变。

---

# 4. 迁移流程

1. **切断旧写路径**：编辑器 `onChange` 不再调用 `Storage.persistDocChange` 写 JSON。
2. **引入 `useYjsEditor`**：Plate 壳层通过 Hook 创建编辑器，未完成水合时传入 `enabled=false`，避免违反 React Hooks 顺序。
3. **Seed 旧文档**：`provider.whenSynced` 后如果 `fragment` 为空就读取旧 JSON → `seedJsonIntoYDocIfEmpty` → `markMigrated`.
4. **Meta 桥接**：绑定 `useYDocMetaBridge`，保持 sidebar 更新时间。
5. **按文档逐步开启**：通过 feature flag 控制，首批选内部文档验证 → 种子用户 → 全量。
6. **清理 Legacy**：所有文档 `migratedAt` 填充后，移除 JSON 存储代码和 flag。

---

# 5. 测试矩阵

| 场景             | 步骤                                                         | 预期                                                         |
| ---------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| 切换文档         | 打开 A 输入 → 切 B → 切回 A                                  | 文本仍在，无闪烁；`meta.updatedAt` 递增一次                  |
| 刷新             | 输入后刷新页面                                               | 页面加载后立即显示最新内容（无 SSR → CSR 不一致）           |
| 离线编辑         | 断网 → 输入 → 刷新 → 恢复网络                                | 内容存在；恢复网络后无报错                                  |
| 粘贴策略         | 粘贴中文段落/URL/潜在 XSS                                   | Markdown 规则一致，URL 自动补协议，非法链接被拒绝           |
| 多标签页         | Tab A 输入 → Tab B 打开同文档                               | B 与 A 同步内容；无 storage 风暴                            |
| 迁移幂等         | 多次打开旧文档                                               | seed 仅第一次执行；`migratedAt` 不重复写入                   |
| 性能             | 打字 60s                                                     | Main thread idle 充足，未出现 “Maximum update depth exceeded” |
| 导出/回滚        | 调用导出工具                                                 | 能得到 JSON 快照；回滚逻辑可恢复旧数据                      |

---

# 6. 观测 & 回滚策略

- **监控指标**：`ydoc_update_duration`, `meta_save_duration`, `indexeddb_flush_time`, `migration_success_total`.
- **调试开关**：`window.__yDocDump(docId)` 导出当前 fragment；`window.__resetYDoc(docId)` 清空本地存储（仅开发）。
- **回滚步骤**：
  1. 置 `STAGE6_YJS_CONTENT=false` → 恢复 JSON 渠道（仅开发态）。
  2. 调用 JSON 导出工具落盘，避免数据丢失。
  3. 重新发布前检查 `migratedAt` 标记，避免重复 seed。

---

# 7. 风险与对策

| 风险                     | 描述                                                       | 对策                                                         |
| ------------------------ | ---------------------------------------------------------- | ------------------------------------------------------------ |
| Seed 过程中写坏结构     | Plate JSON 与 fragment 不一致                              | 使用官方转换 API；seed 前校验 `MyValue`；写入前备份 JSON     |
| Provider 版本不兼容     | 不同版本 `y-indexeddb` 行为差异                            | 锁版本 + 在 ADR 记录；升级前跑回归                           |
| 内存占用上升             | 多文档同时常驻内存                                         | 按需创建/销毁 `ydoc`，切换文档后延迟 destroy                |
| Meta 与内容不同步       | `update` 回调遗漏导致 sidebar 时间不刷新                    | 写 E2E 测试验证 updatedAt；对 `saveMetasDebounced` 添加日志 |
| 迁移过程中用户刷新       | seed 未完成用户刷新导致 JSON 清空                         | seed 完成后再标记 `migratedAt`；刷新后重新触发 seed         |

---

# 7.1 P1 级优化建议

- **加载门控**：在 `YjsEditor.connect` 完成首帧同步前以骨架替代编辑器，避免 provider 同步导致的首帧闪烁。
- **Meta 节流**：在 `useYDocMetaBridge` 中增加 ≥1s 的节流窗口，减少 `saveMetasDebounced` 对 localStorage 的压力。
- **Y.Doc 复用**：针对频繁切换文档场景，维护一个 LRU（容量 1–2）的 `Map<docId, Y.Doc>`，降低重建成本。
- **调试工具**：实现 `window.__dumpYDoc(docId)`（导出 fragment → JSON）与 `window.__wipeYDoc(docId)`（清空本地 y-indexeddb），便于排查现场。
- **Flag 退出路径**：当 `STAGE6_YJS_CONTENT=false` 时，跳过 seed/连接流程并回落至 JSON 写入逻辑（限开发态），确保回滚可行。
- **ADR 补充**：新建或更新存储相关 ADR，记录 Yjs 真源、版本锁定与回滚策略。

---

# 8. 里程碑与分工

| Sprint / 截止 | 交付物                                            | Owner     |
| ------------- | ------------------------------------------------- | --------- |
| W1 周中       | `useYjsEditor` Hook + Plate 壳层接入             | 同事 A    |
| W1 周末       | Zustand/Facade 精简 + Legacy JSON 读写封装       | 同事 B    |
| W2 周中       | Seed & migratedAt 标记、Meta 桥接、导出工具      | 同事 A/B  |
| W2 周末       | 测试矩阵执行、灰度开关、监控面板                 | 全体      |
| W3 开始       | 清理 flag、补 ADR/文档 (`architecture/*`, runbook) | 你        |

---

# 9. 验收标准（DoD）

- 任何文档在切换、刷新、离线状态下内容保持一致，`meta.updatedAt` 与实际写入同步。
- 旧 JSON 仅首次打开时写入 Y.Doc，后续完全依赖 `y-indexeddb` 增量。
- `DocumentsProvider` 不再持有正文 `content`；`lib/storage` 无正文写入函数。
- 回归测试矩阵通过，监控/调试工具可用，文档/ADR 已更新。
- 未出现循环渲染或主线程卡顿报警。

---

> 完成本计划后，Stage 6.2 只需接入 `y-websocket` 或第三方 Provider，即可复用同一 `Y.Doc` 真源来实现协同编辑或 AI 服务端直写能力。
