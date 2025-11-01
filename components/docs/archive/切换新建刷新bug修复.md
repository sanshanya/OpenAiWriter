# 切换/新建/刷新 Bug 最终修复方案

## 1. 问题根源

历经多次失败后，我们最终确认所有 Bug（无法编辑、切换/新建/刷新时数据丢失或覆盖）均源于同一个核心矛盾：**试图在 Plate.js 这个复杂的第三方组件上实现“完全受控”模式，但未能正确处理其内部状态与外部 React 状态的控制权冲突。**

具体表现为三个本质问题：
1.  **“无法编辑”的本质：** `onChange` 更新外部 State，触发 `useEffect`，`useEffect` 再调用 `editor.setValue` 更新编辑器，形成恶性循环。
2.  **“刷新后内容覆盖”的本质：** 首次渲染时，`editor` 实例带着“初始模板”内容被一次性创建，随后 `localStorage` 的正确内容才加载进 State，但为时已晚，且用户的第一次输入会将错误的“初始模板”内容覆盖回去。
3.  **“切换/新建数据丢失”的本质：** `setState` 是异步的，用户点击切换按钮时，由 `onChange` 触发的最新内容更新尚未完成，导致切换后丢失了最后几秒的编辑。

## 2. 最终解决方案：“延迟渲染 + Key切换”复合模式

我们放弃了“完全受控”的执念，回归到更简单、更符合 React 工作原理的模式。

### 2.1 延迟渲染 (解决刷新问题)

-   在 `hooks/use-documents.tsx` 中，不再导出 `status`，而是在 `useEffect` 从 `localStorage` 加载完成前，让 `activeDocument` 保持为 `null`。
-   在 `components/editor/plate-editor.tsx` 中，当 `activeDocument` 为 `null` 时，我们不渲染 `<Plate>` 组件，只显示一个加载指示。
-   **效果**：这确保了 `useEditorKit` (创建 `editor` 实例) 只有在拿到从 `localStorage` 加载完毕的、确定的文档内容后才会被调用。

### 2.2 Key 切换 (解决切换/新建问题)

-   当 `activeDocument` 加载完毕后，我们渲染的编辑器实例被包裹在一个组件中，并赋予其 `key={activeDocument.id}`。
-   **效果**：当用户切换或新建文档 (`activeDocument.id` 改变) 时，React 会自动销毁旧的编辑器实例，并创建一个全新的实例。这个新实例会带着新的、正确的 `initialValue`（来自新的 `activeDocument.content`）进行初始化，从而完美地加载了新文档的内容，且杜绝了任何状态污染。

### 2.3 异步ID切换 (解决快速切换数据丢失问题)

-   在 `hooks/use-documents.tsx` 的 `selectDocument` 函数中，我们将 `setActiveDocumentId(id)` 的调用包裹在 `setTimeout(..., 0)` 中。
-   **效果**：这个技巧利用事件循环，将“切换ID”这个动作推迟到下一个“tick”，从而给 React 留出足够的时间来完成当前“tick”中由 `onChange` 触发的最后一次内容更新和保存。这是防止数据丢失的最后一道保险。

## 3. 代码变更总结

-   **`hooks/use-documents.tsx`**:
    -   移除了 `status` 状态。
    -   在 `selectDocument` 中使用 `setTimeout` 包装 `setActiveDocumentId`。
-   **`components/editor/plate-editor.tsx`**:
    -   重构为“延迟渲染”模式，当 `activeDocument` 为 `null` 时显示加载状态。
    -   将编辑器实例封装在 `EditorInstance` 组件中，并使用 `key={activeDocument.id}` 来驱动重建。
-   **`app/page.tsx`**:
    -   移除了对 `status` 的依赖，改为通过 `!activeDocumentId` 来判断加载状态。

通过以上修复，我们最终实现了所有预期的功能：编辑器可正常编辑，且在切换、新建、刷新等所有场景下，数据持久化表现稳定、可靠。