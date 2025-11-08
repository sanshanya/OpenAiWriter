import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

import {
  resolveApiKey,
  resolveBaseUrl,
  resolveMaxTokens,
  resolveModel,
  resolveTemperature,
} from "@/lib/ai/config";
import { GatewayError, unauthorizedError } from "@/lib/ai/gateway/errors";
import type { NormalizedGatewayRequest } from "@/lib/ai/gateway/normalize";
import type {
  ErrorEvent,
  FinalEvent,
  PatchEvent,
  StepEvent,
  TokenEvent,
  UsageEvent,
} from "@/lib/ai/gateway/events";
import type { GatewayEvent } from "@/lib/ai/gateway/events";

type Channel = {
  send: (event: GatewayEvent) => Promise<void>;
  close: () => Promise<void>;
  abort: (reason?: unknown) => Promise<void>;
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
    await handleFlowError({ error, normalized, signal, channel });
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

  const emit = createEmitters({
    channel,
    flowId: flow.id,
    docVersion,
    runId,
    step: flow.stepName,
  });

  await emit.step({
    phase: "start",
    name: flow.stepName,
    renderMode,
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

  await emit.step({
    phase: "progress",
    name: flow.stepName,
    progress: "calling_model",
  });

  if (renderMode === "streaming-text") {
    for await (const chunk of response.textStream) {
      if (!chunk) continue;
      await emit.token({
        text: chunk,
      });
    }
  } else {
    let buffer = "";
    for await (const chunk of response.textStream) {
      if (!chunk) continue;
      buffer += chunk;
    }
    await emit.step({
      phase: "progress",
      name: flow.stepName,
      progress: "sending_patch",
    });
    await emit.patch({
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
      await emit.usage({
        inputTokens: usage.inputTokens ?? 0,
        outputTokens: usage.outputTokens ?? 0,
        totalTokens: usage.totalTokens ?? 0,
      });
    }
  } catch {
    // ignore usage errors
  }

  await emit.step({
    phase: "finish",
    name: flow.stepName,
  });

  await emit.final({
    status: "succeeded",
  });
};

const handleFlowError = async ({
  error,
  normalized,
  signal,
  channel,
}: {
  error: unknown;
  normalized: NormalizedGatewayRequest;
  signal: AbortSignal;
  channel: Channel;
}) => {
  const base = {
    runId: normalized.request.client.runId,
    flowId: normalized.flow.id,
    docVersion: normalized.request.doc.version,
  };

  if (signal.aborted || (error instanceof Error && error.name === "AbortError")) {
    await channel.send({
      ...base,
      type: "final",
      status: "cancelled",
      reason: "Request aborted.",
    });
    return;
  }

  const message =
    error instanceof GatewayError
      ? error.message
      : "Failed to run AI flow.";

  await channel.send({
    ...base,
    type: "error",
    code: error instanceof GatewayError ? error.code : "FLOW_EXECUTION_FAILED",
    message,
    fatal: true,
  });

  await channel.send({
    ...base,
    type: "final",
    status: "failed",
    reason: message,
  });
};

const createEmitters = ({
  channel,
  runId,
  flowId,
  docVersion,
  step,
}: {
  channel: Channel;
  runId: string;
  flowId: string;
  docVersion: number;
  step: string;
}) => {
  const baseContext = { runId, flowId, docVersion };
  const stepContext = { ...baseContext, name: step };

  return {
    step: (event: Omit<StepEvent, "type" | "runId" | "flowId" | "docVersion">) =>
      channel.send({
        ...stepContext,
        ...event,
        type: "step",
      }),
    token: (event: Omit<TokenEvent, "type" | "runId" | "flowId" | "docVersion" | "step">) =>
      channel.send({
        ...baseContext,
        ...event,
        type: "token",
        step,
      }),
    patch: (
      event: Omit<PatchEvent, "type" | "runId" | "flowId" | "docVersion" | "step">,
    ) =>
      channel.send({
        ...baseContext,
        ...event,
        type: "patch",
        step,
      }),
    usage: (event: Omit<UsageEvent, "type" | "runId" | "flowId" | "docVersion">) =>
      channel.send({
        ...baseContext,
        ...event,
        type: "usage",
      }),
    error: (event: Omit<ErrorEvent, "type" | "runId" | "flowId" | "docVersion">) =>
      channel.send({
        ...baseContext,
        ...event,
        type: "error",
      }),
    final: (event: Omit<FinalEvent, "type" | "runId" | "flowId" | "docVersion">) =>
      channel.send({
        ...baseContext,
        ...event,
        type: "final",
      }),
  };
};
