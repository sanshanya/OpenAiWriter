# 插件接入与维护流程

> 目标：借鉴 plate-playground-template 的 Kit 化实践，在保证“最小可行骨架”的前提下平滑引入新插件。

## 1. 统一思路

- **Kit 拆分**：每类能力对应一个 `*-kit.tsx`，内部返回插件数组，编辑器只负责拼装这些 kit。（自 Stage 3 起，`components/editor/plugins` 下分为 `core/` 与 `markdown/` 两大目录。）
- **中心化注册**：`components/editor/plugins/index.tsx` 维护 `pluginKits`，并暴露 `buildEditorPlugins()` 给 `PlateEditor`。
- **设置层管理**：所有可选插件在 `pluginKits` 中标记 `optional`，由 `EditorSettingsProvider` 与 `SettingsPanel` 控制开关。

## 2. 新插件接入步骤

1. **安装依赖 / 同步 UI 组件**
   ```bash
   pnpm add @platejs/<plugin>         # 行为插件
   pnpm add remark-xxx                # 若依赖 remark 生态
   pnpm add lucide-react …           # 若需要额外 UI
   npx shadcn@latest add https://platejs.org/r/<resource>  # Plate 官方提供的 UI / 控制组件
   ```
   > **注意**：Plate 大部分“复杂插件”都拆成“行为插件 + UI 资源”。务必通过上面的 `npx shadcn ...` 指令把对应 UI 拉到 `components/ui/`，不要手写精简版，否则容易缺失拖拽、Caption、工具栏等关键信息（例如 media-image-node、equation-node、media-toolbar）。
2. **创建 Kit**
   - 位置：`components/editor/plugins/<feature>-kit.tsx`
   - 内容：将官方插件 `configure/withComponent` 后导出数组，并写明快捷键、规则。
   - 若新能力需要复用复杂的“插入/切换”逻辑（如 Slash 命令），请把这些变换集中在 `components/editor/transforms.ts`，再让 UI 组件（`components/ui/*`）通过 `@/components/editor/transforms` 引用，避免在多个组件里散落相同代码。
3. **注册到 `pluginKits`**
   ```ts
   {
     id: 'slash',
     label: 'Slash 指令',
     category: 'system',
     optional: true,
     enabledByDefault: false,
     plugins: SlashKit,
   }
   ```
4. **更新设置 UI（可选）**：若需要额外提示或分组，在 `SettingsPanel` 中调整描述。
5. **验证**
   - `pnpm lint`
   - 运行 `pnpm dev`，按页面提示或自定义用例手测关键交互。未来迁移到 Playwright/Storybook 时补充自动化脚本。

## 3. 经验教训

- **类型与实例管理**：先用 `Kit → buildEditorPlugins()` 隔离类型，避免在 `PlateEditor` 中直接拼装 `SlatePlugin[]`。新插件引入后记得把 `usePlateEditor(..., [plugins])` 的依赖写全，否则运行中的编辑器不会热切换。
- **可选插件的默认状态**：任何可选能力都要设置 `enabledByDefault` 并在设置面板暴露开关，否则用户无法确认功能是否启用。
- **依赖与 UI 同步**：像 Markdown、媒体、Math、Slash 都需要 `@platejs/*` + shadcn 拉下来的 UI 组件。缺任一方都会导致渲染失败或指令报错。发现“粘贴失败/命令报错”时优先检查 UI 组件是否齐全。
- **粘贴 → 走 Markdown 解析**：不要再通过正则判断“是否 Markdown”，而是交给 `MarkdownPlugin` 解析，若结果仍是纯文本再放行。这样图像、Math、链接都能保持一致的解析路径。
- **Slash/复杂逻辑集中在 transforms**：所有命令插入行为统一写在 `components/editor/transforms.ts`，再由 UI 调用，避免逻辑散落在多个组件里。
- **保持小步迭代**：一次只引入或裁剪一类插件，配套“依赖 → kit → UI → 验证”四步走；不要同时改动多个区域，方便定位问题（遵循《AI生产实践指导.md》的最小化原则）。
