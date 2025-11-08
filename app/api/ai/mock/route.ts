// apps/web/src/app/api/ai/mock/route.ts
import type { GatewayEvent } from "@/lib/ai/gateway/events";

export const runtime = "nodejs";

const enc = new TextEncoder();
const send = (
  controller: ReadableStreamDefaultController<Uint8Array>,
  event: GatewayEvent,
) => controller.enqueue(enc.encode(`data: ${JSON.stringify(event)}\n\n`));

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const {
    intent = "continue-writing",
    client = { runId: "mock" },
    doc = { version: 1 },
  } = body;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // 心跳防断流
      const timer = setInterval(() => controller.enqueue(enc.encode(":\n\n")), 20000);

      // 1) 首帧 step:start
      send(controller, {
        type: "step",
        phase: "start",
        name: "draft",
        renderMode: intent === "continue-writing" ? "streaming-text" : "atomic-patch",
        runId: client.runId,
        flowId: "mock",
        docVersion: doc.version,
      });

      if (intent === "continue-writing") {
        // 2) 流式 token
        for (const t of ["This ", "is ", "mock ", "stream ", "tokens."]) {
          await sleep(120);
          send(controller, {
            type: "token",
            step: "draft",
            text: t,
            runId: client.runId,
            flowId: "mock",
            docVersion: doc.version,
          });
        }
      } else {
        // 2) 进度 + 原子补丁
        send(controller, {
          type: "step",
          phase: "progress",
          name: "draft",
          progress: "calling_model",
          runId: client.runId,
          flowId: "mock",
          docVersion: doc.version,
        });
        await sleep(400);
        send(controller, {
          type: "step",
          phase: "progress",
          name: "draft",
          progress: "sending_patch",
          runId: client.runId,
          flowId: "mock",
          docVersion: doc.version,
        });
        await sleep(200);
        send(controller, {
          type: "patch",
          step: "draft",
          selectionRef: body?.doc?.selectionRef,
          patch: { type: "replace_text", text: "【MOCK 替换后的文本】" },
          runId: client.runId,
          flowId: "mock",
          docVersion: doc.version,
        });
      }

      // 3) 收尾
      send(controller, {
        type: "final",
        status: "succeeded",
        runId: client.runId,
        flowId: "mock",
        docVersion: doc.version,
      });

      clearInterval(timer);
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
