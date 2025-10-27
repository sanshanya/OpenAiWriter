"use client";

import * as React from "react";

import { useEditorSettings } from "@/components/editor/settings/editor-settings-provider";

type SettingsPanelProps = {
  onClose?: () => void;
};

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const {
    optionalPluginGroups,
    isOptionalPluginEnabled,
    toggleOptionalPlugin,
    restoreDefaultOptionalPlugins,
  } = useEditorSettings();

  return (
    <section className="flex h-full flex-col">
      <header className="mb-3 space-y-1">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-sm font-semibold text-neutral-800">插件设置</h2>
            <p className="text-xs leading-relaxed text-neutral-500">
              启用或停用可选插件，观察编辑器行为差异。默认开启全部能力。
            </p>
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex size-6 items-center justify-center rounded-full border border-neutral-200 text-xs text-neutral-500 transition hover:border-neutral-300 hover:text-neutral-800"
              aria-label="关闭插件设置"
            >
              ×
            </button>
          ) : null}
        </div>
      </header>

      {optionalPluginGroups.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-md border border-dashed border-neutral-200 bg-neutral-50 px-4 py-6 text-center text-xs text-neutral-500">
          <p>当前所有插件均为核心配置，暂无可选开关。</p>
          <p className="mt-2">
            后续引入 Markdown、表格等扩展能力时，再开放手动控制。
          </p>
        </div>
      ) : (
        <>
          <div className="flex-1 space-y-3 overflow-y-auto pr-1">
            {optionalPluginGroups.map((group) => {
              const checked = isOptionalPluginEnabled(group.id);
              return (
                <label
                  key={group.id}
                  className="flex cursor-pointer gap-3 rounded-md border border-neutral-200 bg-white p-3 text-left shadow-sm transition hover:border-neutral-300"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleOptionalPlugin(group.id)}
                    className="mt-1 size-4 cursor-pointer accent-neutral-900"
                  />
                  <span className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-neutral-800">
                      {group.label}
                    </span>
                    {group.description ? (
                      <span className="text-xs text-neutral-500">
                        {group.description}
                      </span>
                    ) : null}
                    <span className="text-[11px] tracking-wide text-neutral-400 uppercase">
                      {group.category.toUpperCase()}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>

          <button
            type="button"
            onClick={restoreDefaultOptionalPlugins}
            className="mt-4 inline-flex items-center justify-center rounded-md border border-neutral-300 px-3 py-2 text-xs font-medium text-neutral-700 transition hover:border-neutral-400 hover:text-neutral-900"
          >
            恢复默认配置
          </button>
        </>
      )}
    </section>
  );
}
