import { describe, expect, it, vi } from "vitest";

import type { GatewayEvent } from "@/lib/ai/gateway/events";
import { consumeGatewayStream } from "@/lib/ai/gateway/client";
import { createGatewayRunController } from "@/lib/ai/gateway/run-manager";

const encoder = new TextEncoder();

const toStream = (chunks: string[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
      controller.close();
    },
  });

describe("consumeGatewayStream", () => {
  it("parses frames sequentially and ignores malformed JSON", async () => {
    const frames = [
      `event: step
data: {"type":"step","phase":"start","name":"draft","renderMode":"streaming-text","runId":"r1","flowId":"f1","docVersion":1}

`,
      `event: token
data: {"type":"token","text":"Hello","step":"draft","runId":"r1","flowId":"f1","docVersion":1}

`,
      `event: token
data: {invalid-json

`,
      `event: token
data: {"type":"token","text":" world","step":"draft","runId":"r1","flowId":"f1","docVersion":1}

`,
      `event: final
data: {"type":"final","status":"succeeded","runId":"r1","flowId":"f1","docVersion":1}

`,
    ];

    const reader = toStream(frames).getReader();
    const events: GatewayEvent[] = [];
    const onParseError = vi.fn();

    await consumeGatewayStream(reader, (event) => events.push(event), {
      onParseError,
    });

    expect(events.map((e) => e.type)).toEqual(["step", "token", "token", "final"]);
    expect(onParseError).toHaveBeenCalledTimes(1);
  });

  it("emits STREAM_EOF error when final event missing", async () => {
    const frames = [
      `event: step
data: {"type":"step","phase":"start","name":"draft","renderMode":"streaming-text","runId":"r2","flowId":"f1","docVersion":1}

`,
    ];
    const reader = toStream(frames).getReader();
    const events: GatewayEvent[] = [];

    await consumeGatewayStream(reader, (event) => events.push(event));

    const last = events.at(-1);
    expect(last?.type).toBe("error");
    if (last?.type === "error") {
      expect(last.code).toBe("STREAM_EOF");
      expect(last.fatal).toBe(true);
    }
  });
});

describe("createGatewayRunController", () => {
  it("drops events from stale runs and triggers first-token hook once", () => {
    const onBeforeFirstToken = vi.fn();
    const onToken = vi.fn();

    const controller = createGatewayRunController({
      onBeforeFirstToken,
      onToken,
    });

    controller.beginRun("runA");

    controller.handleEvent({
      type: "step",
      phase: "start",
      name: "draft",
      renderMode: "streaming-text",
      runId: "runA",
      flowId: "f",
      docVersion: 1,
    });

    controller.beginRun("runB");

    controller.handleEvent({
      type: "token",
      text: "old",
      step: "draft",
      runId: "runA",
      flowId: "f",
      docVersion: 1,
    });

    controller.handleEvent({
      type: "step",
      phase: "start",
      name: "draft",
      renderMode: "streaming-text",
      runId: "runB",
      flowId: "f",
      docVersion: 1,
    });

    controller.handleEvent({
      type: "token",
      text: "new",
      step: "draft",
      runId: "runB",
      flowId: "f",
      docVersion: 1,
    });

    controller.handleEvent({
      type: "token",
      text: "more",
      step: "draft",
      runId: "runB",
      flowId: "f",
      docVersion: 1,
    });

    controller.handleEvent({
      type: "final",
      status: "succeeded",
      runId: "runB",
      flowId: "f",
      docVersion: 1,
    });

    expect(onToken).toHaveBeenCalledTimes(2);
    expect(onBeforeFirstToken).toHaveBeenCalledTimes(1);
    expect(controller.currentRunId).toBeNull();
  });
});
