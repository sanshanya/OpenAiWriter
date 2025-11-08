import type { GatewayEvent } from "@/lib/ai/gateway/events";

const formatSseFrame = (event: GatewayEvent) =>
  `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;

const textEncoder = new TextEncoder();

export const createSseChannel = (options?: {
  retry?: number;
  heartbeatMs?: number;
}) => {
  const stream = new TransformStream<Uint8Array, Uint8Array>();
  const writer = stream.writable.getWriter();
  const heartbeatInterval = Math.max(0, options?.heartbeatMs ?? 20000);
  let heartbeatTimer: NodeJS.Timeout | null = null;

  const writeChunk = (content: string) =>
    writer.write(textEncoder.encode(content));

  if (options?.retry) {
    void writeChunk(`retry: ${options.retry}\n\n`);
  }

  if (heartbeatInterval > 0) {
    heartbeatTimer = setInterval(() => {
      void writeChunk(":\n\n");
    }, heartbeatInterval);
  }

  const cleanup = () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  };

  return {
    stream: stream.readable,
    send: (event: GatewayEvent) => writeChunk(formatSseFrame(event)),
    close: () => {
      cleanup();
      return writer.close();
    },
    abort: (reason?: unknown) => {
      cleanup();
      return writer.abort(reason).catch(() => undefined);
    },
  };
};
