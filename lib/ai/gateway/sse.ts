import type { SelectionRef } from "@/lib/ai/gateway/schema";

export type StepEvent = {
  type: "step";
  phase: "start" | "finish";
  name: string;
  runId: string;
  flowId: string;
  renderMode?: "streaming-text" | "atomic-patch";
  docVersion: number;
  contextHash?: string;
  contextChars?: number;
  softLimitExceeded?: boolean;
};

export type TokenEvent = {
  type: "token";
  text: string;
  step: string;
  runId: string;
  flowId: string;
  docVersion: number;
};

export type PatchEvent = {
  type: "patch";
  step: string;
  runId: string;
  flowId: string;
  docVersion: number;
  selectionRef?: SelectionRef;
  patch: {
    type: "replace_text";
    text: string;
  };
};

export type UsageEvent = {
  type: "usage";
  runId: string;
  flowId: string;
  docVersion: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd?: number;
};

export type FinalEvent = {
  type: "final";
  runId: string;
  flowId: string;
  docVersion: number;
  status: "succeeded" | "failed" | "cancelled";
  reason?: string;
};

export type ErrorEvent = {
  type: "error";
  runId: string;
  flowId: string;
  docVersion: number;
  code: string;
  message: string;
  fatal?: boolean;
};

export type GatewayEvent =
  | StepEvent
  | TokenEvent
  | PatchEvent
  | UsageEvent
  | FinalEvent
  | ErrorEvent;

const formatSseFrame = (event: GatewayEvent) =>
  `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;

const textEncoder = new TextEncoder();

export const createSseChannel = (options?: { retry?: number }) => {
  const stream = new TransformStream<Uint8Array, Uint8Array>();
  const writer = stream.writable.getWriter();

  const writeChunk = (content: string) =>
    writer.write(textEncoder.encode(content));

  if (options?.retry) {
    void writeChunk(`retry: ${options.retry}\n\n`);
  }

  return {
    stream: stream.readable,
    send: (event: GatewayEvent) => writeChunk(formatSseFrame(event)),
    close: () => writer.close(),
    abort: (reason?: unknown) => writer.abort(reason).catch(() => undefined),
  };
};
