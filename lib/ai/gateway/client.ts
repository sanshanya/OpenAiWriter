'use client';

import type { GatewayEvent, ErrorEvent } from "@/lib/ai/gateway/events";

type ParseOptions = {
  signal?: AbortSignal;
  onParseError?: (payload: string, error: unknown) => void;
};

const textDecoder = new TextDecoder();

export async function consumeGatewayStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onEvent: (event: GatewayEvent) => void,
  options?: ParseOptions,
): Promise<void> {
  let buffer = "";
  let gotFinal = false;
  let latestContext:
    | { runId: string; flowId: string; docVersion: number }
    | null = null;

  const updateContext = (event: GatewayEvent) => {
    latestContext = {
      runId: event.runId,
      flowId: event.flowId,
      docVersion: event.docVersion,
    };
  };

  const handleFrame = (frame: string) => {
    const dataMatch = frame.match(/^data:\s*(.*)$/m);
    if (!dataMatch) return;

    const payload = dataMatch[1];
    try {
      const event = JSON.parse(payload) as GatewayEvent;
      if (event?.type === "final") {
        gotFinal = true;
      }
      if (event && "runId" in event) {
        updateContext(event);
      }
      onEvent(event);
    } catch (error) {
      options?.onParseError?.(payload, error);
      console.error("[gateway] SSE JSON parse error:", payload, error);
    }
  };

  const abortController = options?.signal;
  const abortListener = () => {
    void reader.cancel();
  };

  if (abortController) {
    if (abortController.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    abortController.addEventListener("abort", abortListener);
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += textDecoder.decode(value, { stream: true });

      let frameEnd: number;
      while ((frameEnd = buffer.indexOf("\n\n")) >= 0) {
        const frame = buffer.slice(0, frameEnd);
        buffer = buffer.slice(frameEnd + 2);
        handleFrame(frame);
      }
    }
    if (buffer) {
      handleFrame(buffer);
      buffer = "";
    }
  } finally {
    if (abortController) {
      abortController.removeEventListener("abort", abortListener);
    }
    reader.releaseLock();
  }

  if (!gotFinal) {
    const context =
      latestContext ?? ({ runId: "unknown", flowId: "unknown", docVersion: 0 } as const);
    const errorEvent: ErrorEvent = {
      ...context,
      type: "error",
      code: "STREAM_EOF",
      message: "Stream ended without final event.",
      fatal: true,
    };
    onEvent(errorEvent);
  }
}
