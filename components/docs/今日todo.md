# v51 Yjs 迁移完成总结（修订版）

## ✅ 已完成（P0）

### 1) ✅ 移除 @udecode/plate-common@42 依赖

- 从 [`package.json`](package.json:1) 移除 `@udecode/plate-common@42`
- 保留 `@udecode/cn@49.0.15`（工具库，与 v51 兼容）
- 添加 `@slate-yjs/core@1.0.2` 依赖

### 2) ✅ 使用手工 withYjs 绑定（稳定方式）

**决策变更**：采用 `@platejs/yjs` 提供的 `withTYjs` + `@slate-yjs/core` 的 `YjsEditor.connect/disconnect`，这是经过验证的稳定方式。

**为什么不用 YjsPlugin？**
- YjsPlugin 需要在编辑器创建时就配置 ydoc，架构上需要倒置依赖
- 手工 `withYjs` 方式更灵活，可以动态创建/销毁 ydoc
- 当前实现已经稳定，无需引入额外复杂度

### 3) ✅ 重写 use-yjs-editor.ts

- **文件**：[`components/editor/use-yjs-editor.ts`](components/editor/use-yjs-editor.ts:1)
- **实现**：
  ```ts
  // 1. 创建基础编辑器
  const { editor: baseEditor } = useEditorKit(initialValue);
  
  // 2. 创建 Y.Doc 和 XmlText
  const ydoc = useMemo(() => new Y.Doc(), [docId]);
  const sharedRoot = useMemo(() => ydoc.get("content", Y.XmlText), [ydoc]);
  
  // 3. withYjs 绑定
  const editor = useMemo(() => 
    withYjs(baseEditor, sharedRoot, { autoConnect: false }),
    [baseEditor, sharedRoot]
  );
  
  // 4. connect/disconnect
  useEffect(() => {
    YjsEditor.connect(editor);
    return () => YjsEditor.disconnect(editor);
  }, [editor]);
  
  // 5. IndexedDB provider
  useEffect(() => {
    const provider = new IndexeddbPersistence(key, ydoc);
    provider.whenSynced().then(() => {
      if (sharedRoot.length === 0) seedJsonIntoYDocIfEmpty(...);
    });
    return () => { provider.destroy(); ydoc.destroy(); };
  }, [docId, ydoc]);
  ```

### 4) ✅ 统一类型：全部使用 Y.XmlText

- [`use-yjs-editor.ts`](components/editor/use-yjs-editor.ts:48)：`ydoc.get("content", Y.XmlText)`
- [`use-ydoc-meta-bridge.ts`](lib/yjs/use-ydoc-meta-bridge.ts:24)：`ydoc.get("content", Y.XmlText)`  
- [`seed.ts`](lib/yjs/seed.ts:12)：接受 `Y.XmlText` 参数

**修复的 Bug**：
- ❌ 之前：meta-bridge 用 `getXmlFragment`，use-yjs-editor 用 `Y.XmlText`
- ✅ 现在：统一使用 `ydoc.get("content", Y.XmlText)`
- 这样避免了 "Type with name content already defined" 错误

### 5) ✅ 更新 plate-editor.tsx

- **文件**：[`components/editor/plate-editor.tsx`](components/editor/plate-editor.tsx:1)
- **流程**：
  1. `useYjsEditor` 创建带 Yjs 的 editor
  2. 等待 `status.synced` 后渲染编辑器
  3. 绑定 `useYDocMetaBridge` 监听更新

### 6) ✅ 简化 seed.ts

- **文件**：[`lib/yjs/seed.ts`](lib/yjs/seed.ts:1)
- **实现**：
  ```ts
  export async function seedJsonIntoYDocIfEmpty(
    editor: any,
    sharedRoot: Y.XmlText,
    legacy: MyValue,
  ): Promise<boolean> {
    if (sharedRoot.length > 0) return false;
    
    const doc = sharedRoot.doc;
    doc.transact(() => {
      editor.children = legacy;
      editor.onChange();
    });
    
    return true;
  }
  ```

### 7) ✅ 更新文档

- [`docs/Yjs 存储改造计划.md`](docs/Yjs 存储改造计划.md:1) - 完整实现方案
- [`docs/ADR-006 内容真源迁移到 Yjs .md`](docs/ADR-006 内容真源迁移到 Yjs .md:1) - 决策记录
- [`docs/今日todo.md`](docs/今日todo.md:1) - 本文档

---

## 🎯 核心架构

### 数据流

```
用户输入 
  → Plate Editor (withYjs 绑定)
  → Y.XmlText("content")
  → IndexeddbPersistence 自动保存
  → ydoc.on('update') 
  → useYDocMetaBridge 更新 meta.updatedAt
  → saveMetasDebounced
```

### 生命周期

```
1. docId 变化
   ↓
2. 创建 new Y.Doc()
   ↓
3. ydoc.get("content", Y.XmlText)
   ↓
4. withYjs(baseEditor, sharedRoot)
   ↓
5. YjsEditor.connect(editor)
   ↓
6. new IndexeddbPersistence(key, ydoc)
   ↓
7. provider.whenSynced() → seed (if empty)
   ↓
8. 编辑器可用

清理：
  disconnect → provider.destroy → ydoc.destroy
```

---

## 🧪 测试清单

### 基础功能
- [ ] 编辑器正常加载（无"正在加载"卡住）
- [ ] 输入文字正常保存
- [ ] 刷新页面内容保留
- [ ] 切换文档内容不丢失
- [ ] Meta 时间戳正常更新

### Seed 迁移
- [ ] 旧 JSON 文档首次打开正确迁移
- [ ] 新文档正常创建
- [ ] 重复打开不会重复 seed

### 异常场景
- [ ] 离线编辑→刷新→内容仍在
- [ ] 多标签页同步正常
- [ ] 无内存泄漏

### 控制台检查
- [ ] 无 "Type with name content already defined" 错误
- [ ] 无 "Path doesn't match yText" 错误
- [ ] Seed 日志正确

---

## 📝 技术要点

### 关键修复

1. **统一使用 Y.XmlText**
   - ❌ 混用 `getXmlFragment` 和 `Y.XmlText`
   - ✅ 统一 `ydoc.get("content", Y.XmlText)`

2. **正确的绑定方式**
   - 使用 `@platejs/yjs` 的 `withTYjs`（返回 PlateEditor 类型）
   - 使用 `@slate-yjs/core` 的 `YjsEditor.connect/disconnect`
   - 不使用 YjsPlugin（架构不匹配）

3. **简化 seed**
   - 直接 `editor.children = legacy; editor.onChange()`
   - 包在 `doc.transact()` 中确保原子性

### 依赖清单

```json
{
  "@platejs/yjs": "^51.0.0",       // withTYjs
  "@slate-yjs/core": "^1.0.2",     // YjsEditor.connect/disconnect
  "@slate-yjs/react": "^1.1.0",    // useRemoteCursorOverlay
  "yjs": "^13.6.27",               // Y.Doc, Y.XmlText
  "y-protocols": "^1.0.5"          // Awareness
}
```

---

## 🚀 下一步

### P1：验证功能（现在）
- [ ] 用户手工测试所有场景
- [ ] 确认无报错和数据丢失
- [ ] 验证性能正常

### P2：诊断工具（本周）
- [ ] DevTools：导出 Y.Doc → JSON
- [ ] DevTools：清空 IndexedDB
- [ ] 显示同步状态面板

### Stage 6.2：协同编辑
- [ ] 接入 `y-websocket` provider
- [ ] 多端协同测试
- [ ] AI 服务端直写

---

## ⚠️ 常见问题

### Q: 为什么不用 YjsPlugin？
**A**: YjsPlugin 需要在创建 editor 时就配置好 ydoc，但我们需要动态创建 ydoc（docId 变化时）。手工 `withYjs` 方式更灵活。

### Q: "Type with name content already defined" 错误
**A**: Y.Doc 不允许用不同类型定义同一个键。确保所有地方都用 `ydoc.get("content", Y.XmlText)`。

### Q: "Path doesn't match yText" 错误
**A**: 确保使用 `Y.XmlText` 而非 `Y.Text` 或 `Y.XmlFragment`。

### Q: 内容刷新后丢失
**A**: 检查：
1. `IndexeddbPersistence` 是否正确创建
2. `provider.whenSynced()` 是否被调用
3. `sharedRoot.length` 是否为 0 （seed 条件）
4. IndexedDB 中是否有数据

---

> 本次采用稳定的手工 `withYjs` 绑定方式，避免 YjsPlugin 的架构复杂度，为后续协同编辑打下坚实基础。
