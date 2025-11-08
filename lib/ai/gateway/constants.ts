export const CONTEXT_SOFT_LIMIT = 4_000;
export const CONTEXT_HARD_LIMIT = 16_000;
export const SNAPSHOT_HARD_LIMIT = 20_000;

export const DEFAULT_INTENT_TO_FLOW: Record<string, string> = {
  summarize: "summarize:v1",
  rewrite: "rewrite:v1",
  continue: "continue-writing:v1",
  "continue-writing": "continue-writing:v1",
  "fix-grammar": "fix-grammar:v1",
  ask: "ask:v1",
};

export const SSE_DEFAULT_RETRY_MS = 2_000;
