import { z } from "zod";

import {
  CONTEXT_HARD_LIMIT,
  SNAPSHOT_HARD_LIMIT,
} from "@/lib/ai/gateway/constants";

const SelectionModeSchema = z.enum([
  "selection",
  "block",
  "around_cursor",
  "document",
]);

export const SelectionRefSchema = z.object({
  mode: SelectionModeSchema.default("selection"),
  blockIds: z.array(z.string().min(1)).max(32).optional(),
  snapshot: z.string().max(SNAPSHOT_HARD_LIMIT).optional(),
  snapshotHash: z.string().min(8).max(128).optional(),
});

export const DocumentContextSchema = z.object({
  text: z.string().max(CONTEXT_HARD_LIMIT),
  chars: z.number().int().nonnegative().optional(),
});

export const DocumentSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().nonnegative(),
  selectionRef: SelectionRefSchema.optional(),
  context: DocumentContextSchema,
});

export const ClientInfoSchema = z.object({
  runId: z.string().min(1),
  app: z.string().min(1).optional(),
  locale: z.string().min(2).max(10).optional(),
});

export const GatewayOptionsSchema = z
  .object({
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().positive().optional(),
    locale: z.string().min(2).max(10).optional(),
    truncated: z.boolean().optional(),
    preferredModel: z.string().min(1).optional(),
    maxInputTokensHint: z.number().int().positive().optional(),
    deterministic: z.boolean().optional(),
    renderMode: z.enum(["streaming-text", "atomic-patch"]).optional(),
  })
  .default({});

export const LimitsSchema = z
  .object({
    budgetUsd: z.number().positive().optional(),
  })
  .default({});

export const GatewayRequestSchema = z.object({
  intent: z.string().min(1),
  flow: z.string().min(1).optional(),
  client: ClientInfoSchema,
  doc: DocumentSchema,
  options: GatewayOptionsSchema.optional(),
  schema: z.record(z.string(), z.unknown()).optional(),
  limits: LimitsSchema.optional(),
});

export type SelectionRef = z.infer<typeof SelectionRefSchema>;
export type GatewayRequest = z.infer<typeof GatewayRequestSchema>;
