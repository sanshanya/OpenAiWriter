import type { SelectionRef } from "@/lib/ai/gateway/schema";

export type RenderMode = "streaming-text" | "atomic-patch";

export type StepPhase = "start" | "progress" | "finish";

export type FinalStatus = "succeeded" | "failed" | "cancelled";

export type ReplaceTextPatch = {
  type: "replace_text";
  text: string;
};

export type StepEvent = {
  type: "step";
  phase: StepPhase;
  name: string;
  runId: string;
  flowId: string;
  renderMode?: RenderMode;
  docVersion: number;
  contextHash?: string;
  contextChars?: number;
  softLimitExceeded?: boolean;
  progress?: string;
};

export type TokenEvent = {
  type: "token";
  text: string;
  step: string;
  runId: string;
  flowId: string;
  docVersion: number;
};

export type PatchEvent = {
  type: "patch";
  step: string;
  runId: string;
  flowId: string;
  docVersion: number;
  selectionRef?: SelectionRef;
  patch: ReplaceTextPatch;
};

export type UsageEvent = {
  type: "usage";
  runId: string;
  flowId: string;
  docVersion: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd?: number;
};

export type FinalEvent = {
  type: "final";
  runId: string;
  flowId: string;
  docVersion: number;
  status: FinalStatus;
  reason?: string;
};

export type ErrorEvent = {
  type: "error";
  runId: string;
  flowId: string;
  docVersion: number;
  code: string;
  message: string;
  fatal?: boolean;
};

export type GatewayEvent =
  | StepEvent
  | TokenEvent
  | PatchEvent
  | UsageEvent
  | FinalEvent
  | ErrorEvent;
