"use client";

import * as React from "react";

import { Loader2, RefreshCw, X, ClipboardCopy } from "lucide-react";

const MODES = [
  {
    value: "draft",
    label: "生成初稿",
    description: "围绕提示语快速生成一段草稿内容",
  },
  {
    value: "polish",
    label: "润色改写",
    description: "保持主旨不变，提升表达准确度",
  },
];

type SubmissionState = "idle" | "submitting" | "canceled";

export function AIPanel() {
  const [mode, setMode] = React.useState(MODES[0].value);
  const [prompt, setPrompt] = React.useState("");
  const [output, setOutput] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<SubmissionState>("idle");
  const abortController = React.useRef<AbortController | null>(null);
  const [copied, setCopied] = React.useState(false);

  const isSubmitting = status === "submitting";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!prompt.trim()) {
      setError("Please enter a prompt before submitting to AI.");
      return;
    }

    abortController.current?.abort();
    const controller = new AbortController();
    abortController.current = controller;

    setStatus("submitting");
    setError(null);
    setCopied(false);
    setOutput("");

    try {
      const response = await fetch("/api/ai/helper", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt, mode }),
        signal: controller.signal,
      });

      if (!response.ok) {
        let message = "Request failed, please try again later.";
        try {
          const data = await response.json();
          if (typeof data?.error === "string") {
            message = data.error;
          }
        } catch {
          // ignore JSON parse errors and keep default message
        }
        throw new Error(message);
      }

      if (!response.body) {
        throw new Error("Response stream is empty.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        if (!chunk) continue;

        setOutput((prev) => prev + chunk);
      }

      const finalChunk = decoder.decode();
      if (finalChunk) {
        setOutput((prev) => prev + finalChunk);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setStatus("canceled");
        setError("Request canceled.");
        return;
      }

      const message =
        err instanceof Error ? err.message : "Request failed, please try again later.";
      setError(message);
    } finally {
      abortController.current = null;
      setStatus((prev) => (prev === "submitting" ? "idle" : prev));
    }
  }

  function handleCancel() {
    if (abortController.current) {
      abortController.current.abort();
    }
  }

  function handleRetry() {
    setError(null);
    setStatus("idle");
  }

  async function handleCopy() {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setError("复制失败，请手动选择文本。");
    }
  }

  React.useEffect(() => {
    return () => {
      abortController.current?.abort();
    };
  }, []);

  return (
    <section className="flex h-[calc(100dvh-56px)] flex-col overflow-hidden">
      <header className="border-b border-neutral-200 px-3 pt-4 pb-2">
        <h2 className="text-sm font-medium text-neutral-900">AI 工作台</h2>
        <p className="mt-1 text-xs text-neutral-500">
          选择模式，输入提示语，可用 Ctrl + Enter 快速提交请求。
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-4"
      >
        <fieldset className="flex flex-col gap-2">
          <legend className="text-xs font-medium text-neutral-500">
            生成模式
          </legend>
          <div className="grid grid-cols-1 gap-2">
            {MODES.map((item) => {
              const isActive = item.value === mode;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setMode(item.value)}
                  className={`rounded-md border px-3 py-2 text-left transition ${
                    isActive
                      ? "border-neutral-900 bg-neutral-900 text-neutral-50"
                      : "border-neutral-200 bg-neutral-50 text-neutral-700 hover:border-neutral-300"
                  }`}
                >
                  <div className="text-sm font-semibold">{item.label}</div>
                  <div className="text-xs text-neutral-400">
                    {item.description}
                  </div>
                </button>
              );
            })}
          </div>
        </fieldset>

        <label className="flex flex-col gap-2">
          <span className="text-xs font-medium text-neutral-500">提示语</span>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                const form = event.currentTarget.form;
                if (form) {
                  form.requestSubmit();
                }
              }
            }}
            placeholder="例如：请根据以下要点写一个 100 字的段落……"
            rows={5}
            className="w-full resize-none rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-800 shadow-sm transition outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
          />
        </label>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-neutral-900 px-3 py-2 text-sm font-semibold text-neutral-50 transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                生成中…
              </>
            ) : (
              "开始生成"
            )}
          </button>
          {isSubmitting ? (
            <button
              type="button"
              onClick={handleCancel}
              className="inline-flex items-center justify-center gap-1 rounded-md border border-neutral-300 px-2 py-2 text-xs font-medium text-neutral-700 transition hover:border-neutral-400 hover:text-neutral-900"
            >
              <X className="h-3.5 w-3.5" />
              取消
            </button>
          ) : error ? (
            <button
              type="button"
              onClick={handleRetry}
              className="inline-flex items-center justify-center gap-1 rounded-md border border-neutral-300 px-2 py-2 text-xs font-medium text-neutral-700 transition hover:border-neutral-400 hover:text-neutral-900"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              重试
            </button>
          ) : null}
        </div>

        {error && (
          <div className="rounded-md border border-amber-400 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {error}
          </div>
        )}

        <section className="flex flex-1 flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-neutral-500">输出结果</div>
            <button
              type="button"
              onClick={handleCopy}
              disabled={!output}
              className="inline-flex items-center gap-1 rounded-md border border-neutral-300 px-2 py-1 text-[11px] font-medium text-neutral-600 transition hover:border-neutral-400 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ClipboardCopy className="h-3 w-3" />
              {copied ? "已复制" : "复制"}
            </button>
          </div>
          <div
            className="flex-1 rounded-md border border-dashed border-neutral-200 bg-white p-3 text-sm text-neutral-700"
            role="status"
            aria-live="polite"
          >
            {isSubmitting && (
              <div className="mb-2 flex items-center gap-2 text-neutral-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                正在生成内容，请稍候…
              </div>
            )}
            {output ? (
              <div className="whitespace-pre-wrap">{output}</div>
            ) : isSubmitting ? null : (
              "等待生成结果……"
            )}
          </div>
        </section>
      </form>
    </section>
  );
}
