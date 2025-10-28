"use client";

import * as React from "react";
import { useDocuments } from "@/hooks/use-documents";

function formatAgo(ms: number) {
  const d = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (d < 60) return `${d}s 前`;
  if (d < 3600) return `${Math.floor(d / 60)}m 前`;
  if (d < 86400) return `${Math.floor(d / 3600)}h 前`;
  return `${Math.floor(d / 86400)}d 前`;
}

function daysLeft(deletedAt: number, retentionMs: number) {
  const left = Math.max(0, deletedAt + retentionMs - Date.now());
  return Math.ceil(left / (24 * 3600 * 1000));
}

export function TrashDrawer({
  open,
  onOpenChange,
  retentionMs = 30 * 24 * 60 * 60 * 1000,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  retentionMs?: number;
}) {
  const { trashedDocuments, restoreDocument, purgeDocument } = useDocuments();

  const handleEmpty = React.useCallback(() => {
    if (trashedDocuments.length === 0) return;
    if (!confirm(`确定永久删除 ${trashedDocuments.length} 篇文档？该操作不可撤销。`)) return;
    trashedDocuments.forEach((d) => purgeDocument(d.id));
  }, [trashedDocuments, purgeDocument]);

  return (
    <div
      className={`fixed inset-y-0 right-0 z-50 w-[420px] transform bg-white shadow-2xl transition-transform dark:bg-neutral-900 ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
      role="dialog"
      aria-modal="true"
    >
      <div className="flex items-center justify-between border-b px-4 py-3 dark:border-neutral-800">
        <div className="text-sm font-medium">回收站</div>
        <div className="space-x-2">
          <button
            onClick={handleEmpty}
            disabled={trashedDocuments.length === 0}
            className="rounded-md border px-2 py-1 text-xs hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            清空
          </button>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-md border px-2 py-1 text-xs hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            关闭
          </button>
        </div>
      </div>

      <div className="h-[calc(100%-48px)] overflow-auto px-3 py-2">
        {trashedDocuments.length === 0 ? (
          <div className="mt-10 text-center text-xs text-neutral-500">
            没有已删除的文档
          </div>
        ) : (
          <ul className="space-y-2">
            {trashedDocuments.map((d) => (
              <li
                key={d.id}
                className="rounded-lg border p-3 text-sm dark:border-neutral-800"
              >
                <div className="line-clamp-1 font-medium">{d.title || "(未命名)"}</div>
                <div className="mt-1 text-xs text-neutral-500">
                  删除于 {formatAgo(d.deletedAt)} ·
                  将在 {daysLeft(d.deletedAt, retentionMs)} 天后永久移除
                </div>
                <div className="mt-2 space-x-2">
                  <button
                    onClick={() => restoreDocument(d.id)}
                    className="rounded-md border px-2 py-1 text-xs hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                  >
                    恢复
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("确定永久删除该文档？不可恢复。")) purgeDocument(d.id);
                    }}
                    className="rounded-md border px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-neutral-700 dark:text-red-400 dark:hover:bg-red-950/30"
                  >
                    永久删除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
