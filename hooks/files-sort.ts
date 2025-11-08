// sort/files-sort.ts
export type SortPref = { by: 'name' | 'mtime'; order: 'asc' | 'desc' };

export const NAME_COLLATOR = new Intl.Collator(undefined, {
  numeric: true,            // 让 "2" < "10"
  sensitivity: 'base',      // 忽略大小写/音标差异
  ignorePunctuation: true,  // 忽略分隔符/标点
});

export function compareByName(a: { name: string }, b: { name: string }, order: 'asc' | 'desc' = 'asc') {
  const dir = order === 'asc' ? 1 : -1;
  return NAME_COLLATOR.compare(a.name, b.name) * dir;
}

// 如果将来要回退到“按时间”作为可选项：
export function compareByMtime(a: { mtime?: number }, b: { mtime?: number }, order: 'asc' | 'desc' = 'desc') {
  const va = a.mtime ?? 0;
  const vb = b.mtime ?? 0;
  return (va - vb) * (order === 'asc' ? 1 : -1);
}
