# 方舟 · P0 「原子补丁预览」补丁方案

## 1. 目标与范围

把“后端一次性 `replace_text` 补丁”与“前端红/绿预览”串成闭环，做到：

- **续写** (`continue-writing`) → `renderMode=streaming-text` → 只流式 `token`
- **改写/修正** (`rewrite`/`fix-grammar`) → `renderMode=atomic-patch` → 一次性 `patch` → 前端红/绿差异预览 → 用户接受/拒绝后再真正落盘

约束：

- 不改 Plate 官方 Suggestion 内核，新建“预览插件”只负责 decorate，不往文档树写临时节点
- 后端网关的事件契约、SSE 头/心跳/收尾已齐全，直接复用 `/app/api/ai/gateway/route.ts`

## 2. 现状梳理（已具备能力）

- **SSE 头与通道**：`route.ts` 已设置 `text/event-stream`、`X-Accel-Buffering: no`，用 `createSseChannel` 统一心跳与异常收尾
- **事件契约**：`lib/ai/gateway/events.ts` 固化 `renderMode/Step/Token/Patch/Final/Usage`
- **执行器**：`lib/ai/gateway/runner.ts` 已区分 streaming-text 与 atomic-patch，互斥输出，顺序为 `step:start → progress → token/patch → usage? → step:finish → final`

## 3. 改动总览（最小侵入）

| 模块 | 说明 |
| --- | --- |
| `packages/plate-ai-adapter/src/suggestion-preview.ts` | 负责 snapshot vs patch.text diff → flatten → ranges 映射，并带 memo |
| `components/editor/plugins/ai/ai-preview-kit.tsx` | 超轻 Plate 插件，只有 `decorate`，从 cache 里查 Range，样式用 `ai_preview_*` 属性 |
| SSE 消费处 | 收到 atomic patch 时写入 `AiPreviewPlugin.options.activePreview`；`accept/reject` 决定是否真正落盘 |
| UI | Leaf/样式层渲染红删除线 & 绿幽灵文本 |

## 4. 数据契约回顾（P0 红线）

1. `renderMode` 只允许 `streaming-text` / `atomic-patch`，互斥
2. `streaming-text` → 只 `token`；`atomic-patch` → 只一次 `patch(type:"replace_text")`
3. 进度帧 & 心跳：`step:progress` (calling_model / sending_patch) + `:\n\n` 心跳
4. 收尾：`final:{status}` 必须出现，异常路径先 `error` 再 `final`

## 5. 预览算法（`computePreviewDecorations`）

### 5.1 输入

```ts
interface PreviewInput {
  docVersion: number;
  selection: Range;        // 请求时的选区
  snapshot: string;        // 原文
  replacement: string;     // patch.text
  diffs?: Array<[0|1|-1, string]>; // 可选：外界注入 diff
}
```

### 5.2 步骤

1. **Flatten**：仅遍历选区覆盖的 Text 节点，拼成 `fullText`，记录 `[{ path, text, start, end }]`
2. **Diff**：snapshot vs replacement，可用 `diff-match-patch`，无则占位“全删再插”
3. **游标模型**：
   - `retain` / `delete` 消耗原文区间 `[originalPos, originalPos+len)`
   - `insert` 不推进 `originalPos`，表示零宽插入点
4. **映射回节点**：与 flatten cell 区间求交，转换成 Slate `Range`
   - `delete` → `[data-ai_preview_delete]`
   - `retain`（可选）→ `[data-ai_preview_retain]`
   - `insert` → 零宽 range + `data-ai_preview_insert_*`，Leaf 里渲染幽灵文本
5. **Memo**：`key = hash(docVersion + snapshot + replacement)`，缓存 `Map<PathKey, Range[]>`

### 5.3 伪代码

```ts
const cache = new Map<string, Map<string, Range[]>>();

export function computePreviewDecorations(editor: TEditor, input: PreviewInput) {
  const key = stableKey(input);
  if (cache.has(key)) return cache.get(key)!;

  const flat = flattenSelection(editor, input.selection);
  const diffs = input.diffs ?? dmp.diff_main(input.snapshot, input.replacement);

  const decorations = new Map<string, Range[]>();
  let originalPos = 0;

  for (const [op, chunk] of diffs) {
    if (op === 1) { /* insert zero-width point */ continue; }
    const segStart = originalPos;
    const segEnd = segStart + chunk.length;
    // intersect with flat cells, push ranges
    originalPos = segEnd;
  }

  cache.set(key, decorations);
  return decorations;
}
```

## 6. 预览插件（`AiPreviewKit`）

```ts
export const AiPreviewPlugin = toTPlatePlugin<AiPreviewConfig>(
  () => ({ key: "ai-preview", options: { activePreview: null, docVersion: 0 } }),
  ({ editor, getOption }) => {
    let memoKey = "";
    let memoDecorations = new Map<string, Range[]>();

    const decorate = ([node, path]) => {
      const preview = getOption("activePreview");
      if (!preview || !isText(node)) return [];

      const key = stableKey({ ...preview, docVersion: getOption("docVersion") });
      if (key !== memoKey) {
        memoDecorations = computePreviewDecorations(editor, { ...preview, docVersion: getOption("docVersion") });
        memoKey = key;
      }
      return memoDecorations.get(Path.toString(path)) ?? [];
    };

    return { decorate } as never;
  },
);
```

样式建议：

```css
[data-ai_preview_delete] { text-decoration: line-through; color: #dc2626; }
[data-ai_preview_insert_before]::before {
  content: attr(data-ai_preview_insert_text);
  color: #16a34a;
}
```

## 7. SSE → 预览 → 落地

1. SSE 收到 `patch(type:"replace_text")`：
   - `setOption(AiPreviewPlugin, "activePreview", { snapshot, replacement: patch.text, selection, docVersion })`
   - `selection` 来自请求入参；docVersion 必须匹配
2. `accept()`：
   - 反向应用 diff（从尾到头 `Transforms.delete/insertText`）
   - `setOption(..., null)` 清除预览
3. `reject()`：
   - 仅 `setOption(..., null)`，不改文档

> 现有 Plate Suggestion UI （`block-suggestion.tsx`）保持原状，处理官方 suggestion 节点；本预览链路互不干扰。

## 8. 测试策略

| 测项 | 说明 |
| --- | --- |
| Mock SSE | `app/api/ai/mock/route.ts`：step:start → progress → patch → final，验证装饰 & 接受/拒绝 |
| 真流 | 配置真实模型，校验 `streaming-text` 只有 token、`atomic-patch` 只有 patch |
| 并发守卫 | runA 后立刻 runB → runA 迟到帧被丢弃 |
| 首 token 再落刀 | streaming-text 首帧 token 才调用 `writer.begin`，避免错位 |
| EOF 合成 | 服务端无 final → 客户端注入 `STREAM_EOF` error 收尾 |
| 性能 | 长选区滚动不卡顿（依赖 memo） |

## 9. 风险与回滚

| 风险 | 回滚策略 |
| --- | --- |
| 装饰错位 | 关闭幽灵渲染，只保留原子 patch 接受/拒绝 |
| 性能问题 | 限制选区范围或暂时禁用 Memo |
| 协议变更 | `events.ts` 为唯一事实源，新增类型需先更新此文件 |

## 10. 指标 & 日志

- 预览计算耗时 / Range 数量
- patch 到达 → 首帧预览渲染耗时
- accept() 修改字符数、耗时
- STREAM_EOF 次数、late frame 丢弃次数
- atomic-patch 等待时长分布（progress 间隔）

## 11. 后续演进

1. **更强 Diff**：换更稳健的 O(ND) diff、聚合 insert/delete
2. **结构化 Patch**：`replace_nodes`，按 blockIds 精确替换
3. **协同**：结合 docVersion + selectionRef，接入 CRDT/OT
4. **Rust 后端**：保持 SSE 契约不变，替换执行层

## 12. 执行清单（交付 AI 工程）

1. `packages/plate-ai-adapter/src/suggestion-preview.ts`：实现计算 & cache
2. `components/editor/plugins/ai/ai-preview-kit.tsx`：插件 + decorate memo
3. SSE 消费接线：patch → `activePreview`，accept/reject → 清理 or 真实落地
4. 样式 & Leaf 渲染幽灵文本
5. Mock SSE (`app/api/ai/mock/route.ts`) 验证
6. 回归：并发守卫、首 token 再落刀、心跳不断流、EOF 合成
