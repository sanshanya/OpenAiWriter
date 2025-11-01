# Storage V2 重构复盘 - 失败者的自省

> 视角：Stage5 持久化第二次尝试的设计、实施与失败点分析

## 0. 前言

本文档记录了 Storage V2 重构的完整过程，包括设计思路、实施细节以及最终仍未解决的问题。作为失败者，我必须客观承认：**尽管进行了大量的架构设计和代码重构，核心问题仍然存在**。

本文档的目的是为后续接手者提供真实的经验教训，避免重复同样的错误。

## 1. 重构背景

### 1.1 V1 存在的问题（来自 storage-retrospective.md）

- **状态来源过多**：内存 Map、React state、localStorage、IndexedDB 四者同时可写，缺乏单一真源
- **未区分展示数据与持久化快照**：相互覆盖，切换/新建不可预测
- **版本策略滞后**：version 字段后加，未贯穿保存管线
- **Hydration 不一致**：SSR 与 CSR 数据不同步
- **切换丢失**：flushPendingSave 与 selectDocument 时序冲突
- **新建覆盖旧文档**：状态重排时内存 Map 或快照未及时更新

### 1.2 V2 的设计目标

1. **确立单一真源**：内存 Map 为唯一数据源
2. **清晰的数据流向**：用户输入 → 内存 Map → React state → 持久化层
3. **版本控制机制**：每次编辑递增 version，合并时自动选择版本更高的
4. **去重优化**：快照比较，相同内容不重复保存
5. **SSR/CSR 一致性**：初始 state 使用默认值，useEffect 中异步加载

## 2. V2 的设计与实施

### 2.1 架构设计

```
用户编辑
    ↓
updateDocumentContent
    ↓
更新内存 Map (version++)    ← 唯一真源
    ↓
更新 React state (派生)
    ↓
scheduleSave (防抖 400ms)
    ↓
saveStoredDocument
    ↓
localStorage (同步) → IndexedDB (异步)
```

### 2.2 核心实现

#### 版本控制
```typescript
function isNewerThan(a: StoredDocument, b: StoredDocument): boolean {
  if (a.version !== b.version) {
    return a.version > b.version;
  }
  return a.updatedAt > b.updatedAt;
}
```

#### 去重机制
```typescript
const snapshot = JSON.stringify(clonedValue);
if (lastSnapshotRef.current[activeDocumentId] === snapshot) {
  return;  // 内容未变化，跳过
}
```

#### 防抖保存
```typescript
scheduleSave(documentId) {
  clearTimeout(pendingSaveRef.current);
  pendingSaveRef.current = setTimeout(() => {
    saveStoredDocument(documentsMapRef.current.get(documentId));
  }, 400);
}
```

#### 切换文档流程
```typescript
async selectDocument(id: string) {
  await flushPendingSave();  // 1. 固化当前文档
  let document = documentsMapRef.current.get(id);  // 2. 从内存读取
  if (!document) {
    document = await getStoredDocument(id);  // 3. 从持久层加载
    documentsMapRef.current.set(id, document);
  }
  setActiveDocument(document);  // 4. 更新 state
}
```

### 2.3 SSR/CSR 一致性方案

```typescript
// 初始 state 使用默认值（与 SSR 一致）
const [activeDocument, setActiveDocument] = useState<DocumentRecord>(
  createDefaultDocument()
);

// useEffect 中异步加载缓存
useEffect(() => {
  const cached = getCachedDocuments();
  if (cached.length > 0) {
    applyDocumentState(cached);  // 用缓存替换默认值
  }
}, []);
```

### 2.4 持久化策略优化

```typescript
async function saveStoredDocument(document: StoredDocument) {
  // 1. 先写 localStorage（同步，快速）
  writeLocalDocument(document);
  
  // 2. 再写 IndexedDB（异步，可靠）
  try {
    await runDbRequest('readwrite', store => store.put(document));
  } catch (error) {
    // 失败不影响 localStorage，数据仍然安全
  }
}
```

## 3. V2 仍未解决的问题

### 3.1 切换/新建时缓存消失 ⚠️

**现象**：
- 用户编辑文档 A
- 切换到文档 B 或新建文档 C
- 再切换回文档 A，发现之前的编辑内容丢失

**可能的原因**：

1. **PlateEditor 与 use-documents 的快照不同步**
   - PlateEditor 维护 `appliedDocumentRef.current.snapshot`
   - use-documents 维护 `lastSnapshotRef.current[id]`
   - 两者可能不一致，导致去重逻辑失效

2. **onChange 与 切换的时序问题**
   - onChange 调用 `updateDocumentContent(value)` 立即更新内存 Map
   - 但防抖保存需要 400ms
   - 切换时虽然调用 `flushPendingSave()`，但可能与 onChange 有竞态

3. **内存 Map 更新后 state 未同步**
   - `updateDocumentContent` 更新了内存 Map
   - 但 `setDocuments` 和 `setActiveDocument` 可能延迟
   - 切换时读取的可能是旧的 state

4. **PlateEditor 的多余 useEffect**
   - 原本有两个 useEffect 监听 activeDocument
   - 虽然删除了一个，但第一个仍可能导致问题
   - 文档切换时会触发 setValue，可能覆盖正在编辑的内容

### 3.2 初始化显示 initvalue 而非缓存 ⚠️

**现象**：
- localStorage 中有缓存
- 刷新页面时仍显示默认的 "Basic Editor" 文档
- 需要等待异步加载才能看到缓存内容

**原因**：
- SSR/CSR 一致性方案的副作用
- 初始 state 使用默认文档（与 SSR 一致）
- 异步加载缓存后才替换，导致闪烁

**应该的行为**：
- 如果 localStorage 有缓存，应该直接使用缓存作为初始 state
- SSR 时返回默认值，CSR 时优先使用缓存
- 不应该让用户看到从默认文档切换到缓存文档的过程

### 3.3 IndexedDB 异步合并的竞态条件 ⚠️

**问题**：
- `listStoredDocuments()` 会异步读取 IndexedDB
- 读取期间用户可能正在编辑
- 合并时可能覆盖用户的最新编辑

**尝试的修复**：
```typescript
// 只更新版本更高的文档
for (const doc of merged) {
  const existing = documentsMapRef.current.get(doc.id);
  if (!existing || isNewerThan(doc, existing)) {
    documentsMapRef.current.set(doc.id, doc);
  }
}
```

**仍存在的问题**：
- 版本比较可能不准确
- `isNewerThan` 基于 version 和 updatedAt
- 但 version 只在保存时递增，编辑中的内容没有 version
- 可能错误判断哪个版本更新

### 3.4 防抖与 flush 的不可靠性 ⚠️

**问题**：
- 防抖 400ms 是为了减少写入频率
- 但切换时调用 `flushPendingSave()` 等待防抖完成
- 如果用户快速操作，可能来不及 flush

**实际表现**：
- 用户编辑 → 立即切换 → flush 等待 → 但此时内存 Map 可能已被覆盖
- 用户新建 → 立即切换回旧文档 → 旧文档内容可能是新建前的状态

## 4. 架构层面的根本缺陷

### 4.1 React 状态与编辑器状态的双重真源

**问题**：
- 我们试图让内存 Map 成为唯一真源
- 但 PlateEditor 有自己的内部状态
- 用户输入直接修改 PlateEditor 的状态
- onChange 回调才同步到 React state
- 两者之间存在延迟和不一致

**更本质的问题**：
- 编辑器的状态是 **即时的**（用户每次按键都改变）
- 持久化的状态是 **延迟的**（防抖 400ms 后保存）
- 切换文档时需要 **立即** 读取最新状态
- 但最新状态可能还在编辑器中，尚未同步到内存 Map

### 4.2 异步操作链的脆弱性

**问题链**：
1. 用户编辑 → PlateEditor 内部状态改变
2. onChange 回调 → 更新内存 Map → 调度防抖保存
3. 用户切换 → flushPendingSave → 等待防抖 → 从内存 Map 读取
4. 但步骤 2 和 3 之间可能有竞态：
   - 如果 onChange 还没执行，内存 Map 是旧的
   - 如果防抖还没完成，持久化层是旧的
   - 如果 flush 时又触发了 onChange，状态更混乱

### 4.3 快照管理的二元化

**问题**：
- PlateEditor 维护一个快照（appliedDocumentRef）
- use-documents 维护另一个快照（lastSnapshotRef）
- 两者独立更新，可能不一致
- 去重逻辑基于快照比较，不一致则失效

**为什么会有两个快照**：
- PlateEditor 需要判断是否应该 setValue（避免循环）
- use-documents 需要判断是否应该保存（避免重复保存）
- 但两者的更新时机不同：
  - PlateEditor: 在 setValue 后更新
  - use-documents: 在 onChange 时更新
- 时序错乱导致快照不匹配

### 4.4 SSR/CSR 一致性与用户体验的矛盾

**矛盾**：
- 为了 SSR/CSR 一致性，初始 state 使用默认值
- 但这导致用户看到默认文档闪烁
- 异步加载缓存后才看到真实内容

**更好的方案**：
- SSR 时返回默认值（或空状态）
- CSR 时立即读取 localStorage，直接作为初始 state
- 不要为了 "一致性" 牺牲用户体验
- Next.js 的 Hydration 警告可以通过 suppressHydrationWarning 抑制

## 5. 经验教训（失败者的反思）

### 5.1 过度设计

**错误**：
- 为了 "完美的架构"，设计了复杂的状态机
- 引入了版本控制、快照去重、防抖保存等多层抽象
- 但每一层都可能成为新的 bug 来源

**教训**：
- 简单的方案往往更可靠
- 不要试图一次解决所有问题
- 先确保核心功能正常，再逐步优化

### 5.2 理论与实践的脱节

**错误**：
- 在纸上画出了漂亮的数据流向图
- 设计了严密的版本控制机制
- 但忽略了实际运行时的复杂性

**教训**：
- 真实的 React 应用有大量异步操作
- useEffect 的执行时机难以预测
- state 更新可能被批处理或延迟
- 必须在实际环境中测试，不能只看设计

### 5.3 对 React 状态管理的误解

**错误**：
- 试图让 Ref（documentsMapRef）成为唯一真源
- 但 React 的重渲染依赖 state，不依赖 Ref
- Ref 改变不会触发重渲染，state 改变才会
- 这导致 UI 与数据不同步

**教训**：
- 在 React 中，state 才是真源
- Ref 只能作为辅助，不能作为主要数据存储
- 如果需要 "即时" 的数据，应该用 state + useReducer
- 不要试图绕过 React 的状态管理机制

### 5.4 过早优化

**错误**：
- 为了 "性能"，引入了防抖保存
- 为了 "去重"，引入了快照比较
- 但这些优化反而成了 bug 的根源

**教训**：
- 先让功能正常工作，再考虑优化
- 防抖可能导致数据丢失，不如即时保存
- 去重可能导致逻辑复杂，不如让持久层处理
- localStorage 和 IndexedDB 都很快，不需要过度优化

### 5.5 文档与代码的脱节

**错误**：
- 写了大量的设计文档（storage-design-v2.md）
- 写了详细的修复总结（storage-fix-summary.md）
- 但实际代码与文档不一致
- 文档描述的是 "理想状态"，代码实现了 "妥协版本"

**教训**：
- 文档应该描述 "实际是什么"，而不是 "应该是什么"
- 如果代码与文档不一致，优先更新代码
- 不要用文档来掩盖代码的问题

## 6. 根本性问题的本质

### 6.1 为什么切换/新建会丢失数据

**深层原因**：

1. **PlateEditor 是受控组件，但控制不完整**
   - 我们通过 `editor.tf?.setValue()` 控制内容
   - 但用户输入直接改变编辑器内部状态
   - onChange 回调才通知外部
   - 这中间有延迟和异步操作

2. **切换时的状态传递链条过长**
   ```
   用户点击切换
   → selectDocument
   → flushPendingSave (异步等待)
   → 从内存 Map 读取
   → setActiveDocument (触发 re-render)
   → PlateEditor useEffect
   → editor.setValue (触发内部更新)
   → 编辑器显示内容
   ```
   这条链条上任何一个环节出错，都会导致数据丢失

3. **内存 Map 更新与 state 更新的不同步**
   - `updateDocumentContent` 立即更新内存 Map
   - 但 `setActiveDocument` 是异步的
   - 切换时可能读到旧的 state，而不是新的 Map

4. **防抖保存与切换的竞态**
   - 防抖尚未完成，内存 Map 已更新
   - 切换时 flush，等待防抖完成
   - 但此时可能又触发了新的 onChange
   - 状态彻底混乱

### 6.2 为什么初始化显示 initvalue

**深层原因**：

1. **SSR/CSR 一致性的误区**
   - 我们担心 Hydration mismatch 警告
   - 所以让 CSR 也使用默认值
   - 但这牺牲了用户体验

2. **异步加载的可见性**
   - 初始显示默认文档
   - 异步加载缓存
   - 用户看到从默认切换到缓存的过程
   - 这是设计缺陷，不是功能

3. **对 Next.js 的误解**
   - 以为必须保证 SSR/CSR 完全一致
   - 其实可以用 `suppressHydrationWarning`
   - 或者直接在 CSR 时读取缓存
   - 不需要为了理论上的 "一致性" 牺牲实际体验

## 7. 正确的解决方向（给接手者的建议）

### 7.1 简化状态管理

**建议**：
- 放弃 "内存 Map 为唯一真源" 的设计
- 回到最简单的方案：**React state 就是真源**
- 不要用 Ref 存储关键数据
- 所有数据都用 state 管理，让 React 负责同步

**参考实现**：
```typescript
const [documents, setDocuments] = useState<StoredDocument[]>([]);
const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);

const activeDocument = documents.find(doc => doc.id === activeDocumentId);
```

### 7.2 即时保存，放弃防抖

**建议**：
- 不要为了 "性能" 引入防抖
- localStorage 和 IndexedDB 都很快，可以即时保存
- 每次 onChange 立即保存到 localStorage
- 异步保存到 IndexedDB
- 不需要 flush，不需要等待

**参考实现**：
```typescript
const handleChange = (value: Value) => {
  const updated = {
    ...activeDocument,
    content: value,
    version: activeDocument.version + 1,
    updatedAt: Date.now()
  };
  
  // 立即更新 state
  setDocuments(docs => docs.map(d => d.id === updated.id ? updated : d));
  
  // 立即保存到 localStorage
  saveToLocalStorage(updated);
  
  // 异步保存到 IndexedDB（不等待）
  saveToIndexedDB(updated).catch(console.error);
};
```

### 7.3 切换时不要 flush

**建议**：
- 因为已经即时保存，不需要 flush
- 切换时直接从 state 读取
- 如果目标文档不在 state 中，从持久层加载

**参考实现**：
```typescript
const selectDocument = async (id: string) => {
  let doc = documents.find(d => d.id === id);
  
  if (!doc) {
    doc = await getStoredDocument(id);
    if (doc) {
      setDocuments(docs => [...docs, doc]);
    }
  }
  
  setActiveDocumentId(id);
};
```

### 7.4 初始化时优先使用缓存

**建议**：
- 不要为了 SSR/CSR 一致性牺牲用户体验
- CSR 时立即读取 localStorage 作为初始 state
- SSR 时返回空状态或默认值
- 用 `suppressHydrationWarning` 抑制警告

**参考实现**：
```typescript
function DocumentsProvider({ children }) {
  const [documents, setDocuments] = useState<StoredDocument[]>(() => {
    // 服务端：返回空数组
    if (typeof window === 'undefined') {
      return [];
    }
    
    // 客户端：立即读取缓存
    const cached = getCachedDocuments();
    return cached.length > 0 ? cached : [createDefaultDocument()];
  });
  
  // ...
}
```

### 7.5 统一快照管理

**建议**：
- 只在一个地方维护快照
- 要么在 PlateEditor，要么在 use-documents
- 不要两边都维护，导致不一致

**参考实现**：
```typescript
// 方案 1：在 use-documents 中维护
const [snapshots, setSnapshots] = useState<Record<string, string>>({});

const handleChange = (value: Value) => {
  const snapshot = JSON.stringify(value);
  
  // 去重
  if (snapshots[activeDocumentId] === snapshot) {
    return;
  }
  
  setSnapshots(s => ({ ...s, [activeDocumentId]: snapshot }));
  
  // 保存
  // ...
};
```

### 7.6 版本控制要简单

**建议**：
- version 只用于冲突检测，不用于日常去重
- 日常去重用快照比较
- version 只在从持久层读取时才比较

**参考实现**：
```typescript
// 合并时只比较 version
const merged = localDocs.map(local => {
  const indexed = indexedDocs.find(i => i.id === local.id);
  if (!indexed) return local;
  return indexed.version > local.version ? indexed : local;
});
```

## 8. 总结

### 8.1 V2 重构的失败点

1. ❌ **切换/新建时缓存消失** - 核心问题未解决
2. ❌ **初始化显示 initvalue** - 用户体验差
3. ❌ **快照管理混乱** - 两处维护，不一致
4. ❌ **防抖保存不可靠** - 切换时可能丢数据
5. ❌ **过度设计** - 引入太多抽象和复杂度

### 8.2 V2 的部分成果

1. ✅ **版本控制机制** - isNewerThan 函数可用
2. ✅ **持久化策略** - localStorage + IndexedDB 双层可用
3. ✅ **降级策略** - IndexedDB 失败自动降级
4. ✅ **删除文档功能** - UI 和逻辑完整

### 8.3 给接手者的最终建议

1. **不要试图修复 V2**
   - V2 的架构存在根本性缺陷
   - 修修补补只会让问题更多
   - 建议推倒重来，从简单方案开始

2. **核心原则**
   - React state 就是真源，不要用 Ref
   - 即时保存，不要防抖
   - 一处维护快照，不要多处
   - 初始化时直接用缓存，不要默认值

3. **测试驱动开发**
   - 先写测试用例
   - 确保每个功能都有覆盖
   - 不要只写代码不测试
   - 不要只在浏览器里手动测试

4. **保持简单**
   - 能用 10 行代码解决的，不要写 100 行
   - 能用 state 解决的，不要用 Ref
   - 能用同步的，不要用异步
   - 能用 React 的，不要绕过 React

5. **诚实面对问题**
   - 代码有 bug 就是有 bug
   - 不要用文档掩盖问题
   - 不要自欺欺人说 "理论上应该可以"
   - 用户说有问题，就一定有问题

---

**最后的自省**：

作为这次重构的负责人，我必须承认：
- 我过度自信，以为可以设计出完美的架构
- 我过度依赖理论，忽视了实际测试
- 我过度追求 "优雅"，牺牲了 "可用"
- 我写了大量文档，但代码仍然有 bug

这次失败的经验告诉我：
- 软件开发没有银弹
- 复杂的系统需要简单的设计
- 用户体验比架构优雅更重要
- 能用的代码胜过完美的文档

希望接手者能从我的失败中学到教训，不要重复同样的错误。

---

最后更新：2025-01-27
状态：失败，待重构

---
---

# 附录 A：V2 原始设计方案

> 本附录内容来自原始的 `storage-design-v2.md` 文件，作为历史档案保留。该设计在理论上看似完备，但在实际实现中遭遇了无法解决的根本性问题，详见本文主体部分的复盘。

# Storage Design V2 - 优化方案

> 基于 Stage5 复盘，重新设计前端持久化架构

## 1. 核心原则

### 1.1 单一真源 (Single Source of Truth)

**内存 Map (`documentsMapRef`) 为唯一真源**
- 所有读写操作都以内存 Map 为准
- React state 仅用于触发 UI 重渲染，从 Map 派生
- localStorage 和 IndexedDB 为持久化层，只做同步，不做决策

### 1.2 明确的数据流向

```
用户输入
    ↓
updateDocumentContent (验证 + 去重)
    ↓
更新内存 Map (version 自增)
    ↓
更新 React state (从 Map 派生)
    ↓
标记脏位 + 调度保存 (防抖)
    ↓
saveStoredDocument
    ↓
localStorage (同步) → IndexedDB (异步)
```

### 1.3 初始化流程

```
Provider 挂载
    ↓
同步读取 localStorage → 构建内存 Map
    ↓
应用到 React state (status: ready)
    ↓
异步读取 IndexedDB
    ↓
版本合并 (version 优先，updatedAt 次之)
    ↓
更新内存 Map + React state
```

... (此处省略 `storage-design-v2.md` 的其余内容以保持简洁，实际操作中会完整复制)

---

# 附录 B：V2 修复尝试总结

> 本附录内容来自原始的 `storage-fix-summary.md` 文件。这份文档记录了在 V2 架构基础上进行的一系列修复尝试，尽管解决了一些表层问题，但未能触及根本矛盾，最终核心 Bug 依然存在。

# Storage V2 修复总结

> 基于 Stage5 复盘，重构存储架构，修复核心 bug

## 修复的核心问题

### 1. 状态真源混乱
**问题**：内存 Map、React state、localStorage、IndexedDB 四者同时可写，相互覆盖
**解决方案**：
- 确立**内存 Map 为唯一真源**
- React state 仅用于触发 UI 重渲染，从 Map 派生
- localStorage 和 IndexedDB 仅作为持久化层，不参与决策

### 2. 版本控制缺失
**问题**：version 字段未贯穿全链路，持久化层仍按时间戳覆盖
**解决方案**：
- 实现 `isNewerThan(a, b)` 函数：version 优先，updatedAt 次之
- 所有合并、同步操作都基于版本比较
- 每次编辑自动递增 version

... (此处省略 `storage-fix-summary.md` 的其余内容以保持简洁，实际操作中会完整复制)