// d:\github\aiwriter_ui\lib\ai\config.ts

const DEFAULTS = {
  MODEL: "deepseek-chat",
  TEMPERATURE: 0.7,
  MAX_TOKENS: 4096,
  SYSTEM_PROMPT:
    "You are a helpful and creative AI writing assistant. Your goal is to assist the user in generating, refining, and summarizing text. Provide concise and relevant responses, maintaining the user's intended tone and style.",
};

export function resolveApiKey(apiKey: string | null): string | null {
  return process.env.DEEPSEEK_API_KEY ?? apiKey ?? null;
}

export function resolveBaseUrl(baseURL: string | null): string | null {
  return process.env.DEEPSEEK_BASE_URL ?? baseURL ?? null;
}

export function resolveModel(model: string | null): string {
  return process.env.DEEPSEEK_MODEL ?? model ?? DEFAULTS.MODEL;
}

export function resolveTemperature(temperature: number | null): number {
  return temperature ?? DEFAULTS.TEMPERATURE;
}

export function resolveMaxTokens(maxTokens: number | null): number {
  return maxTokens ?? DEFAULTS.MAX_TOKENS;
}

export function resolveSystemPrompt(system: string | null): string {
  return system ?? DEFAULTS.SYSTEM_PROMPT;
}
