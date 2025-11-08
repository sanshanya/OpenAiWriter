import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

import {
  resolveApiKey,
  resolveBaseUrl,
  resolveMaxTokens,
  resolveModel,
  resolveTemperature,
} from "@/lib/ai/config";
import {
  GatewayError,
  unauthorizedError,
} from "@/lib/ai/gateway/errors";
import type { NormalizedGatewayRequest } from "@/lib/ai/gateway/normalize";
import type { GatewayEvent } from "@/lib/ai/gateway/sse";

type Channel = {
  send: (event: GatewayEvent) => Promise<void>;
  close: () => Promise<void>;
};

export const runGatewayFlow = async ({
  normalized,
  signal,
  channel,
}: {
  normalized: NormalizedGatewayRequest;
  signal: AbortSignal;
  channel: Channel;
}) => {
  try {
    await executeFlow({ normalized, signal, channel });
  } catch (error) {
    if (signal.aborted || (error instanceof Error && error.name === "AbortError")) {
      await channel.send({
        type: "final",
        status: "cancelled",
        runId: normalized.request.client.runId,
        flowId: normalized.flow.id,
        docVersion: normalized.request.doc.version,
        reason: "Request aborted.",
      });
      return;
    }

    const message =
      error instanceof GatewayError
        ? error.message
        : "Failed to run AI flow.";

    await channel.send({
      type: "error",
      code: error instanceof GatewayError ? error.code : "FLOW_EXECUTION_FAILED",
      message,
      runId: normalized.request.client.runId,
      flowId: normalized.flow.id,
      docVersion: normalized.request.doc.version,
      fatal: true,
    });

    await channel.send({
      type: "final",
      status: "failed",
      runId: normalized.request.client.runId,
      flowId: normalized.flow.id,
      docVersion: normalized.request.doc.version,
      reason: message,
    });
  } finally {
    await channel.close();
  }
};

const executeFlow = async ({
  normalized,
  signal,
  channel,
}: {
  normalized: NormalizedGatewayRequest;
  signal: AbortSignal;
  channel: Channel;
}) => {
  const { request, flow, renderMode, selectionSnapshot, contextHash } =
    normalized;
  const { runId } = request.client;
  const docVersion = request.doc.version;

  await channel.send({
    type: "step",
    phase: "start",
    name: flow.stepName,
    renderMode,
    runId,
    flowId: flow.id,
    docVersion,
    contextHash,
    contextChars: normalized.contextChars,
    softLimitExceeded: normalized.softLimitExceeded,
  });

  const apiKey = resolveApiKey(null);
  if (!apiKey) {
    throw unauthorizedError();
  }

  const openai = createOpenAI({
    apiKey,
    baseURL: resolveBaseUrl(null) ?? undefined,
  });

  const promptConfig = flow.prompt({
    request,
    selectionSnapshot,
    contextHash,
  });

  const resolvedModel = resolveModel(request.options?.preferredModel ?? null);
  const resolvedTemperature = resolveTemperature(
    promptConfig.temperature ??
      request.options?.temperature ??
      flow.defaults?.temperature ??
      null,
  );

  const resolvedMaxTokens = resolveMaxTokens(
    promptConfig.maxTokens ??
      request.options?.maxTokens ??
      flow.defaults?.maxTokens ??
      null,
  );

  const response = await streamText({
    abortSignal: signal,
    model: openai.chat(resolvedModel),
    prompt: promptConfig.userPrompt,
    system: promptConfig.systemPrompt,
    temperature: resolvedTemperature,
    maxOutputTokens: resolvedMaxTokens,
  });

  const aggregatedChunks: string[] = [];

  if (renderMode === "streaming-text") {
    for await (const chunk of response.textStream) {
      if (!chunk) continue;
      aggregatedChunks.push(chunk);
      await channel.send({
        type: "token",
        text: chunk,
        step: flow.stepName,
        runId,
        flowId: flow.id,
        docVersion,
      });
    }
  } else {
    let buffer = "";
    for await (const chunk of response.textStream) {
      if (!chunk) continue;
      buffer += chunk;
    }
    aggregatedChunks.push(buffer);
    await channel.send({
      type: "patch",
      step: flow.stepName,
      runId,
      flowId: flow.id,
      docVersion,
      selectionRef: request.doc.selectionRef,
      patch: {
        type: "replace_text",
        text: buffer,
      },
    });
  }

  try {
    const usage = await response.totalUsage;
    if (usage) {
      await channel.send({
        type: "usage",
        runId,
        flowId: flow.id,
        docVersion,
        inputTokens: usage.inputTokens ?? 0,
        outputTokens: usage.outputTokens ?? 0,
        totalTokens: usage.totalTokens ?? 0,
      });
    }
  } catch {
    // ignore usage errors
  }

  await channel.send({
    type: "step",
    phase: "finish",
    name: flow.stepName,
    runId,
    flowId: flow.id,
    docVersion,
  });

  await channel.send({
    type: "final",
    status: "succeeded",
    runId,
    flowId: flow.id,
    docVersion,
  });
};
