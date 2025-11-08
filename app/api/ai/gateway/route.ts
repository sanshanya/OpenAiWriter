import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { SSE_DEFAULT_RETRY_MS } from "@/lib/ai/gateway/constants";
import { toHttpErrorPayload } from "@/lib/ai/gateway/errors";
import { normalizeGatewayRequest } from "@/lib/ai/gateway/normalize";
import { runGatewayFlow } from "@/lib/ai/gateway/runner";
import { createSseChannel } from "@/lib/ai/gateway/sse";

const SSE_HEADERS: Record<string, string> = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

export async function POST(req: NextRequest) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_JSON",
          message: "Request body must be valid JSON.",
        },
      },
      { status: 400 },
    );
  }

  try {
    const normalized = await normalizeGatewayRequest(payload);
    const channel = createSseChannel({ retry: SSE_DEFAULT_RETRY_MS });

    void runGatewayFlow({
      normalized,
      signal: req.signal,
      channel,
    }).catch((error) => {
      console.error("[ai-gateway] flow execution failed:", error);
    });

    return new Response(channel.stream, {
      status: 200,
      headers: SSE_HEADERS,
    });
  } catch (error) {
    const { status, body } = toHttpErrorPayload(error);
    return NextResponse.json(body, { status });
  }
}
