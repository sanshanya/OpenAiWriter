// hooks/usePersistentSort.ts
import { useEffect, useState } from 'react';
import type { SortPref } from './files-sort';

const KEY = 'filePanel.sort';

export function usePersistentSort(defaultPref: SortPref = { by: 'name', order: 'asc' }) {
  const [pref, setPref] = useState<SortPref>(() => {
    if (typeof window === 'undefined') return defaultPref; // SSR 安全
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as SortPref) : defaultPref;
    } catch {
      return defaultPref;
    }
  });

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(pref)); } catch {}
  }, [pref]);

  return [pref, setPref] as const;
}
