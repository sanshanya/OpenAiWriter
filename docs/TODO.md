# AI Writer Frontend - Iteration Roadmap

## Stage 1: Core Scaffolding & Basic AI Integration

This initial phase focused on establishing the project's core structure and integrating a foundational AI capability. Key achievements include:

- **Project Identity:** Adjusted `README.md` and `app/layout.tsx` to define the project as an "AI Writer Frontend."
- **AI Interaction MVP:** Implemented a basic AI panel UI and connected it to a simple backend API route (`/api/ai/helper/route.ts`) for initial text generation, proving out the end-to-end workflow.

## Stage 2: Configuration, UX, and Persistence

Building on the MVP, this stage enhanced the editor's flexibility and user experience:

- **Plugin Framework:** Refactored editor plugins into `core` and `optional` categories, managed via a new settings panel, allowing for a configurable user experience.
- **AI UX Refinement:** Improved the AI interaction loop with loading indicators, cancellation, retry logic, and result copying to provide clear user feedback.
- **Content Persistence:** Implemented local storage to save and restore editor content automatically, ensuring user work is not lost between sessions. A manual QA checklist was created to validate core interactions.

---

## Stage 3: WYSIWYG Markdown Integration

This stage focused on integrating a seamless, real-time Markdown editing experience. All planned features, including the installation and integration of Markdown plugins, dynamic plugin enable/disable management, and verification of the WYSIWYG experience, have been successfully completed. This includes the proper integration of Blockquote and Horizontal Rule plugins.

---

## Stage 4: Native AI Assistant (Copilot-style) Implementation

This stage transitions from a separate AI panel to a deeply integrated, contextual AI assistant within the editor，现已完成流式 Copilot、Command 与 Helper，并接入 DeepSeek/OpenAI 兼容模型。

### Preparation Phase: Environment Setup & Configuration

- [X] **Environment Variable Management**:
  - [X] Set `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`, and `DEEPSEEK_MODEL` in the created `.env.local` file.
- [X] **Dynamic AI Configuration**:
  - [X] Implemented logic in the created `lib/ai/config.ts` module to dynamically resolve the API key, base URL, and model ID, prioritizing environment variables. This completes a flexible configuration layer that allows overriding settings per request.

### Main Tasks

#### 1. Configure `CopilotKit` for Inline Suggestions

- [X] **`components/editor/plugins/ai/copilot-kit.tsx`**：
  - `/api/ai/copilot` 已接入真实流式补全，`getPrompt` 仅序列化当前 block 并截取最后 600 字符。
  - `onFinish` 调用 `api.copilot.setBlockSuggestion`，`onError` 会停止请求并记录错误，快捷键保持与官方一致。

#### 2. Configure `AIKit` for Chat and Commands

- [X] **`components/editor/plugins/ai/ai-kit.tsx`**：
  - `chatOptions.api` 指向 `/api/ai/command`，transport 会合并自定义 body。
  - `useChatChunk` 已串联流式插入、编辑模式替换以及评论工具。

#### 3. Wire up the Plugins in `plate-editor.tsx`

- [X] `CopilotKit` 与 `AIKit` 通过 `useEditorKit` 聚合进入插件数组，并由 `Ctrl+Space` 触发补全。

#### 4. Create and Verify AI API Routes

- [X] **`app/api/ai/copilot/route.ts`**：DeepSeek/OpenAI 兼容流式接口，处理上下文压缩与错误兜底。
- [X] **`app/api/ai/command/route.ts`**：基于 `createUIMessageStream`，支持工具选择、评论流式返回。
- [X] **`app/api/ai/helper/route.ts`**：AI 面板流式输出，按模式注入 system 提示。

#### 5. Test the Integration

- [X] **Bug:** “Ask AI Anything” 输入未触发翻译/生成，只发送 POST（已修复）
- [X] **DeepSeek JSON 优化（评论工具）**：增强 fallback prompt，并通过多轮 JSON 解析策略自动修复 DeepSeek 返回的半结构化内容。

### Architecture Refactoring

- [X] **`components/editor/editor-kit.tsx`**：已抽离插件装配与编辑器创建逻辑。
- [X] **`hooks/use-documents.tsx`**：新增文档上下文，统一管理多文档列表、激活文档与本地持久化。
- [X] **`hooks/use-editor-hotkeys.ts`**：已抽离补全快捷键绑定，便于后续扩展。
- [X] **`plate-editor.tsx` 精简**：通过 DocumentsProvider + Hooks 收敛持久化与快捷键逻辑，仅保留粘贴处理与渲染。

### 类型集中管理（新增）

- [ ] `types/plate-elements.ts`：整理当前项目启用插件的 Plate 节点/文本类型，作为类型真源，新增/裁剪插件时同步维护。

---

## Stage 5: 本地持久化基线巩固

> 目标：保持纯前端方案稳定可靠，为后续后端化迭代奠定基线。

- [X] `hooks/use-documents.tsx` + `lib/storage` Facade，IndexedDB 为主、localStorage 兜底。
- [X] `types/storage.ts`、`lib/storage/constants.ts` 建立类型/常量真源。
- [X] 文档整合：`docs/architecture/storage-overview.md` 汇总现状，历史方案归档至 `docs/archive/legacy-storage/`。

---

## Stage 6: 服务化与架构升级（规划中）

> 目标：把关键业务从前端抽离，形成 React 前端 + Rust 服务的现代架构，为桌面/Web 双线预留空间。




### 6.1.1 编辑器绑定（Plate ↔ Y.Doc）

<pre class="overflow-visible!" data-start="1114" data-end="1961"><div class="contain-inline-size rounded-2xl relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-tsx"><span><span>// components/editor/use-yjs-editor.ts</span><span>
</span><span>import</span><span> * </span><span>as</span><span> Y </span><span>from</span><span></span><span>'yjs'</span><span>;
</span><span>import</span><span> { useEffect, useMemo } </span><span>from</span><span></span><span>'react'</span><span>;
</span><span>import</span><span> { withTYjs, </span><span>YjsEditor</span><span> } </span><span>from</span><span></span><span>'@platejs/yjs'</span><span>;
</span><span>import</span><span> { </span><span>IndexeddbPersistence</span><span> } </span><span>from</span><span></span><span>'y-indexeddb'</span><span>;
</span><span>import</span><span> { createPlateEditor } </span><span>from</span><span></span><span>'@udecode/plate-common'</span><span>; </span><span>// 依你项目导入</span><span>

</span><span>export</span><span></span><span>function</span><span></span><span>useYjsEditor</span><span>(</span><span>docId: string</span><span>) {
  </span><span>const</span><span> editor = </span><span>useMemo</span><span>(</span><span>() =></span><span></span><span>withTYjs</span><span>(</span><span>createPlateEditor</span><span>(), </span><span>new</span><span> Y.</span><span>XmlFragment</span><span>(</span><span>'content'</span><span>)), []);

  </span><span>useEffect</span><span>(</span><span>() =></span><span> {
    </span><span>const</span><span> ydoc = </span><span>new</span><span> Y.</span><span>Doc</span><span>();
    </span><span>// 以项目名作为命名空间，避免冲突</span><span>
    </span><span>const</span><span> provider = </span><span>new</span><span></span><span>IndexeddbPersistence</span><span>(</span><span>`OpenAiWriter:doc:${docId}</span><span>`, ydoc);
    </span><span>const</span><span> ycontent = ydoc.</span><span>getXmlFragment</span><span>(</span><span>'content'</span><span>);

    </span><span>YjsEditor</span><span>.</span><span>connect</span><span>(editor, ycontent);

    </span><span>return</span><span></span><span>() =></span><span> {
      </span><span>YjsEditor</span><span>.</span><span>disconnect</span><span>(editor);
      provider.</span><span>destroy</span><span>?.();
      ydoc.</span><span>destroy</span><span>();
    };
  }, [editor, docId]);

  </span><span>return</span><span> editor;
}
</span></span></code></div></div></pre>

<pre class="overflow-visible!" data-start="1963" data-end="2364"><div class="contain-inline-size rounded-2xl relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-tsx"><span><span>// components/editor/plate-editor.tsx</span><span>
</span><span>import</span><span> { useYjsEditor } </span><span>from</span><span></span><span>'./use-yjs-editor'</span><span>;
</span><span>import</span><span> { </span><span>Plate</span><span> } </span><span>from</span><span></span><span>'@platejs/editor/react'</span><span>;
</span><span>import</span><span> { plugins } </span><span>from</span><span></span><span>'./plugins'</span><span>; </span><span>// useMemo/模块顶层稳定化</span><span>

</span><span>export</span><span></span><span>function</span><span></span><span>PlateEditor</span><span>(</span><span>{ docId }: { docId: string</span><span> }) {
  </span><span>const</span><span> editor = </span><span>useYjsEditor</span><span>(docId);
  </span><span>return</span><span> (
    </span><span><span class="language-xml"><Plate</span></span><span></span><span>editor</span><span>=</span><span>{editor}</span><span></span><span>plugins</span><span>=</span><span>{plugins}</span><span>>
      </span><span><EditorInstance</span><span> />
    </span><span></Plate</span><span>>
  );
}
</span></span></code></div></div></pre>

> 注：彻底移除 `value/initialValue`，视图“非受控”，SoT=Y.Doc。

---

### 6.1.2 旧 JSON → Y.Doc 单次迁移（Seed）

<pre class="overflow-visible!" data-start="2456" data-end="2861"><div class="contain-inline-size rounded-2xl relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-ts"><span><span>// lib/yjs/seed.ts</span><span>
</span><span>import</span><span> * </span><span>as</span><span> Y </span><span>from</span><span></span><span>'yjs'</span><span>;
</span><span>import</span><span></span><span>type</span><span> { </span><span>MyValue</span><span> } </span><span>from</span><span></span><span>'@/types/plate-elements'</span><span>;

</span><span>// 将旧的 Slate JSON 注入到 Y.XmlFragment('content')</span><span>
</span><span>export</span><span></span><span>function</span><span></span><span>seedJsonIntoYDoc</span><span>(</span><span>ydoc: Y.Doc, json: MyValue</span><span>) {
  </span><span>const</span><span> frag = ydoc.</span><span>getXmlFragment</span><span>(</span><span>'content'</span><span>);
  </span><span>if</span><span> (frag.</span><span>length</span><span>) </span><span>return</span><span>; </span><span>// 已有内容则不覆盖</span><span>
  </span><span>// 这里调用 plate-yjs 的工具（若提供），或自行把 JSON 转换为 Y 结构</span><span>
  </span><span>// 简化策略：在首次挂载前，用临时 Plate 实例将 JSON 应用到 Y（按官方示例）</span><span>
}
</span></span></code></div></div></pre>

接入点：在 `useYjsEditor(docId)` 中，`IndexeddbPersistence` ready 后，如果 `frag` 为空而 storage 层存在旧 JSON，就调用 `seedJsonIntoYDoc`，并标记“已迁移”。

---

### 6.1.3 Meta 更新（Y → Zustand）

<pre class="overflow-visible!" data-start="3026" data-end="3617"><div class="contain-inline-size rounded-2xl relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-ts"><span><span>// lib/yjs/hooks.ts</span><span>
</span><span>import</span><span> { useEffect } </span><span>from</span><span></span><span>'react'</span><span>;
</span><span>import</span><span> * </span><span>as</span><span> Y </span><span>from</span><span></span><span>'yjs'</span><span>;
</span><span>import</span><span> { useDocsState } </span><span>from</span><span></span><span>'@/state/docs'</span><span>;
</span><span>import</span><span> { saveMetasDebounced } </span><span>from</span><span></span><span>'@/lib/storage/meta-cache'</span><span>; </span><span>// 你已有/轻量新增</span><span>

</span><span>export</span><span></span><span>function</span><span></span><span>useYDocMetaBridge</span><span>(</span><span>docId: string</span><span>, ydoc: Y.Doc) {
  </span><span>const</span><span> setMeta = </span><span>useDocsState</span><span>(</span><span>s</span><span> => s.</span><span>setMeta</span><span>);
  </span><span>useEffect</span><span>(</span><span>() =></span><span> {
    </span><span>const</span><span></span><span>onUpdate</span><span> = (</span><span></span><span>) => {
      </span><span>const</span><span> now = </span><span>Date</span><span>.</span><span>now</span><span>();
      </span><span>setMeta</span><span>(docId, { </span><span>updatedAt</span><span>: now });
      </span><span>saveMetasDebounced</span><span>();
    };
    ydoc.</span><span>on</span><span>(</span><span>'update'</span><span>, onUpdate);
    </span><span>return</span><span></span><span>() =></span><span> ydoc.</span><span>off</span><span>(</span><span>'update'</span><span>, onUpdate);
  }, [docId, ydoc, setMeta]);
}
</span></span></code></div></div></pre>

> 仅更新 meta，不写正文；正文由 y-indexeddb 自己持久化。

---

### 6.1.4 Link 安全（保持现状）

* 不覆盖 `isUrl`，使用 Plate 默认；
* 仅保留 `transformInput/getUrlHref = sanitizeHref` 最小规范化（域名补 `https://`）；
* 渲染处兜底：非法降级 `<span>`。

---

## 迁移步骤（执行清单）

1. **剥离正文出 Zustand** ：`DocsState` 仅保存 `meta: Map<string, DocMeta>` 与 `activeId`。
2. **接入 Yjs** ：实现 `useYjsEditor` 并替换原 `<Plate initialValue>` 方式；确保 `plugins` 等稳定化。
3. **一次性 Seed** ：实现 `seedJsonIntoYDoc`，在首次打开发现 `frag` 为空且存有旧 JSON 时注入。标记 `migratedAt`。
4. **Meta 桥接** ：从 Y.Doc `update` 更新 `updatedAt`，调用 `saveMetasDebounced()`。
5. **移除旧内容写入** ：删除所有“写 JSON 到 IndexedDB”的路径（避免双写）；仅 meta 继续本地存。
6. **文档与注释** ：在 `/docs/architecture/editor-source-of-truth.md` 更新“SoT=Y.Doc”；在 `/docs/runbook/migrations.md` 记录“JSON→Yjs”一次性迁移流程与回滚策略。

---

## 回滚策略

* 导出/导入：提供“导出为 JSON 快照”的工具，用于紧急备份或诊断。
* 若发现 Yjs 边缘故障：关闭 seed 开关，读旧 JSON（只限开发调试，不建议线上）。
* 保持 meta 与内容解耦：回滚不影响侧边栏/列表渲染。

---

## 验收标准（DoD）

* 打开文档 A 输入内容 → 切到 B → 切回 A：看到刚才输入（无需刷新、离线也成立）。
* 断网编辑 → 重连后刷新：看到离线期间变更（y-indexeddb 生效）。
* 粘贴中文段落不变链接；`www.example.com` 自动补 `https://`。
* 侧栏更新时间即时刷新；不因正文输入而“全列表重渲染”。
* 性能：输入时无 “Maximum update depth exceeded”；切换文档仅单次挂载。

---

## 风险与对策

* **Yjs 学习曲线** ：先上本地 `y-indexeddb`，不碰协同，降低复杂度。
* **Seed 一次性正确性** ：只在 `frag` 为空时注入；注入后立即写入一个“迁移完成”标记（可存在 meta）。
* **依赖增长** ：新增 `yjs`、`y-indexeddb`、`@platejs/yjs`；锁版本，写入 ADR。

---

## 后续 6.2（展望）

* 接入 `y-websocket`（或自研 provider）实现云同步/协同；
* AI 后端直接操作服务端 Y.Doc（或发 Yjs update），前端自动收敛；
* 冲突与权限控制收敛到 provider 层，不再让编辑器/存储层背锅。

---

> 备注：把本段落标题与锚点写成 `## 6.1 正文真源迁移：接入 Yjs（离线优先）`，方便目录直达；并在 `/docs/README.md` 的“Stage 6”小节中插入链接。
>

### 6.2 AI 服务化

- [ ] 将 `/api/ai/*` 核心逻辑迁移到独立服务（首版可用 Rust + SQLite/LibSQL），统一提示词、调用与日志。
- [ ] 前端仅保留 UI 与流式消费逻辑，SDK 对接后端的 SSE/WebSocket。
- [ ] 建立基础监控：提示词审计、响应时间、错误率。

### 6.3 权威存储后端化

- [ ] 以 SQLite/LibSQL 验证文档模型（documents / revisions / assets），后续可平滑迁移至 PostgreSQL。
- [ ] 设计 OCC 保存流程：前端提交 → 后端校验 → 数据落库 → 推送增量；冲突返回 block 级 diff。
- [ ] 提供 CLI / DevTool 便于调试版本、冲突、审计数据。
- [ ] 结合 block 级结构，预研 Yjs 等 CRDT 方案以支撑协同。

### 6.4 协同与产品形态探索

- [ ] 评估 Tauri 桌面化 vs Web 持续迭代的路线，确定主攻方向。
- [ ] 规划资产与附件的统一上传/转换/打包方案。

---

## Backlog & UI/UX

- [ ] 解决 Markdown / HTML 混合粘贴失败问题。
- [ ] 导入导出能力（Markdown/HTML/多媒体）与服务化阶段同步推进。
