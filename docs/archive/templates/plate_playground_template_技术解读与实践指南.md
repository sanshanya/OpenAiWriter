# Plate & Playground Template 技术解读与实践指南

> 面向 AI 写作前端的落地手册：理解理念 → 对号入座 → 快速改造。

---

## 摘要（TL;DR）

- **Plate**：基于 Slate 的增强套件，核心是**插件化（Composition）**、**Headless 分层**与**Open Code（组件代码归你所有）**。同一功能由“行为插件”+“渲染组件”拼装，强类型驱动，规则（break/delete/merge/normalize）集中配置。
- **plate-playground-template**：Next.js App Router + Plate 全家桶 + shadcn/ui + Tailwind（新工作流）+ AI（服务端路由）+ UploadThing 的**实践模板**。适合把 AI 写作编辑器快速跑通，再“按需精简”。
- 用这份文档你可以：
  1. 在仓库内**迅速定位**要改的地方；
  2. 按清单开启/关闭能力；
  3. 用最小变更把 AI/导入导出/样式/性能调好。

---

## 适用场景

- 从零搭**AI 写作编辑器**（生成、润色、重写、摘要、纠错、Copilot 补全）。
- 在模板上**按需精简**功能并统一样式体系。
- 碰到具体问题时，**对号入座**到仓库对应文件（见“导航清单”）。

---

## 一、Plate 的核心理念（对 AI 写作最关键的点）

1. **Open Code（代码所有权）**：UI 组件可复制到项目内，随意改造，不被黑盒依赖锁死。
2. **Headless + Composition**：行为（插件）与视图（组件）解耦。插件可 `configure/extend`，全局也可通过 `createPlateEditor({ components })` 映射渲染。
3. **API / Transforms 分层**：
   - `editor.api.*`：查询/工具，不改状态。
   - `editor.tf.*`（transforms）：改状态的操作，未来易于挂中间件与 DevTools。
4. **规则化交互**：用 `rules.break/delete/merge/normalize/...` 统一“回车/删除/拆分/合并/规范化”等常见行为，避免把逻辑散落在事件回调里。
5. **强类型 Schema**：为元素/文本标记建立显式类型，获得 IDE 自动补全和编译期约束；多编辑器场景可通过 Controller/Hooks 精细控制重渲染。

---

## 二、plate-playground-template 概览

### 技术栈

- **Next.js App Router**（`src/app`）
- **React + Typescript**
- **Plate 插件家族**（basic-nodes、list、table、link、code-block、markdown、toc、media、mention、comment、dnd、floating、slash-command、suggestion 等）
- **UI/设计系统**：shadcn/ui、Radix、lucide-react、cmdk、Ariakit、sonner（toast）
- **样式**：Tailwind（新工作流，PostCSS 仅启 `@tailwindcss/postcss`）
- **AI**：服务端 route（OpenAI / Gateway 任选其一接入）
- **上传**：UploadThing（需要 token）

### 典型目录（示意）

```
src/
  app/
    editor/page.tsx          # 页面入口：挂 SettingsProvider + PlateEditor + Toaster
    api/
      ai/
        copilot/route.ts     # AI 服务端路由（模型、温度、超时、key 读取）
  components/
    editor/
      PlateEditor.tsx        # 编辑器主体（插件组合、菜单、工具栏、快捷键）
      settings/*             # SettingsProvider & UI 开关（启用/禁用功能）
      menus/*                # 浮动/右键/块菜单、Slash 命令
      toolbar/*              # 工具栏按钮集合
      plugins/*              # 各类插件封装（可选）
  lib/*                      # 工具函数（序列化/导出/粘贴转化等）
public/*                     # 资源
```

### 启动与环境变量

1. `pnpm install`
2. `cp .env.example .env.local`
3. `pnpm dev` → 打开 `/editor`

必备环境变量（按你接法二选一）：

- **直连 OpenAI**：`OPENAI_API_KEY`
- **经由 Gateway**：`AI_GATEWAY_API_KEY`（如果模板/团队走统一网关）
- **上传**：`UPLOADTHING_TOKEN`

> 建议先用 `OPENAI_API_KEY` 跑通，再切换 Gateway；避免两套同时混用。

---

## 三、按需精简（快速瘦身指南）

- **禁用不需要的插件**：到 `components/editor/settings` 或插件注册处把表格、数学、评论、Excalidraw 等先关掉。
- **精简 UI**：删掉未使用的 toolbar / menus 子模块；保留基础块（段落/标题/列表/链接/图片）即可。
- **打包体积**：采用**延迟加载**较重的模块（如表格/绘图/数学）。
- **样式统一**：将 shadcn/ui 的主题变量与 Tailwind 设计令牌统一，减少重复样式。

---

## 四、常见任务 → 去哪改（导航清单）

1. **AI 能力（模型/温度/系统提示/上下文）**

- 服务端：`src/app/api/ai/copilot/route.ts`（读取 key、选择模型、构造 messages、超时/中断处理）。
- 客户端挂载：`src/app/editor/page.tsx`（可追踪 AI 菜单/Copilot 接入点）。

2. **Slash 命令、新增菜单项/工具栏按钮**

- 位置：`components/editor/menus/*`、`components/editor/toolbar/*`
- 做法：新增命令 → 绑定到 `editor.tf.*` 或 `editor.api.*` → 插到菜单/工具栏。

3. **Markdown / DOCX / PDF 导入导出**

- 位置：`lib/serialize/*` / `components/editor/actions/*` / toolbar 中的导入导出按钮。
- 依赖：`@platejs/markdown`、`@platejs/docx`、`pdf-lib`。

4. **媒体上传（图片/视频/音频/Embed）**

- 位置：与 `@platejs/media` 相关的 action；UploadThing 的 server/client 片段；确保 `UPLOADTHING_TOKEN` 正确。

5. **键盘与编辑规则**

- 位置：注册编辑器时的 `rules.*` 配置（回车/删除/合并/归一化）。

6. **多编辑器与焦点管理**

- 位置：`PlateController`、`useEditor*` Hooks；用来识别活跃编辑器与减少重渲染。

---

## 五、示例代码片段

> 仅供结构参考，按你项目/依赖版本实际调整。

**页面入口（`src/app/editor/page.tsx`）**

```tsx
export default function EditorPage() {
  return (
    <div className="h-screen" data-registry="plate">
      <SettingsProvider>
        <PlateEditor />
        <Toaster />
      </SettingsProvider>
    </div>
  );
}
```

**编辑器主体（`components/editor/PlateEditor.tsx`）**

```tsx
import { createPlateEditor, Plate } from "@platejs/core";
import {
  createParagraphPlugin,
  createHeadingPlugin,
  createBoldPlugin,
  createItalicPlugin,
  createListPlugin,
  // ...按需引入
} from "@platejs/plugins";

export function PlateEditor() {
  const editor = useMemo(
    () =>
      createPlateEditor({
        plugins: [
          createParagraphPlugin(),
          createHeadingPlugin(),
          createBoldPlugin(),
          createItalicPlugin(),
          createListPlugin(),
          // rules: 在这里集中配置回车/删除/合并策略
        ],
        components: {
          // 这里将元素类型映射到你的 UI 组件（shadcn/ui / Tailwind）
        },
      }),
    [],
  );

  return (
    <Plate editor={editor}>{/* 工具栏 / 菜单 / 浮动面板 / 状态栏等 */}</Plate>
  );
}
```

**AI 路由（`src/app/api/ai/copilot/route.ts`）**

```ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: Request) {
  const {
    messages,
    apiKey,
    model = process.env.AI_MODEL ?? "gpt-4o-mini",
  } = await req.json();
  const client = new OpenAI({ apiKey: apiKey || process.env.OPENAI_API_KEY });

  try {
    const completion = await client.chat.completions.create({
      model,
      messages,
      temperature: 0.7,
      stream: false,
    });
    return NextResponse.json(completion.choices[0]);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "AI request failed" },
      { status: 500 },
    );
  }
}
```

---

## 六、调试 & 排错（常见坑位）

1. **Tailwind（新工作流）**：`postcss.config.mjs` 一般只配置 `@tailwindcss/postcss`。如果你把旧版 v3 的 PostCSS/内容扫描方案拷进来，可能报样式失效或构建告警。
2. **AI 环境变量混用**：README 可能同时出现 `AI_GATEWAY_API_KEY` 与 `OPENAI_API_KEY`，实际你的 `route.ts` 使用哪一个，就只填哪一个。先直连跑通再考虑网关。
3. **HTML 序列化样式缺失 / Invalid hook call**：常见于在 React 树外调用序列化或没有正确注入全局样式。把序列化放到合适层级，并确保样式在 SSR/CSR 都注入。
4. **Node ID / DnD / TOC**：很多块级特性依赖稳定的 node id。若你禁用了 ID 插件或自定义生成器，请确认依赖链（拖拽/目录/评论定位）。
5. **SSR Hydration 差异**：浮动菜单/portal 组件在 SSR 下需要小心处理，必要时仅在 CSR 渲染。

---

## 七、升级与版本管理

- **锁定大版本**：新拉项目先锁住 Plate / Next / React 的主版本，避免团队成员无意升级导致破坏。
- **升级流程**：读 changelog → 升级核心包 → 运行 demo → 覆盖 e2e 用例（回车/删除/粘贴/选区/导出）→ 再升级周边插件。
- **Breaking Changes 常见类型**：插件注册顺序、组件覆盖点、规则字段更名、AI SDK API 变动。

---

## 八、性能与可观察性

- **减少重渲染**：使用 `useEditor*` Hooks 只订阅必要片段；将大型菜单/面板懒加载。
- **批量变更**：将多步编辑操作组合为单个 transform，降低历史记录碎片与重绘次数。
- **埋点**：在 AI 调用、导入导出、媒体上传等关键路径添加日志；在 `route.ts` 捕获耗时与错误码。

---

## 九、安全与合规

- **密钥管理**：服务端路由读取密钥，前端不直曝；可支持“请求体携带 key（仅开发调试）”。
- **上传白名单**：限制 UploadThing 的 MIME/文件大小；对外链 embed 做域名白名单。
- **XSS/粘贴**：自定义粘贴管道，过滤危险 HTML；Markdown → Slate 的转换保守处理。

---

## 十、Codex（代码搜索）使用建议

> 目标：**更快地在仓库中“对号入座”**。

**常用搜索锚点**

- 页面入口：`src/app/editor/page.tsx`
- AI 服务端：`src/app/api/ai/copilot/route.ts`
- 编辑器主体：`components/editor/PlateEditor.tsx`
- 菜单/工具栏：`components/editor/(menus|toolbar)/*`
- 设置开关：`components/editor/settings/*`
- 导入导出：`lib/serialize/*`、`components/editor/actions/*`

**示例查询（ripgrep / Codex）**

```bash
rg "createPlateEditor\(|new Plate\(" -n src
rg "slash|cmdk" -n src/components/editor
rg "@platejs/(table|markdown|docx|media)" -n
rg "UPLOADTHING|OPENAI_API_KEY|AI_GATEWAY_API_KEY" -n
rg "rules\.(break|delete|merge|normalize)" -n src
```

**问题到文件的快速映射**

- “**AI 菜单改模型/温度**” → `api/ai/copilot/route.ts`
- “**Slash 新增一个指令**” → `components/editor/menus/*` + `editor.tf.*`
- “**表格合并单元格出错**” → 搜 `@platejs/table` 的使用位置 + 对应 toolbar action
- “**导出 DOCX 样式丢失**” → `@platejs/docx` 调用处 + 全局样式注入
- “**按回车不符合预期**” → `rules.break` 配置 + 插件注册顺序

---

## 附录：最小骨架（可作为你项目的起点）

```
src/app/editor/page.tsx
src/app/api/ai/copilot/route.ts
src/components/editor/PlateEditor.tsx
src/components/editor/toolbar/BasicToolbar.tsx
src/components/editor/menus/BasicMenus.tsx
src/components/editor/settings/SettingsProvider.tsx
lib/serialize/markdown.ts
lib/serialize/docx.ts
postcss.config.mjs
```

> 以上骨架 + 基础插件（paragraph/heading/bold/italic/list/link）即可形成可用的 AI 写作编辑器雏形；后续按需加表格、媒体、评论、目录、导出等模块。

---

### 结束语

如果你在模板上遇到具体问题，把**现象 + 期望 + 相关文件路径**告诉我，我会沿着“导航清单”直接下到仓库对应位置给你改法与补丁片段。

---

## 增补：与官方模板的对齐实践（基于本仓库阶段性改造）

以下内容总结把模板方案“先肥后瘦”落地到实际项目的关键动作与踩坑点，可作为后续扩展/裁剪的执行手册。

### 1) Kit 对齐与目录规划

- 统一在 `components/editor/plugins/index.tsx` 维护 `pluginKits`，将能力分为 `core/markdown/system`，并通过设置层动态开关。
- SSR/只读渲染使用 Base 套件：例如 `BaseMediaKit`、`BaseTocKit`，与编辑态保持一致语义。
- 维护一份对齐追踪表以防“漂移”：见 `docs/kit-diff.md`（记录相对官方的差异）。

### 2) UI 同步策略（shadcn 资源）

- 复杂能力需“行为插件 + UI 组件”一并引入，使用：`npx shadcn@latest add https://platejs.org/r/<resource>`。
- 典型资源：`media-*-node`、`equation-node`、`link-toolbar`、`slash-node`、`table-node`、`inline-combobox` 等。
- 新增/裁剪时务必同步三处文档：`docs/plugin-workflow.md`、`docs/markdown-plugin-coverage.md`、`docs/kit-diff.md`。

### 3) Markdown 体验：解析与输入法

- 解析（粘贴/导入）统一走 `MarkdownPlugin`：见 `components/editor/plate-editor.tsx`；若反序列化后仍为纯文本则放行默认粘贴。
- 输入法（Autoformat）使用官方完整规则：标记（`**/__/*/_/~~/\`` 等）+ 块级（`#~######`, `>`, ``` ``` , `---`）+ 列表/任务（`\* - +`、`1.`、`[]/[x]`）。

### 4) Slash 命令与 transforms 集中

- 运行时插件：`components/editor/plugins/system/slash-kit.tsx`；UI：`components/ui/slash-node.tsx`。
- 行为集中在 `components/editor/transforms.ts`，Slash 菜单条目只调用 `insertBlock/insertInlineElement`；新增/裁剪命令时仅改 `groups` 与 transforms。

### 5) 媒体套件：全量/只读成对

- 编辑态：`components/editor/plugins/markdown/media-kit.tsx` 采用官方全量 Image/Video/Audio/File/Embed/Placeholder/Caption，并挂接 `media-preview-dialog`、`media-upload-toast` 等 UI。
- 只读态：`components/editor/plugins/markdown/media-base-kit.tsx` 保证 SSR 与导出路径一致。

### 6) 链接/代码块/列表/表格的 UI 拉齐

- 链接：`components/editor/plugins/markdown/link-kit.tsx` 绑定 `LinkElement` 与 `LinkFloatingToolbar`。
- 代码块：`components/editor/plugins/markdown/code-block-kit.tsx` 绑定 `CodeBlockElement/Line/Syntax` 与 `lowlight`，并加快捷键。
- 列表：`components/editor/plugins/markdown/list-kit.tsx` 复用 `IndentKit` 与 `components/ui/block-list.tsx`，支持待办 checkbox。
- 表格：`components/editor/plugins/markdown/table-kit.tsx` 绑定 `components/ui/table-node.tsx`。

### 7) 样式与滚动色差

- 编辑容器与内容层统一底色（如 `bg-neutral-50`）可避免滚动色差：见 `components/ui/editor.tsx`。

### 8) 常见报错与修复归档

- `SuggestionPlugin` 未启用：调用 `editor.getApi(SuggestionPlugin)` 需做可选链防御，示例见 `components/editor/transforms.ts`。
- “Cannot access refs during render”：避免在渲染期读取 `ref.current`，将逻辑放到事件/Effect。

### 9) 快速核对清单

- 行为插件与 UI 是否同时引入？
- kit 是否登记到 `pluginKits` 且设置了 `enabledByDefault`？
- 粘贴/导入是否走 Markdown 解析？
- Slash 行为是否集中在 `components/editor/transforms.ts`？
- `workflow/coverage/alignment` 三处文档是否已同步？
