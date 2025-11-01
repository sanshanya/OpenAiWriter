# 存储模块重构计划 v2.0

> **目标**：巩固本地持久化基础，为未来 Yjs 迁移铺路  
> **范围**：前端存储层（hooks + lib/storage）  
> **周期**：4 个阶段，共 6 天  
> **状态**：待执行

---

## 📋 核心共识

### 1. 职责分离 (Separation of Concerns)

**问题根源**：UI 逻辑、业务逻辑和数据持久化逻辑高度耦合，集中在 [`use-documents.tsx`](../hooks/use-documents.tsx:1) (523行)

**解决方案**：
- 通过 **Facade 模式** 建立清晰的存储层接口
- 将"本地状态 / 持久化 / 远端同步 / UI 注入"重新分层
- 所有存储相关逻辑从 UI Hook 中剥离到 `lib/storage/`

### 2. 为未来铺路

**共同目标**：确保存储代码后续可平滑迁移到 **Yjs + Plate.js 官方集成**

**策略**：
- 归档当前未启用的同步代码（remote-sync/outbox/sync-loop）
- Facade API 保持**纯同步签名**（避免 Promise 链捆绑 UI）
- 预留扩展接口（如冲突订阅）但不提前实现

### 3. 抽象数据访问

**统一接口**：通过 `lib/storage/index.ts` (Facade) 暴露函数集合，上层代码只调用这里的函数，无需关心底层实现（localStorage / IndexedDB）

---

## 📊 现状诊断

### 当前文件分布（共 ~1600 行）

```
hooks/
  ├─ use-documents.tsx        523行  🔴 过重，职责混杂
  ├─ documents-model.ts       184行  ✅ 纯函数，结构清晰
  └─ use-persistence.ts        36行  ⚠️ 仅类型定义，位置不当

lib/
  ├─ storage-adapter.ts       210行  ⚠️ 职责模糊（既写 IDB 又管恢复）
  ├─ idb.ts                   206行  ✅ IDB 底层，职责清晰
  ├─ meta-cache.ts             35行  ✅ LS metas 管理，职责清晰
  ├─ remote-sync.ts           245行  🔴 双模式未启用，复杂度高
  ├─ outbox.ts                108行  🔴 完整但未真正使用
  ├─ sync-loop.ts              31行  🔴 仅框架，未启用
  └─ storage/index.ts           0行  ❌ 空文件
```

### 核心问题

1. **职责分散与重复** 🔴
   - 类型定义：3 处重复
   - 工具函数重复：`deriveTitle`、`cloneValue`
   - 持久化逻辑混杂在 UI Hook 中

2. **依赖关系混乱** 🟡
   - 循环引用风险
   - 导入路径分散

3. **未启用的复杂代码** 🔴
   - ~380 行未使用代码
   - 维护负担重

4. **性能与可观测性不足** 🟡
   - 每次输入 2 次序列化
   - 无统一日志

---

## 🎯 重构目标

### 核心原则（来自 V3 经验）

1. ✅ **React State 为唯一真源**（不变）
2. ✅ **简单胜于完美**（删除未启用代码）
3. ✅ **分层清晰**（UI → Model → Adapter → Storage）
4. ✅ **为未来预留接口**（但不提前实现）

### 具体目标

- 🎯 减少 30% 代码量（~500 行）
- 🎯 消除类型/工具重复
- 🎯 清晰的 `lib/storage/` 目录结构
- 🎯 优化性能（减少序列化次数）
- 🎯 增加可观测性（统一日志点）

---

## 📋 重构计划（4 个阶段）

### 🔹 阶段一：类型与常量统一（1 天，低风险）

**目标**：建立单一类型真源，消除重复

#### 1.1 创建核心类型文件

```typescript
// types/storage.ts  ← 新建
export type DocumentRecord = {
  id: string;
  title: string;
  content: Value;
  createdAt: number;
  updatedAt: number;
  version: number;
  deletedAt?: number | null;
};

export type DocumentMeta = Omit<DocumentRecord, 'content'>;

// 统一工具函数
export function deriveTitle(value: Value, fallback: string): string;
export function cloneValue<T>(value: T): T;
export function makeDefaultDoc(): DocumentRecord;
```

#### 1.2 统一常量

```typescript
// lib/storage/constants.ts  ← 新建
export const STORAGE_KEYS = {
  META: 'aiwriter:metas:v4',
  IDB_NAME: 'aiwriter-docs',
  IDB_STORE: 'documents',
  IDB_VERSION: 3,
} as const;

export const STORAGE_CONFIG = {
  DELETION_RETENTION_DAYS: 30,
  META_SAVE_DEBOUNCE_MS: 120,
  IDB_FLUSH_IDLE_TIMEOUT_MS: 500,
} as const;
```

#### 1.3 清理旧类型文件

- 删除 [`hooks/use-persistence.ts`](../hooks/use-persistence.ts:1)（36 行）
- 更新所有引用指向 `types/storage.ts`

#### 1.4 文档同步 ⭐

- 在 `docs/adr/003-storage-types-unification.md` 中记录类型统一决策
- 更新相关架构文档

**预期成果**：
- ✅ 单一类型真源
- ✅ 减少 ~50 行重复代码
- ✅ 架构决策文档化

---

### 🔹 阶段二：存储层重组（2 天，中风险）

**目标**：清晰的分层架构，职责明确

#### 2.0 风险控制 ⭐

**重构前准备**：
1. **代码快照**：
   ```bash
   git add -A
   git commit -m "snapshot: before storage refactor stage 2"
   git tag refactor-stage2-baseline
   ```

2. **回归测试清单**：
   - [ ] 创建/切换/编辑/删除/恢复功能正常
   - [ ] 多标签页数据同步
   - [ ] 刷新后数据恢复
   - [ ] 灾难恢复对话框
   - [ ] 回收站功能

3. **单元测试快照**：
   ```bash
   npm run test -- --updateSnapshot
   ```

#### 2.1 新的目录结构

```
lib/storage/
  ├─ index.ts           # Facade 统一接口
  ├─ constants.ts       # 常量配置
  ├─ local/
  │   ├─ meta-cache.ts      # localStorage metas
  │   └─ idb.ts             # IndexedDB 操作
  ├─ adapter/
  │   ├─ persistence.ts     # 持久化协调器
  │   └─ recovery.ts        # 恢复逻辑
  └─ remote/            # 归档（未启用）
      ├─ _archived_remote-sync.ts
      ├─ _archived_outbox.ts
      ├─ _archived_sync-loop.ts
      └─ README.md          # 归档说明
```

#### 2.2 实施步骤 ⭐

**关键原则**：先建立 Facade，再迁移引用

1. **第一步**：创建 Facade 接口
   ```typescript
   // lib/storage/index.ts
   export { persistDocChange } from './adapter/persistence';
   export { saveMetas, loadMetas } from './local/meta-cache';
   export { idbGetDoc, removeDocsFromIDB } from './local/idb';
   export { getIDBRecoveryMetas, loadAllFromIDB, makeDefaultDoc } from './adapter/recovery';
   export type { DocumentRecord, DocumentMeta } from '@/types/storage';
   ```

2. **第二步**：拆分 storage-adapter.ts
   - 创建 `lib/storage/adapter/persistence.ts`（持久化）
   - 创建 `lib/storage/adapter/recovery.ts`（恢复）
   - 保持现有逻辑不变

3. **第三步**：重组 local 目录
   - 移动 `lib/meta-cache.ts` → `lib/storage/local/meta-cache.ts`
   - 移动 `lib/idb.ts` → `lib/storage/local/idb.ts`

4. **第四步**：更新 use-documents.tsx
   ```typescript
   // 统一导入
   import * as Storage from '@/lib/storage';
   
   // 使用统一接口
   const metas = Storage.loadMetas();
   Storage.persistDocChange(meta, content);
   ```

#### 2.3 简化 use-documents.tsx

**精简目标**：523 行 → ~380 行

**简化内容**：
- 持久化 effect 简化为单一职责
- 移除对底层模块的直接引用
- 统一通过 Facade 访问存储

**预期成果**：
- ✅ 清晰的 Facade 接口
- ✅ 职责分离完成
- ✅ use-documents.tsx 精简 ~140 行

---

### 🔹 阶段三：归档未启用代码（1 天，低风险）

**目标**：减少维护负担，保留未来扩展性

#### 3.1 移动远端同步代码

```bash
# 创建归档目录
mkdir -p lib/storage/remote

# 移动文件并标记
mv lib/remote-sync.ts lib/storage/remote/_archived_remote-sync.ts
mv lib/outbox.ts lib/storage/remote/_archived_outbox.ts
mv lib/sync-loop.ts lib/storage/remote/_archived_sync-loop.ts
```

#### 3.2 添加归档说明

```markdown
# lib/storage/remote/README.md

# 远端同步模块（已归档）

## 状态
🔴 未启用，待未来重新评估

## 背景
V3 阶段引入的快照/事件双模式同步，但实际未完成：
- remote-sync.ts：快照模式 + 事件模式框架
- outbox.ts：事件流追加逻辑
- sync-loop.ts：后台循环框架

## 推荐方案
采用 **Yjs + Plate.js 官方集成** 替代自研：
- 代码量 -75%
- 解决多标签页、CRDT 冲突、性能一步到位
- 参考：docs/nextstep/architecture-analysis-and-refactoring-plan.md

## 如需重新启用
1. 评估 Yjs 方案是否更合适
2. 若仍需自研，从这些文件恢复
3. 补充完整的测试用例
```

#### 3.3 更新依赖

- 移除 use-documents.tsx 中对 remote-sync 的引用
- 冲突订阅保留但简化（仅接口定义）

**预期成果**：
- ✅ 归档 ~380 行未启用代码
- ✅ 文档化未来方向
- ✅ 保留扩展接口

---

### 🔹 阶段四：性能优化与可观测性（2 天，中风险）

**目标**：减少序列化，增加监控

#### 4.1 减少序列化次数

**问题分析**：
```typescript
// use-documents.tsx 当前逻辑
const snapshot = JSON.stringify(value);  // ← 第1次序列化
if (lastSavedSnapshot.current[docId] !== snapshot) {
  Storage.persistDocChange(meta, content);  // ← 内部第2次序列化
}
```

**优化方案**：移除快照去重逻辑

**理由**（V3 经验）：
1. persistDocChange 内部已有 IDB 队列合并
2. meta-cache 已有 120ms debounce
3. 快照对比增加复杂度，收益不明显
4. 过早优化导致 V2 失败

**实施**：
- 删除 rAF 快照对比逻辑
- 依赖队列合并与 debounce

**预期效果**：
- 每次输入从 2 次序列化 → 1 次
- 减少主线程阻塞

#### 4.2 统一日志与监控

```typescript
// lib/storage/logger.ts  ← 新建
const DEBUG = process.env.NODE_ENV === 'development';

export const StorageLogger = {
  persist: (docId: string, version: number) => {
    if (DEBUG) console.debug('[Storage] Persist', { docId, version });
  },
  recovery: (count: number, source: 'metas' | 'idb') => {
    console.info('[Storage] Recovery', { count, source });
  },
  error: (op: string, error: any) => {
    console.error('[Storage] Error', { op, error });
  },
  perf: (op: string, durationMs: number) => {
    if (DEBUG && durationMs > 100) {
      console.warn('[Storage] Slow Op', { op, durationMs });
    }
  },
};
```

**最小监控指标** ⭐：
- `persistAll` 执行耗时
- IndexedDB 错误计数
- 恢复操作频率
- 大文档告警（>1MB）

**埋点位置**：
- persistence.ts：写入前后
- recovery.ts：恢复开始/结束
- idb.ts：错误捕获点

#### 4.3 健康检查端点

```typescript
// lib/storage/health.ts  ← 新建
export async function getStorageHealth() {
  const idbHealth = await checkIndexedDBHealth();
  const metasCount = loadMetas().length;
  return {
    localStorage: { available: true, metasCount },
    indexedDB: idbHealth,
    timestamp: Date.now(),
  };
}
```

**预期成果**：
- ✅ 序列化次数 ÷2
- ✅ 统一日志格式
- ✅ 性能监控埋点
- ✅ 健康检查接口

---

## 📊 重构前后对比

| 维度 | 重构前 | 重构后 | 改善 |
|-----|--------|--------|------|
| **总代码量** | ~1600 行 | ~1100 行 | -31% |
| **核心文件** | 10 个 | 7 个 | -30% |
| **类型定义处** | 3 处 | 1 处 | 统一 |
| **存储接口** | 分散 | Facade | 清晰 |
| **未启用代码** | 380 行 | 0 行（归档） | -100% |
| **序列化次数/输入** | 2 次 | 1 次 | -50% |
| **可观测性** | 无 | 统一日志 | +100% |

---

## ✅ 验收标准

### 功能验收
- [ ] 所有现有功能正常（创建/切换/编辑/删除/恢复/刷新）
- [ ] 灾难恢复对话框正常弹出
- [ ] 回收站正常显示已删除文档
- [ ] 多文档切换无数据丢失
- [ ] IndexedDB 离线时自动降级

### 性能验收
- [ ] 编辑延迟 < 16ms（60fps）
- [ ] localStorage 写入无阻塞感
- [ ] IndexedDB 队列合并写正常

### 代码质量验收
- [ ] 所有类型引用统一到 `types/storage.ts`
- [ ] 存储操作统一通过 `lib/storage/index.ts`
- [ ] 无 ESLint/TypeScript 错误
- [ ] 所有文件有清晰的职责注释

---

## 🚀 实施建议

### 推荐顺序

1. **阶段一**（类型统一）→ 风险最低，收益明显
2. **阶段三**（归档未启用代码）→ 减少后续重构阻力
3. **阶段二**（存储层重组）→ 主要重构
4. **阶段四**（性能优化）→ 锦上添花

### 安全措施

- **每个阶段完成后提交一次 commit**
- **阶段二建议创建 feature 分支**
- **保留完整的回归测试清单**
- **每次提交前运行全量测试**

### 阶段里程碑

| 阶段 | 完成标志 | 验收自检 |
|-----|---------|---------|
| 阶段一 | 所有文件引用 `types/storage.ts` | 无 TS 错误，功能正常 |
| 阶段二 | use-documents.tsx 只引用 Facade | 所有测试通过 |
| 阶段三 | remote 文件夹无引用报错 | ESLint 通过 |
| 阶段四 | 日志正常输出 | 性能指标达标 |

---

## 📝 关键决策记录

### 为什么不立即实现远端同步？

**理由**：
1. V2 失败教训：过早引入复杂架构
2. 当前快照/事件双模式未完成，且未启用
3. 文档强烈推荐 Yjs 方案（-75% 代码量）

**决策**：归档现有代码，为未来预留接口

### 为什么删除快照去重？

**理由**：
1. V2 失败教训：过早优化
2. persistDocChange 内部已有队列合并
3. meta-cache 已有 120ms debounce
4. 快照对比每次输入增加 1 次序列化

**决策**：移除去重逻辑，依赖队列合并

### 为什么用 Facade 模式？

**理由**：
1. 统一存储入口，降低耦合
2. 未来切换实现（如 Yjs）只需改 Facade
3. 便于测试和 mock
4. **Facade API 保持纯同步签名，避免 Promise 链捆绑 UI** ⭐

---

## 🔮 后续规划

- **Stage 5.5**（本次重构）：巩固本地持久化基础
- **Stage 6**（未来）：评估 Yjs 集成 vs 自研远端同步
- **Stage 7**（未来）：多人协作能力

---

## 📚 参考文档

- [`docs/storage-retrospective-V3.md`](./archive/storage-retrospective-V3.md) - V3 成功经验
- [`docs/storage-retrospective-V2.md`](./archive/storage-retrospective-V2.md) - V2 失败教训
- [`docs/adr/001-v3-storage-architecture.md`](./adr/001-v3-storage-architecture.md) - V3 架构决策
- [`docs/adr/002-storage-architecture.md`](./adr/002-storage-architecture.md) - 存储不变量
- [`docs/nextstep/architecture-analysis-and-refactoring-plan.md`](./nextstep/architecture-analysis-and-refactoring-plan.md) - Yjs 方案评估

---

**本重构计划已整理完毕，请审阅。** 🎯
