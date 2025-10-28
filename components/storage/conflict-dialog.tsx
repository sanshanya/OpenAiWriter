"use client";

import * as React from "react";

export type ConflictItem = {
  id: string;
  title?: string;
  clientVersion: number;
  serverVersion: number;
  serverUpdatedAt: number;
  serverDeletedAt?: number | null;
  // 展示用
  serverPreview?: string;
};

export function ConflictDialog({
  open,
  items,
  onUseServer,
  onUseLocal,
  onClose,
}: {
  open: boolean;
  items: ConflictItem[];
  onUseServer: (id: string) => void;
  onUseLocal: (id: string, serverVersion: number) => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[680px] rounded-lg bg-white p-4 shadow-xl dark:bg-neutral-900">
        <div className="mb-3 text-sm font-medium">检测到同步冲突</div>
        <div className="max-h-[50vh] space-y-2 overflow-auto">
          {items.map((c) => (
            <div
              key={c.id}
              className="rounded-md border p-3 text-sm dark:border-neutral-800"
            >
              <div className="flex items-center justify-between">
                <div className="line-clamp-1 font-medium">
                  {c.title || "(未命名)"} · 本地 v{c.clientVersion} / 服务器 v{c.serverVersion}
                </div>
                <div className="text-xs text-neutral-500">
                  服务器更新于 {new Date(c.serverUpdatedAt).toLocaleString()}
                  {c.serverDeletedAt ? " · 已被服务器删除" : ""}
                </div>
              </div>
              {c.serverPreview ? (
                <div className="mt-2 line-clamp-2 text-xs text-neutral-500">
                  {c.serverPreview}
                </div>
              ) : null}
              <div className="mt-2 space-x-2">
                <button
                  onClick={() => onUseServer(c.id)}
                  className="rounded-md border px-2 py-1 text-xs hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                >
                  使用服务器版本
                </button>
                <button
                  onClick={() => onUseLocal(c.id, c.serverVersion)}
                  className="rounded-md border px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 dark:border-neutral-700 dark:text-blue-400 dark:hover:bg-blue-950/30"
                >
                  保留本地版本（提升版本号）
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 text-right">
          <button
            onClick={onClose}
            className="rounded-md border px-3 py-1 text-xs hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
