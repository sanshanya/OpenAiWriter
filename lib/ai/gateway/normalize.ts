import {
  CONTEXT_SOFT_LIMIT,
  SNAPSHOT_HARD_LIMIT,
} from "@/lib/ai/gateway/constants";
import { computeContextHash } from "@/lib/ai/gateway/hash";
import {
  flowError,
  validationError,
} from "@/lib/ai/gateway/errors";
import {
  type FlowDefinition,
  type RenderMode,
  resolveFlowDefinition,
} from "@/lib/ai/gateway/flows";
import {
  GatewayRequestSchema,
  type GatewayRequest,
} from "@/lib/ai/gateway/schema";

export type NormalizedGatewayRequest = {
  request: GatewayRequest;
  flow: FlowDefinition;
  renderMode: RenderMode;
  contextHash: string;
  contextChars: number;
  softLimitExceeded: boolean;
  selectionSnapshot?: string;
};

const countGraphemes = (value: string) => {
  if (!value) return 0;
  return Array.from(value).length;
};

export const normalizeGatewayRequest = async (
  raw: unknown,
): Promise<NormalizedGatewayRequest> => {
  const parsed = GatewayRequestSchema.safeParse(raw);

  if (!parsed.success) {
    throw validationError("Payload validation failed.", parsed.error.flatten());
  }

  const request: GatewayRequest = {
    ...parsed.data,
    options: parsed.data.options ?? {},
    limits: parsed.data.limits ?? {},
  };

  const contextText = request.doc.context.text?.trim() ?? "";
  if (!contextText) {
    throw validationError("doc.context.text must not be empty.");
  }

  const contextChars = countGraphemes(contextText);

  const flow = (() => {
    try {
      return resolveFlowDefinition(request.intent, request.flow);
    } catch (error) {
      throw flowError(
        error instanceof Error ? error.message : "Unable to resolve flow.",
      );
    }
  })();

  const selectionSnapshot = request.doc.selectionRef?.snapshot;
  if (
    selectionSnapshot &&
    selectionSnapshot.length > SNAPSHOT_HARD_LIMIT
  ) {
    throw validationError("selectionRef.snapshot exceeds supported length.");
  }

  const contextHash = await computeContextHash(
    `${request.intent}::${flow.id}::${contextText}`,
  );

  if (flow.renderMode === "atomic-patch" && !request.doc.selectionRef?.snapshot) {
    throw validationError(
      `Flow "${flow.id}" requires selectionRef.snapshot for patch rendering.`,
    );
  }

  return {
    request: {
      ...request,
      doc: {
        ...request.doc,
        context: {
          text: contextText,
          chars: contextChars,
        },
      },
    },
    flow,
    renderMode: flow.renderMode,
    contextHash,
    contextChars,
    softLimitExceeded: contextChars > CONTEXT_SOFT_LIMIT,
    selectionSnapshot: selectionSnapshot?.trim(),
  };
};
