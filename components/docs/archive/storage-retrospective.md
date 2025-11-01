
# Stage5 持久化迭代复盘

> 视角：Stage5 前端本地持久化方案的设计、演进、失败点

## 1. 设计目标回顾

- **无感编辑**：用户输入不被打断、切换文档不会丢失。
- **双层缓存**：`IndexedDB` 为主、`localStorage` 兜底，未来再对接后端权威库。
- **可扩展**：为后端/协同预留 `version`、`block` 级别的扩展空间。

现实情况：前端多次改动导致流程复杂化，最终仍存在「首屏无法编辑」「切换/新建丢失」等致命问题。

## 2. 当前存储流程梳理

> 截至最近一次改动，实际运行中的数据流。

- **初始化**  
  - SSR 输出仍是默认初始文档（`Basic Editor`）。  
  - 客户端挂载后，`DocumentsProvider` 先运行 `getCachedDocuments()`，从 `localStorage` 读取所有文档，按 `updatedAt` 排序，填充内存 Map + React state。若缓存为空，则创建一篇全新文档并立即持久化。  
  - 随后异步调用 `listStoredDocuments()` 读取 IndexedDB，再与内存 Map 做 `mergeRecords()`（按 `version`→`updatedAt` 决定胜出）。合并后的结果再更新 state。

- **编辑流程**  
  - `updateDocumentContent` 克隆当前 `Value`、计算 Title 与 `version`（自增），更新内存 Map 与 React state，同时写入 `lastSnapshotRef`。  
  - 保存采用 400ms 防抖：任务触发后记录 `queuedDocumentId`，超时后从 Map 取最新文档，调用 `saveStoredDocument()`（先写 `localStorage`，再尝试写 IndexedDB）。

- **切换文档**  
  - 调用 `flushPendingSave()` 等待防抖写入完成。  
  - 如果目标文档在内存 Map 中，直接读取；否则调用 `getStoredDocument()`。该函数先读 `localStorage`，再读 IndexedDB，根据 `version/updatedAt` 选择较新者并可能反向同步。  
  - 选中文档后更新 state 和 `activeDocumentRef`。

- **新建/删除**  
  - 新建：flush → 创建新文档 → Map + state 更新 → 立即持久化。  
  - 删除：flush → 删除 Map、`localStorage`、IndexedDB 项 → 选择剩余文档或重新建一个。

总体结构可视化：

```
React State (documents, activeDocument)
         ↑             ↓
内存 Map (documentsMapRef) ── lastSnapshotRef ── queuedDocumentIdRef
         │             │
      saveStoredDocument() ──▶ localStorage ──▶ IndexedDB (异步)
         │
         └──── listStoredDocuments()/getStoredDocument() ←─ 合并/回填
```

## 2. 演进时间线

1. **Stage4**：仅保存单篇文档于 `localStorage`，未考虑多文档、版本。
2. **Stage5.0（初稿）**：新增 `DocumentsProvider` + IndexedDB；切换时重新从数据库拉取整篇文档。
3. **Stage5.1**：引入 `lastSnapshotRef` 避免循环写；仍是「整篇覆盖」模型。
4. **Stage5.2**：为了避免刷新丢失，保存顺序变为「先写 localStorage，再写 IndexedDB」，并在切换时重新读取存储。
5. **Stage5.3**：尝试内存 Map、`version` 字段、`flushPendingSave`，但初始化与合并逻辑愈发复杂，首屏/切换再次失效，产生 Hydration 与状态漂移。

## 3. 主要缺陷与失败原因

### 3.1 架构层面

- **状态来源过多**：内存 Map、`documents` 状态、`activeDocument`、`localStorage`、IndexedDB 同时可写，却缺乏单一真源。
- **未区分「展示数据」与「持久化快照」**：React 状态与持久化快照互相覆盖，切换/新建等操作不可预测。
- **版本策略滞后**：`version` 字段后加，没有贯穿保存管线，IndexedDB / localStorage 之间仍按时间戳覆盖。
- **同步时机不清晰**：满足「响应式 UI」与「异步保存」的边界没有定义，`flushPendingSave`、防抖等逻辑叠加后，复杂度飙升。

### 3.2 实现细节

- **Hydration 不一致**：首屏 SSR 返回初始标题，CSR 立即读取缓存导致标题不同；导致 React Hydration 警告、DOM 重建。
- **切换丢失**：切换前 `flushPendingSave` 仍可能等待异步写入；与此同时 `selectDocument` 又直接读取 IndexedDB 的旧值覆盖了内存快照。
- **新建覆盖旧文档**：新建文档后 `documents` 状态重排，但内存 Map 或快照没及时更新；触发 `setActiveDocument` 时落到旧引用。
- **重复写入**：多处 `saveStoredDocument`/`listStoredDocuments` 在短时间内并发，产生相同 ID 的重复条目。
- **错误处理缺乏策略**：IndexedDB 报错后回退 localStorage，但没有区分是瞬时错误还是数据损坏，恢复流程不可控。

### 3.3 用户体验

- 首页经常处于「loading」或不可编辑状态；需要手动刷新/切换插件才能启用。
- 切换文档时偶发抖动（光标丢失、内容归零）。
- 新建后返回旧文档，内容恢复到几秒前的版本，导致用户误以为数据丢失。

## 4. 当前方案的根本问题

1. **企图在前端同时维护「内存 + IndexedDB + localStorage + 未来后端」四份真源**，缺乏明确主次。
2. **没有固定的「状态迁移图」**：切换、新建、刷新到底应该执行哪些同步步骤？目前操作顺序依赖多个副作用，极易失控。
3. **版本粒度不够**：即便加了 `version` 字段，也只在内存中自增。持久化函数未根据版本做覆盖判定，IndexedDB 仍可能覆盖新版本。
4. **缺少离线/冲突策略**：设计时没有定义「保存失败」或「后台更新」时的行为，导致异常时只能 fallback 到旧实现。

## 5. 经验教训

- **先画状态图再写代码**：需要明确 UI 状态、内存快照、持久化层之间的流向与触发条件，避免副作用交叉。
- **一次只解决一个问题**：初版应该先确保「单文档可编辑、可保存、可切换」，再逐步加入版本、合并、后端对接。
- **版本策略要贯穿全链路**：一旦决定引入 `version`，所有保存/读取/合并函数都必须基于版本做判断，否则徒增复杂度。
- **SSR/CSR 一致性优先**：任何在客户端初始化时读取的动态数据都要与 SSR 输出保持一致，必要时在首屏渲染前注入快照。
- **缓存写入要么同步要么队列化**：当前「防抖 + flush」的做法不可控，建议采用明确的事务队列或直接使用 worker。
- **敏感信息隔离**：`.gemini/settings.json` 泄露 API key 的事件提醒我们确保开发工具配置不进入仓库。

## 6. 下一步建议

1. **重新定义状态机**：以「内存文档 Map」为唯一真源，任何 UI/持久化操作都围绕它展开；其余层仅消费或同步。
2. **引入快照变更序列**：记录每次 `updateDocumentContent` 的操作序列，方便合并、回放、冲突解决。
3. **设计对后端友好的版本方案**：确定整篇/块级的版本字段、ID 生成方式，以及客户端如何上报 `baseVersion`。
4. **分阶段重构**：先做最小可行版本（单文档可编辑 + 安全保存），再恢复多文档、再接后端。每一步都写自测用例。
5. **文档/流程同步**：随迭代更新 `docs/TODO.md` 与本复盘，保持团队共识，避免再次走入「调一处，崩全局」的循环。

---

若需继续推进 Stage5，请基于以上复盘重新规划：明确负责人、验收标准、回滚机制，并在引入后端前完成前端状态机重构。椋炲悕涓嶅啓 bug。

## 附录：不可编辑问题的演进与对策

| 时点 | 触发症状 | 原因定位 | 临时缓解措施 | 遗留影响 |
| ---- | -------- | -------- | ------------ | -------- |
| Stage5 初期 | 首屏无法输入 | `PlateEditor` 每次 `activeDocument` 变化都 `setValue`，即便是用户输入后的同一快照 | 引入 `lastSnapshotRef`，仅在快照差异时写入 | 切换文档仍可能回放旧值 |
| Stage5 中期 | 导入文档后刷新回到初始内容 | 保存顺序为先写 IndexedDB，刷新时 localStorage 仍为旧数据 | 改为先写 localStorage 再写 IndexedDB | IndexedDB 返回空数组会覆盖缓存 |
| Stage5 之后 | 首页需切换插件才能编辑 | 初始化时在 effect 中创建文档 → SSR/CSR 数据不一致，编辑器始终处于 loading | 在 provider 中同步创建初始文档并写入快照 | 切换/新建仍读取旧快照覆盖 |
| 近期 | 切换/新建后内容消失 | `flushPendingSave` 等待期间 `selectDocument` 读取 IndexedDB 旧版本覆盖内存 | 重写 provider，引入内存 Map、版本字段 | 逻辑过重，首屏/切换再次失效 |

**始终如一的经验**

1. 不可编辑的根因是 **保存与回放复用了一套管线**，导致“最新输入”被当成“旧快照”回写。需要把“UI 输入”与“外部更新”拆分。
2. 首屏 SSR 与 CSR 必须使用同一个数据快照；否则 Hydration 失败会放大所有问题。
3. 切换/新建前务必先固化当前内存状态，不要依赖异步保存完成或直接回读持久层。

## 给后续接手者的建议【失败者的建议，不看也罢】

1. **先重建最小可用版本**  
   - 目标是「单篇文档可编辑、可保存、刷新后不丢失」。暂时忽略多文档和版本合并，把 `DocumentsProvider` 简化到只有内存 + localStorage。确保这一层稳定后再扩展。

2. **写出明确的状态机/时序图**  
   - 在代码重构前，确定“初始化 → 编辑 → 切换 → 保存 → 刷新”全过程的状态转移。明确每个动作读/写哪些层，哪些操作必须串行。并长驻文档。

3. **拆分 UI 与持久化职责**  
   - 将「编辑器内的即时状态」与「持久化队列」解耦。可以考虑建立一个 `DocumentStore`（只在内存中管理文档、版本、dirty flag），再由一个单独的 `PersistenceWorker` 负责与 IndexedDB/后端交互。

4. **为版本与冲突留接口但不要提前实现复杂逻辑**  
   - 保留 `version` 字段、准备 `changeSet` / `ops` 的数据结构，但先用最简单的递增策略。当后端或协同编辑需求明确后，再扩展为块级版本或 CRDT，避免过早优化。

5. **文档同步更新**  
   - 后续任何架构调整、字段定义、保存流程，都应同步补充到本文件以及 `docs/editor-architecture.md`，保持团队共识。
