import type { NextRequest } from "next/server";

import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { NextResponse } from "next/server";

import {
  resolveApiKey,
  resolveBaseUrl,
  resolveMaxTokens,
  resolveModel,
  resolveSystemPrompt,
  resolveTemperature,
} from "@/lib/ai/config";

const MODE_INSTRUCTIONS: Record<string, string> = {
  draft:
    "Generate fresh content that directly addresses the user's prompt. Expand ideas, add supporting details, and keep the tone informative and friendly.",
  polish:
    "Rewrite the provided text to improve clarity, grammar, and flow while preserving meaning. Adjust tone to be confident and concise, and highlight key points when possible.",
  outline:
    "Produce a concise outline that organizes the user's request into clear sections and bullet points. Prioritize logical ordering and actionable structure.",
};

const asString = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

const asNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export async function POST(req: NextRequest) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  if (
    !body ||
    typeof body !== "object" ||
    !("prompt" in body) ||
    typeof (body as { prompt: unknown }).prompt !== "string"
  ) {
    return NextResponse.json(
      { error: "Missing prompt field (string)." },
      { status: 400 },
    );
  }

  const {
    prompt,
    mode,
    apiKey: keyInput,
    baseURL: baseUrlInput,
    model: modelInput,
    maxTokens: maxTokensInput,
    temperature: temperatureInput,
    system: systemInput,
  } = body as {
    prompt: string;
    mode?: string;
    apiKey?: unknown;
    baseURL?: unknown;
    model?: unknown;
    maxTokens?: unknown;
    temperature?: unknown;
    system?: unknown;
  };

  const trimmedPrompt = prompt.trim();

  if (!trimmedPrompt) {
    return NextResponse.json(
      { error: "Prompt must not be empty." },
      { status: 400 },
    );
  }

  const apiKey = resolveApiKey(asString(keyInput));
  if (!apiKey) {
    return NextResponse.json({ error: "Missing API key." }, { status: 401 });
  }

  const baseURL = resolveBaseUrl(asString(baseUrlInput));
  const model = resolveModel(asString(modelInput));
  const temperature = resolveTemperature(asNumber(temperatureInput));
  const maxTokens = resolveMaxTokens(asNumber(maxTokensInput));
  const cappedMaxTokens = Math.max(64, Math.min(maxTokens, 1024));

  const openai = createOpenAI({
    apiKey,
    baseURL: baseURL ?? undefined,
  });

  const modeKey = typeof mode === "string" ? mode : "draft";
  const helperInstruction =
    MODE_INSTRUCTIONS[modeKey] ?? MODE_INSTRUCTIONS.draft;

  const systemPrompt = [resolveSystemPrompt(asString(systemInput))]
    .concat(helperInstruction)
    .filter(Boolean)
    .join("\n\n");

  try {
    const result = await streamText({
      abortSignal: req.signal,
      maxOutputTokens: cappedMaxTokens,
      model: openai.chat(model),
      prompt: trimmedPrompt,
      system: systemPrompt,
      temperature,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json(null, { status: 408 });
    }

    console.error("[AI helper] Failed to process request:", error);

    return NextResponse.json(
      { error: "Failed to process AI request." },
      { status: 500 },
    );
  }
}
