"use client";

import * as React from "react";
import { PlateEditor } from "@/components/editor/plate-editor";
import { EditorSettingsProvider } from "@/components/editor/settings/editor-settings-provider";
import { SettingsPanel } from "@/components/editor/settings/settings-panel";
import { AIPanel } from "@/components/ai/ai-panel";
import {
  DocumentsProvider,
  useDocuments,
} from "@/hooks/use-documents";
import { TrashDrawer } from "@/components/storage/trash-drawer";
import { usePersistentSort } from "@/hooks/usePersistentSort";
import {
  compareByMtime,
  compareByName,
  type SortPref,
} from "@/hooks/files-sort";
import { ScrollArea } from "@/components/ui/shadcn/scroll-area";
import {
  Sidebar as LeftSidebar,
  SidebarContent as LeftSidebarContent,
  SidebarInset as LeftSidebarInset,
  SidebarProvider as LeftSidebarProvider,
  SidebarTrigger as LeftSidebarTrigger,
} from "@/components/ui/shadcn/sidebar";
import {
  Sidebar as RightSidebar,
  SidebarContent as RightSidebarContent,
  SidebarInset as RightSidebarInset,
  SidebarProvider as RightSidebarProvider,
  SidebarTrigger as RightSidebarTrigger,
} from "@/components/ui/shadcn/sidebar-right";
import type { DocumentMeta } from "@/types/storage";

export default function Page() {
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [trashOpen, setTrashOpen] = React.useState(false);

  const leftSidebarStyle = React.useMemo(
    () =>
      ({
        "--sidebar-width": "clamp(200px,14vw,260px)",
        "--sidebar-width-icon": "3.25rem",
      }) as React.CSSProperties,
    []
  );
  const rightSidebarStyle = React.useMemo(
    () =>
      ({
        "--sidebar-width": "clamp(220px,15vw,320px)",
      }) as React.CSSProperties,
    []
  );

  return (
    <DocumentsProvider>
      <EditorSettingsProvider>
        <LeftSidebarProvider defaultOpen style={leftSidebarStyle}>
          <div className="flex h-dvh w-full bg-neutral-50 text-neutral-900">
            <LeftSidebar
              collapsible="offcanvas"
              side="left"
              className="border-r border-neutral-200"
            >
              <LeftSidebarContent className="h-full px-1 py-2">
                <ScrollArea className="h-full pr-3">
                  <DocumentSidebar
                    onOpenSettings={() => setSettingsOpen(true)}
                    onOpenTrash={() => setTrashOpen(true)}
                  />
                </ScrollArea>
              </LeftSidebarContent>
            </LeftSidebar>

            <LeftSidebarInset className="flex h-full flex-1 flex-col bg-neutral-50">
              <RightSidebarProvider defaultOpen style={rightSidebarStyle}>
                <div className="flex h-full flex-1">
                  <RightSidebarInset className="flex flex-1 flex-col overflow-hidden">
                    <header className="sticky top-0 z-10 border-b border-neutral-200 bg-neutral-50/80 backdrop-blur">
                      <div className="flex h-14 w-full items-center gap-3 px-4">
                        <LeftSidebarTrigger className="size-8" />
                        <div className="text-[15px] font-semibold tracking-tight">
                          AI Writer 工作台
                        </div>
                        <div className="ml-auto flex items-center gap-2">
                          <RightSidebarTrigger className="size-8" />
                        </div>
                      </div>
                    </header>
                    <main className="flex-1 overflow-auto">
                      <div className="mx-auto w-full px-8 py-8 md:w-[min(1400px,calc(100vw-320px))]">
                        <PlateEditor />
                      </div>
                    </main>
                  </RightSidebarInset>
                  <RightSidebar
                    side="right"
                    variant="inset"
                    collapsible="offcanvas"
                    className="border-l border-neutral-200"
                  >
                    <RightSidebarContent className="h-full p-0">
                      <ScrollArea className="h-full px-3 py-4">
                        <AIPanel />
                      </ScrollArea>
                    </RightSidebarContent>
                  </RightSidebar>
                </div>
              </RightSidebarProvider>
            </LeftSidebarInset>
          </div>

          {settingsOpen ? (
            <div
              className="fixed inset-0 z-40 flex items-center justify-center bg-neutral-900/40 px-4 py-6 backdrop-blur-sm"
              onClick={() => setSettingsOpen(false)}
            >
              <div
                className="max-h-[80vh] w-[min(420px,90vw)] overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="max-h-[80vh] overflow-y-auto p-5">
                  <SettingsPanel onClose={() => setSettingsOpen(false)} />
                </div>
              </div>
            </div>
          ) : null}

          <TrashDrawer open={trashOpen} onOpenChange={setTrashOpen} />
        </LeftSidebarProvider>
      </EditorSettingsProvider>
    </DocumentsProvider>
  );
}

function DocumentSidebar({
  onOpenSettings,
  onOpenTrash,
}: {
  onOpenSettings: () => void;
  onOpenTrash: () => void;
}) {
  const {
    documents,
    activeDocumentId,
    selectDocument,
    createDocument,
    deleteDocument,
  } = useDocuments();
  const [sortPref, setSortPref] = usePersistentSort({
    by: "name",
    order: "asc",
  });
  const sortSelectValue = `${sortPref.by}:${sortPref.order}`;
  const sortedDocuments = React.useMemo(() => {
    const comparator =
      sortPref.by === "name"
        ? (a: DocumentMeta, b: DocumentMeta) =>
            compareByName(
              { name: a.title?.trim() || "未命名文档" },
              { name: b.title?.trim() || "未命名文档" },
              sortPref.order
            )
        : (a: DocumentMeta, b: DocumentMeta) =>
            compareByMtime(
              { mtime: a.updatedAt },
              { mtime: b.updatedAt },
              sortPref.order
            );

    if (typeof documents.toSorted === "function") {
      return documents.toSorted(comparator);
    }
    return [...documents].sort(comparator);
  }, [documents, sortPref]);

  return (
    <div className="flex h-full flex-col gap-6 px-3 py-4">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-neutral-800">文档列表</h2>
          <div className="flex items-center gap-2">
            <label htmlFor="document-sort" className="sr-only">
              文档排序
            </label>
            <select
              id="document-sort"
              value={sortSelectValue}
              onChange={(event) => {
                const [by, order] = event.target.value.split(
                  ":"
                ) as [SortPref["by"], SortPref["order"]];
                setSortPref({ by, order });
              }}
              className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px] font-medium text-neutral-600 transition hover:border-neutral-300 hover:text-neutral-900"
            >
              <option value="name:asc">名称 ↑</option>
              <option value="name:desc">名称 ↓</option>
              <option value="mtime:desc">时间（新→旧）</option>
              <option value="mtime:asc">时间（旧→新）</option>
            </select>
            <button
              type="button"
              onClick={createDocument}
              disabled={!activeDocumentId}
              className="inline-flex items-center gap-1 rounded-md border border-neutral-200 px-2 py-1 text-[11px] font-medium text-neutral-600 transition hover:border-neutral-300 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              新建
            </button>
          </div>
        </div>

        {!activeDocumentId ? (
          <div className="text-xs text-neutral-500">正在加载文档…</div>
        ) : documents.length === 0 ? (
          <div className="rounded-md border border-dashed border-neutral-200 px-3 py-2 text-xs text-neutral-500">
            暂无文档，点击右上角「新建」开始创作。
          </div>
        ) : (
          <ul className="space-y-2">
            {sortedDocuments.map((document) => {
              if (!document.id) {
                return null;
              }
              const isActive = document.id === activeDocumentId;
              return (
                <li key={document.id}>
                  <div className="group relative">
                    <button
                      type="button"
                      onClick={() => selectDocument(document.id)}
                      className={`w-full rounded-md border px-3 py-2 text-left shadow-sm transition ${
                        isActive
                          ? "border-neutral-900 bg-neutral-900 text-neutral-50"
                          : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:text-neutral-900"
                      }`}
                    >
                      <div className="truncate pr-6 text-sm font-medium">
                        {document.title || "未命名文档"}
                      </div>
                      <div
                        className={`text-[10px] ${
                          isActive ? "text-neutral-400" : "text-neutral-400"
                        }`}
                      >
                        更新 {formatUpdatedAt(document.updatedAt)}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (
                          confirm(
                            `确定要删除「${
                              document.title || "未命名文档"
                            }」吗？此操作不可恢复。`
                          )
                        ) {
                          deleteDocument(document.id);
                        }
                      }}
                      className={`absolute right-2 top-2 rounded p-1 opacity-0 transition group-hover:opacity-100 ${
                        isActive
                          ? "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-50"
                          : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                      }`}
                      title="删除文档"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-auto space-y-2">
        <button
          type="button"
          onClick={onOpenTrash}
          className="inline-flex w-full items-center justify-center rounded-md border border-neutral-300 px-3 py-2 text-xs font-medium text-neutral-700 transition hover:border-neutral-400 hover:text-neutral-900"
        >
          回收站
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          className="inline-flex w-full items-center justify-center rounded-md border border-neutral-300 px-3 py-2 text-xs font-medium text-neutral-700 transition hover:border-neutral-400 hover:text-neutral-900"
        >
          打开插件设置
        </button>
      </section>
    </div>
  );
}

function formatUpdatedAt(timestamp: number) {
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(timestamp));
  } catch {
    return new Date(timestamp).toLocaleString();
  }
}
