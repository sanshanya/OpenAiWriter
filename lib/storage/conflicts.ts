// lib/storage/conflicts.ts
export type SyncConflict = {
  id: string;
  clientVersion: number;
  serverVersion: number;
  serverContent: string;
  serverUpdatedAt: number;
  serverTitle?: string;
  serverDeletedAt?: number | null;
};

type ConflictListener = (conflicts: SyncConflict[]) => void;

export function onConflicts(listener: ConflictListener): () => void {
  void listener;
  // 归档远端同步逻辑后，默认不产生冲突事件
  return () => {};
}
