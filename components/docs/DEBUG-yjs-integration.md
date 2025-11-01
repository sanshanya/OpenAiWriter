# Yjs 集成调试指南

## 问题：内容不保存，刷新/切换丢失

### 排查步骤

#### 1. 检查控制台日志

打开浏览器控制台，查看以下日志：

```
[useYjsEditor] Connecting editor to Yjs { docId, editorId, sharedRootLength }
[useYjsEditor] Connected successfully
[useYjsEditor] Creating IndexedDB provider { key, docId }
[IndexeddbPersistence] update event { key, updateSize }
[IndexeddbPersistence] persisting { key, updateSize }
[IndexeddbPersistence] persisted successfully
```

**如果缺少日志**：

- ❌ 没有 "Connecting editor" → editor 或 sharedRoot 为 null
- ❌ 没有 "update event" → YjsEditor.connect 未生效，或编辑器修改未同步到 Y.Doc
- ❌ 没有 "persisting" → update handler 未触发

#### 2. 检查 IndexedDB 数据

1. 打开开发者工具 → Application → IndexedDB
2. 找到数据库：`openai-writer-yjs`
3. 查看 Store：`documents`
4. 确认有 key 为 `openai-writer:doc:{docId}` 的记录

**如果没有数据**：
- IndexedDB 写入失败
- update 事件未触发
- persist 方法有异常

#### 3. 手动测试 Y.Doc 更新

在浏览器控制台执行：

```js
// 获取当前 ydoc (需要先暴露到 window)
const ydoc = window.__currentYDoc; 

// 监听 update 事件
ydoc.on('update', (update) => {
  console.log('Y.Doc update event', update.length);
});

// 手动修改测试
const sharedRoot = ydoc.get('content', Y.XmlText);
ydoc.transact(() => {
  // 尝试触发更新
  console.log('Manual transaction test');
});
```

#### 4. 检查 withYjs 绑定

确认日志显示：
```
[useYjsEditor] sharedRootLength: 0  (初始)
```

输入文字后，sharedRootLength 应该增加。

如果不增加 → withYjs 绑定失败 → 编辑器修改未同步到 Y.Doc

### 常见原因

#### A. YjsEditor.connect 未生效

**症状**：输入文字，但控制台无 "update event"

**原因**：
1. `sharedRoot` 类型不匹配（应为 `Y.XmlText`）
2. `autoConnect: false` 但未手动 `YjsEditor.connect`
3. editor 和 sharedRoot mismatch

**修复**：
```ts
// 确保顺序正确
const sharedRoot = ydoc.get("content", Y.XmlText);
const editor = withYjs(baseEditor, sharedRoot, { autoConnect: false });
YjsEditor.connect(editor);  // 必须调用
```

#### B. IndexedDB 权限问题

**症状**：控制台有 "IndexedDB request failed"

**原因**：
1. 浏览器阻止 IndexedDB（隐私模式）
2. 磁盘空间不足
3. 权限被拒绝

**修复**：
- 检查浏览器设置
- 使用正常模式（非隐私）
- 清理磁盘空间

#### C. ydoc.destroy 过早调用

**症状**：输入后立即刷新，数据丢失

**原因**：
- useEffect cleanup 在 persist 完成前就调用
- React StrictMode 导致双重挂载/卸载

**修复**：
```ts
// persistence.whenSynced 确保初始同步完成
// persist 是 async，但不等待完成
// 需要在 destroy 前等待最后一次 persist
```

### 临时诊断工具

在 use-yjs-editor.ts 中添加：

```ts
React.useEffect(() => {
  if (typeof window !== 'undefined' && editor && ydoc) {
    (window as any).__currentEditor = editor;
    (window as any).__currentYDoc = ydoc;
    (window as any).__dumpYDoc = () => {
      const sharedRoot = ydoc.get('content', Y.XmlText);
      return sharedRoot.toJSON();
    };
  }
}, [editor, ydoc]);
```

然后在控制台执行：
```js
window.__dumpYDoc()  // 查看当前 Y.Doc 内容
```

---

## 下一步调试

1. **先确认日志**：运行应用，输入文字，查看控制台是否有完整日志链
2. **检查 IndexedDB**：确认数据是否写入
3. **手动触发更新**：在控制台测试 Y.Doc update 事件
4. **报告结果**：把控制台日志和 IndexedDB 截图发给开发团队

---

> 关键：如果看到 "update event" 日志，说明 Yjs 绑定正常；如果看到 "persisted successfully"，说明 IndexedDB 写入正常。如果两者都有但刷新后丢失，问题在读取端。