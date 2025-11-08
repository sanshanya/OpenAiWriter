import { DEFAULT_INTENT_TO_FLOW } from "@/lib/ai/gateway/constants";
import type { GatewayRequest } from "@/lib/ai/gateway/schema";

export type RenderMode = "streaming-text" | "atomic-patch";

export type FlowPromptContext = {
  request: GatewayRequest;
  selectionSnapshot?: string;
  contextHash: string;
};

export type FlowPromptConfig = {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  deterministic?: boolean;
};

export type FlowDefinition = {
  id: string;
  intent: string;
  version: string;
  stepName: string;
  renderMode: RenderMode;
  prompt: (ctx: FlowPromptContext) => FlowPromptConfig;
  defaults?: {
    temperature?: number;
    maxTokens?: number;
    deterministic?: boolean;
  };
};

const buildLocaleAwareInstruction = (locale?: string | null) => {
  if (!locale) return "";
  if (/zh/i.test(locale)) return "使用简洁的中文书写输出。";
  if (/en/i.test(locale)) return "Write the answer in concise English.";
  return "";
};

const FLOW_REGISTRY: Record<string, FlowDefinition> = {
  "summarize:v1": {
    id: "summarize:v1",
    intent: "summarize",
    version: "v1",
    stepName: "summarize",
    renderMode: "streaming-text",
    defaults: { temperature: 0.2, maxTokens: 800 },
    prompt: ({ request, selectionSnapshot, contextHash }) => {
      const localeInstruction = buildLocaleAwareInstruction(
        request.options?.locale ?? request.client.locale,
      );
      const summaryTarget =
        selectionSnapshot ?? request.doc.context.text.slice(-4_096);

      return {
        systemPrompt: [
          "You are an editor that produces faithful, structured summaries for markdown documents.",
          "Preserve key facts, avoid hallucinations, and keep markdown structure when it adds clarity.",
          "If the request is a question, answer it directly using the provided context only.",
          `Context hash: ${contextHash}.`,
          localeInstruction,
        ]
          .filter(Boolean)
          .join("\n"),
        userPrompt: [
          `Intent: ${request.intent}`,
          `Document ID: ${request.doc.id}`,
          `Document Version: ${request.doc.version}`,
          "Context:",
          summaryTarget,
        ].join("\n\n"),
      };
    },
  },
  "continue-writing:v1": {
    id: "continue-writing:v1",
    intent: "continue-writing",
    version: "v1",
    stepName: "draft",
    renderMode: "streaming-text",
    defaults: { temperature: 0.4, maxTokens: 600 },
    prompt: ({ request, contextHash }) => {
      const cursorWindow = request.doc.context.text.slice(-2_000);
      return {
        systemPrompt: [
          "You continue the user's draft. Maintain tone, tense, and perspective.",
          "Avoid repeating the provided text. Continue naturally.",
          `Context hash: ${contextHash}.`,
        ].join("\n"),
        userPrompt: [
          "Continue writing after the context below.",
          "Context:",
          cursorWindow,
        ].join("\n\n"),
      };
    },
  },
  "rewrite:v1": {
    id: "rewrite:v1",
    intent: "rewrite",
    version: "v1",
    stepName: "rewrite",
    renderMode: "atomic-patch",
    defaults: { temperature: 0.1, maxTokens: 400, deterministic: true },
    prompt: ({ request, selectionSnapshot, contextHash }) => {
      const payload =
        selectionSnapshot ||
        request.doc.context.text ||
        "No selection provided.";

      const localeInstruction = buildLocaleAwareInstruction(
        request.options?.locale ?? request.client.locale,
      );

      return {
        systemPrompt: [
          "You rewrite the highlighted passage. Improve clarity, fix grammar, and keep the author's intent.",
          "Return only the replacement text. Do not wrap with quotes or markdown fences.",
          `Context hash: ${contextHash}.`,
          localeInstruction,
        ]
          .filter(Boolean)
          .join("\n"),
        userPrompt: [
          `Document version: ${request.doc.version}`,
          "Selection to rewrite:",
          payload,
        ].join("\n\n"),
      };
    },
  },
  "fix-grammar:v1": {
    id: "fix-grammar:v1",
    intent: "fix-grammar",
    version: "v1",
    stepName: "fix",
    renderMode: "atomic-patch",
    defaults: { temperature: 0.0, maxTokens: 300, deterministic: true },
    prompt: ({ request, selectionSnapshot, contextHash }) => {
      const payload =
        selectionSnapshot ||
        request.doc.context.text ||
        "No selection provided.";
      return {
        systemPrompt: [
          "You are a grammar assistant. Fix spelling, grammar, and fluency issues without altering meaning.",
          "Return only the corrected passage.",
          `Context hash: ${contextHash}.`,
        ].join("\n"),
        userPrompt: [
          `Document version: ${request.doc.version}`,
          "Passage:",
          payload,
        ].join("\n\n"),
      };
    },
  },
  "ask:v1": {
    id: "ask:v1",
    intent: "ask",
    version: "v1",
    stepName: "answer",
    renderMode: "streaming-text",
    defaults: { temperature: 0.3, maxTokens: 800 },
    prompt: ({ request, contextHash }) => {
      const intentLine = request.intent !== "ask" ? request.intent : "ask";
      return {
        systemPrompt: [
          "Answer user questions strictly based on the supplied markdown context.",
          "Quote relevant snippets when helpful. If unsure, admit it.",
          `Context hash: ${contextHash}.`,
        ].join("\n"),
        userPrompt: [
          `Intent: ${intentLine}`,
          "Context:",
          request.doc.context.text,
        ].join("\n\n"),
      };
    },
  },
};

export const resolveFlowDefinition = (
  intent: string,
  explicitFlow?: string | null,
): FlowDefinition => {
  const normalizedIntent = intent.trim().toLowerCase();
  const desiredFlow =
    explicitFlow ??
    DEFAULT_INTENT_TO_FLOW[normalizedIntent] ??
    DEFAULT_INTENT_TO_FLOW[intent];

  if (!desiredFlow) {
    throw new Error(
      `No flow definition registered for intent "${intent}". Provide flow identifier explicitly.`,
    );
  }

  const definition = FLOW_REGISTRY[desiredFlow];
  if (!definition) {
    throw new Error(`Flow "${desiredFlow}" is not registered.`);
  }

  return definition;
};

export const listFlowDefinitions = (): FlowDefinition[] =>
  Object.values(FLOW_REGISTRY);
