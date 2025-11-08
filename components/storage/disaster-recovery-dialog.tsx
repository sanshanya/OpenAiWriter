// components/storage/disaster-recovery-dialog.tsx
"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/editor/dialog";
import { Button } from "@/components/ui/editor/button";
import type { DocumentRecord } from "@/types/storage";

type RecoveryMeta = Pick<DocumentRecord, "id" | "title" | "updatedAt" | "version">;

export function DisasterRecoveryDialog({
  open,
  onClose,
  docs,
  onRecover,
}: {
  open: boolean;
  onClose: () => void;
  docs: RecoveryMeta[];
  onRecover: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>检测到可恢复的文档备份</DialogTitle>
          <DialogDescription>
            本地缓存为空，但在 IndexedDB 中发现 {docs.length} 篇文档的备份。你可以选择恢复这些文档。
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[40vh] overflow-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-50">
                <th className="px-3 py-2 text-left">标题</th>
                <th className="px-3 py-2 text-left">版本</th>
                <th className="px-3 py-2 text-left">更新时间</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id} className="odd:bg-white even:bg-neutral-50/40">
                  <td className="px-3 py-2">{d.title || "(未命名)"}</td>
                  <td className="px-3 py-2">v{d.version}</td>
                  <td className="px-3 py-2">{new Date(d.updatedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            忽略
          </Button>
          <Button onClick={onRecover}>恢复</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
