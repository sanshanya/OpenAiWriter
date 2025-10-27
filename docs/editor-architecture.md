## Plate 编辑器骨架速览

- **插件唯一真源**  
  所有行为插件统一在 `components/editor/plugins/index.tsx` 汇总，并由 `PlateEditor` 通过 `usePlateEditor` 引入，确保配置集中、顺序可控。

- **渲染组件映射**  
  块级节点与行内标记分别位于 `components/ui/*` 下，通过 `withComponent` 或 `configure({ node: { component } })` 绑定；SSR/只读场景使用 `Base*` 版本保持一致的渲染语义。

- **编辑器外壳**  
  `components/ui/editor.tsx` 提供容器、布局样式与占位符逻辑，`PlateEditor` 保持受控模式（本地状态 + `onChange`），便于后续接入持久化或协同能力。

- **设置层**  
  `components/editor/settings/*` 将可选插件封装为上下文与控制面板，使 `PlateEditor` 可在运行时构建插件列表。当前仅展示核心插件说明，待引入扩展能力后再开放开关。

- **本地持久化**
  通过 [`hooks/use-documents.tsx`](../hooks/use-documents.tsx:1) 提供的 `DocumentsProvider` 托管多文档草稿，采用内存 Map 为唯一真源的架构：
  - **内存 Map**：所有文档的完整数据（唯一真源）
  - **React state**：从 Map 派生，仅用于触发 UI 重渲染
  - **localStorage**：同步持久化（快速、可靠）
  - **IndexedDB**：异步持久化（完整、大容量）
  - **版本控制**：每次编辑递增 version，合并时选择版本更高的记录
  
  详见 [`storage-design-v2.md`](storage-design-v2.md) 和 [`storage-fix-summary.md`](storage-fix-summary.md)。

- **页面承载**  
  `app/page.tsx` 控制三栏布局与功能区预留，保持业务布局与编辑器逻辑松耦合，便于后续向左右栏挂接设置、AI 面板等能力。左侧预留文档列表卡片区，并通过按钮唤起插件设置浮窗，避免占用持久化文件视图空间。
