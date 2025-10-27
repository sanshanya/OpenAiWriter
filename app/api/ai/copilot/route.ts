import type { NextRequest } from "next/server";

import { NextResponse } from "next/server";

import {
  resolveApiKey,
  resolveBaseUrl,
  resolveMaxTokens,
  resolveModel,
  resolveSystemPrompt,
  resolveTemperature,
} from "@/lib/ai/config";

const asString = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

const asNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export async function POST(req: NextRequest) {
  let payload: unknown;

  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  if (!payload || typeof payload !== "object") {
    return NextResponse.json(
      { error: "Invalid request body shape." },
      { status: 400 },
    );
  }

  const input = payload as Record<string, unknown>;

  const prompt = asString(input.prompt)?.trim() ?? null;

  if (!prompt) {
    return NextResponse.json(
      { error: "Missing prompt." },
      { status: 400 },
    );
  }

  const apiKey = resolveApiKey(asString(input.apiKey));

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing API key." },
      { status: 401 },
    );
  }

  const baseURL = resolveBaseUrl(asString(input.baseURL));
  const model = resolveModel(asString(input.model));
  const system = resolveSystemPrompt(asString(input.system));
  const temperature = resolveTemperature(asNumber(input.temperature));
  const maxTokens = resolveMaxTokens(asNumber(input.maxTokens));
  const cappedMaxTokens = Math.max(16, Math.min(maxTokens, 80));
  const endpoint =
    (baseURL ?? "https://api.deepseek.com/v1").replace(/\/$/, "") +
    "/chat/completions";

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      signal: req.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        temperature,
        max_tokens: cappedMaxTokens,
        top_p: 0.9,
        frequency_penalty: 0,
        presence_penalty: 0,
        stop: ["\n\n", "\n###", "\n- "],
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorPayload = await safeReadJson(response);

      return NextResponse.json(
        {
          error: "Failed to process Copilot request.",
          details: errorPayload ?? { status: response.status },
        },
        { status: response.status },
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{
        message?: { content?: string };
      }>;
      usage?: unknown;
    };

    const completion =
      data.choices?.[0]?.message?.content?.trim() ?? "";

    return NextResponse.json({
      completion,
      text: completion,
      usage: data.usage,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json(null, { status: 408 });
    }

    return NextResponse.json(
      { error: "Failed to process Copilot request." },
      { status: 500 },
    );
  }
}

async function safeReadJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
