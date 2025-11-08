import { describe, expect, it } from "vitest";

import { SSE_DEFAULT_RETRY_MS } from "@/lib/ai/gateway/constants";
import { normalizeGatewayRequest } from "@/lib/ai/gateway/normalize";
import { createSseChannel } from "@/lib/ai/gateway/sse";

const basePayload = {
  intent: "summarize",
  client: { runId: "run_1", app: "web" },
  doc: {
    id: "doc_1",
    version: 3,
    context: { text: "Hello world", chars: 11 },
  },
  options: {},
};

describe("normalizeGatewayRequest", () => {
  it("normalizes context length and resolves flow defaults", async () => {
    const normalized = await normalizeGatewayRequest(basePayload);
    expect(normalized.contextChars).toBe(11);
    expect(normalized.flow.id).toBe("summarize:v1");
    expect(normalized.renderMode).toBe("streaming-text");
    expect(normalized.softLimitExceeded).toBe(false);
  });

  it("throws when atomic-patch flow lacks selection snapshot", async () => {
    await expect(
      normalizeGatewayRequest({
        ...basePayload,
        intent: "rewrite",
      }),
    ).rejects.toHaveProperty("code", "INVALID_REQUEST");
  });
});

describe("createSseChannel", () => {
  it("encodes retry hint and events as SSE frames", async () => {
    const channel = createSseChannel({
      retry: SSE_DEFAULT_RETRY_MS,
      heartbeatMs: 0,
    });
    const reader = channel.stream.getReader();
    const decoder = new TextDecoder();

    const firstChunk = await reader.read();
    expect(decoder.decode(firstChunk.value)).toContain(
      `retry: ${SSE_DEFAULT_RETRY_MS}`,
    );

    const nextChunkPromise = reader.read();
    await channel.send({
      type: "token",
      text: "delta",
      step: "summarize",
      runId: "run_1",
      flowId: "summarize:v1",
      docVersion: 1,
    });

    const eventChunk = await nextChunkPromise;
    expect(decoder.decode(eventChunk.value)).toContain("event: token");
    await channel.close();
  });
});
