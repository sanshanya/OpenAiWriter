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

export default function Page() {
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  return (
    <DocumentsProvider>
      <EditorSettingsProvider>
        <div className="grid h-dvh grid-rows-[56px_1fr] bg-neutral-50 text-neutral-900">
        <header className="sticky top-0 z-30 border-b border-neutral-200 bg-neutral-50/80 backdrop-blur">
          <div className="flex h-14 w-full items-center gap-3 px-4">
            <div className="text-[15px] font-semibold tracking-tight">
              AI Writer 工作台
            </div>
            <div className="ml-auto flex items-center gap-2" />
          </div>
        </header>

        <div className="grid w-full grid-cols-1 md:[grid-template-columns:var(--left)_minmax(0,1fr)_var(--right)] md:px-0 md:[--left:clamp(180px,12vw,220px)] md:[--right:clamp(200px,12vw,240px)]">
          <aside className="hidden md:block">
            <div className="sticky top-[56px] h-[calc(100dvh-56px)] border-r border-neutral-200">
              <div className="relative h-full">
                <DocumentSidebar onOpenSettings={() => setSettingsOpen(true)} />
              </div>
            </div>
          </aside>

          <main className="min-w-0">
            <div className="mx-auto w-full px-8 py-8 md:w-[clamp(1000px,calc(100vw-var(--left)-var(--right)-64px),1760px)]">
              <PlateEditor />
            </div>
          </main>

          <aside className="hidden md:block">
            <div className="sticky top-[56px] h-[calc(100dvh-56px)] border-l border-neutral-200 bg-white">
              <AIPanel />
            </div>
          </aside>
        </div>
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
      </EditorSettingsProvider>
    </DocumentsProvider>
  );
}

function DocumentSidebar({
  onOpenSettings,
}: {
  onOpenSettings: () => void;
}) {
  const {
    documents,
    activeDocumentId,
    selectDocument,
    createDocument,
    deleteDocument,
  } = useDocuments();

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto px-3 py-4">
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-800">文档列表</h2>
          <button
            type="button"
            onClick={createDocument}
            disabled={!activeDocumentId}
            className="inline-flex items-center gap-1 rounded-md border border-neutral-200 px-2 py-1 text-[11px] font-medium text-neutral-600 transition hover:border-neutral-300 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            新建
          </button>
        </div>

        {!activeDocumentId ? (
          <div className="text-xs text-neutral-500">正在加载文档…</div>
        ) : documents.length === 0 ? (
          <div className="rounded-md border border-dashed border-neutral-200 px-3 py-2 text-xs text-neutral-500">
            暂无文档，点击右上角「新建」开始创作。
          </div>
        ) : (
          <ul className="space-y-2">
            {documents.map((document) => {
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
                      <div className={`text-[10px] ${isActive ? "text-neutral-400" : "text-neutral-400"}`}>
                        更新 {formatUpdatedAt(document.updatedAt)}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`确定要删除「${document.title || "未命名文档"}」吗？此操作不可恢复。`)) {
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

      <section className="mt-auto">
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
