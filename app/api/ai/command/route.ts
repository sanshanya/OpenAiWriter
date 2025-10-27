import type {
  ChatMessage,
  ToolName,
} from "@/components/editor/plugins/use-chat";
import type { NextRequest } from "next/server";

import { createOpenAI } from "@ai-sdk/openai";
import {
  type LanguageModel,
  type UIMessageStreamWriter,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateObject,
  streamObject,
  streamText,
  tool,
} from "ai";
import { NextResponse } from "next/server";
import {
  createSlateEditor,
  nanoid,
  type SlateEditor,
  type Value,
} from "platejs";
import { z } from "zod";

import { BaseEditorKit } from "@/components/editor/plugins/core/editor-base-kit";
import { markdownJoinerTransform } from "@/lib/markdown-joiner-transform";
import {
  getChooseToolPrompt,
  getCommentPrompt,
  getEditPrompt,
  getGeneratePrompt,
} from "./prompts";
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

const supportsJsonSchemaForModel = (modelId: string | null): boolean =>
  !!modelId && !/deepseek/i.test(modelId);

type CommentCandidate = {
  blockId: string;
  comment: string;
  content: string;
};

const COMMENT_OBJECT_REGEX = /\{[\s\S]*?\}/g;

const stripCommentResponse = (raw: string) => {
  let content = raw.trim();
  content = content.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = content.indexOf("[");
  const end = content.lastIndexOf("]");

  if (start !== -1 && end !== -1 && end > start) {
    return content.slice(start, end + 1);
  }

  return content;
};

const normalizeJsonString = (input: string) =>
  input
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const fixSingleQuotedKeys = (input: string) =>
  input.replace(/([{,]\s*)'([^']+?)'\s*:/g, '$1"$2":');

const removeTrailingCommas = (input: string) =>
  input.replace(/,\s*([}\]])/g, "$1");

const buildParseAttempts = (raw: string): string[] => {
  const attempts = new Set<string>();
  const trimmed = raw.trim();

  if (!trimmed) {
    return [];
  }

  attempts.add(trimmed);
  attempts.add(normalizeJsonString(trimmed));
  attempts.add(removeTrailingCommas(trimmed));
  attempts.add(fixSingleQuotedKeys(trimmed));

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    attempts.add(`[${trimmed}]`);
  }

  if (!trimmed.startsWith("[") && trimmed.includes("}{")) {
    const wrapped = `[${trimmed
      .replace(/}\s*,?\s*{/g, "},{")
      .replace(/^\s*{/, "{")
      .replace(/}\s*$/, "}")}]`;
    attempts.add(wrapped);
  }

  return Array.from(attempts).filter(Boolean);
};

const toCandidateArray = (value: unknown) => {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return [value];
  return [];
};

const sanitizeCandidates = (
  raw: unknown,
  fallbackBlockId?: string,
): CommentCandidate[] => {
  const candidates: CommentCandidate[] = [];

  for (const item of toCandidateArray(raw)) {
    if (!item || typeof item !== "object") continue;

    const record = item as Record<string, unknown>;

    const blockId =
      typeof record.blockId === "string"
        ? record.blockId
        : typeof record.id === "string"
          ? record.id
          : fallbackBlockId;

    const commentText =
      typeof record.comment === "string"
        ? record.comment
        : typeof record.comments === "string"
          ? record.comments
          : undefined;

    const contentText =
      typeof record.content === "string"
        ? record.content
        : typeof record.text === "string"
          ? record.text
          : undefined;

    if (!blockId || !commentText || !contentText) continue;

    candidates.push({
      blockId,
      comment: commentText,
      content: contentText,
    });
  }

  return candidates;
};

const parseCommentResponse = (
  raw: string,
  fallbackBlockId?: string,
): CommentCandidate[] => {
  const attempts = buildParseAttempts(raw);

  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt);
      const sanitized = sanitizeCandidates(parsed, fallbackBlockId);
      if (sanitized.length > 0) {
        return sanitized;
      }
    } catch {
      // Ignore and continue with other attempts.
    }
  }

  const matches = raw.match(COMMENT_OBJECT_REGEX) ?? [];
  const aggregated: CommentCandidate[] = [];

  for (const match of matches) {
    const objectAttempts = buildParseAttempts(match);

    for (const attempt of objectAttempts) {
      const candidate =
        attempt.startsWith("{") || attempt.startsWith("[")
          ? attempt
          : `{${attempt}}`;
      try {
        const parsed = JSON.parse(candidate);
        const sanitized = sanitizeCandidates(parsed, fallbackBlockId);
        if (sanitized.length > 0) {
          aggregated.push(...sanitized);
          break;
        }
      } catch {
        // Continue trying other variants of the same object.
      }
    }
  }

  return aggregated;
};

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

  const {
    apiKey: apiKeyInput,
    baseURL: baseUrlInput,
    ctx,
    maxTokens: maxTokensInput,
    messages,
    model: modelInput,
    system: systemInput,
    temperature: temperatureInput,
  } = payload as Record<string, unknown>;

  if (!ctx || typeof ctx !== "object") {
    return NextResponse.json(
      { error: "Missing editor context." },
      { status: 400 },
    );
  }

  if (!Array.isArray(messages)) {
    return NextResponse.json(
      { error: "Messages must be an array." },
      { status: 400 },
    );
  }

  const { children, selection, toolName: initialToolName } = ctx as {
    children: unknown;
    selection: unknown;
    toolName?: ToolName;
  };

  const apiKey = resolveApiKey(asString(apiKeyInput));

  if (!apiKey) {
    return NextResponse.json({ error: "Missing API key." }, { status: 401 });
  }

  const baseURL = resolveBaseUrl(asString(baseUrlInput));
  const modelId = resolveModel(asString(modelInput));
  const temperature = resolveTemperature(asNumber(temperatureInput));
  const maxTokens = resolveMaxTokens(asNumber(maxTokensInput));
  const systemPrompt = resolveSystemPrompt(asString(systemInput));
  const jsonSchemaSupported = supportsJsonSchemaForModel(modelId);

  const cappedMaxTokens = Math.max(64, Math.min(maxTokens, 1024));

  const openai = createOpenAI({
    apiKey,
    baseURL: baseURL ?? undefined,
  });

  const normalizedSelection =
    selection && typeof selection === "object"
      ? (selection as SlateEditor["selection"])
      : undefined;

  const normalizedValue: Value = Array.isArray(children)
    ? (children as Value)
    : [];

  const editor = createSlateEditor({
    plugins: BaseEditorKit,
    selection: normalizedSelection,
    value: normalizedValue,
  });

  const chatMessages = messages as ChatMessage[];
  const isSelecting = editor.api.isExpanded();

  try {
    const stream = createUIMessageStream<ChatMessage>({
      execute: async ({ writer }) => {
        let toolName = initialToolName;

        const decideModel = openai.chat(modelId);

        if (!toolName) {
          const { object: pickedTool } = await generateObject({
            enum: isSelecting
              ? ["generate", "edit", "comment"]
              : ["generate", "comment"],
            maxOutputTokens: 16,
            model: decideModel,
            output: "enum",
            prompt: getChooseToolPrompt({ messages: chatMessages }),
            temperature: 0,
          });

          writer.write({
            data: pickedTool as ToolName,
            type: "data-toolName",
          });

          toolName = pickedTool as ToolName;
        }

        const sharedSystemMessages =
          systemPrompt.trim().length > 0
            ? [{ content: systemPrompt, role: "system" as const }]
            : [];

        const textStream = streamText({
          experimental_transform: markdownJoinerTransform(),
          maxOutputTokens: cappedMaxTokens,
          model: openai.chat(modelId),
          prompt: "",
          temperature,
          tools: {
            comment: getCommentTool(editor, {
              messagesRaw: chatMessages,
              model: openai.chat(modelId),
              supportsJsonSchema: jsonSchemaSupported,
              maxTokens: cappedMaxTokens,
              temperature,
              writer,
            }),
          },
          prepareStep: async (step) => {
            if (toolName === "comment") {
              return {
                ...step,
                toolChoice: { toolName: "comment", type: "tool" },
              };
            }

            if (toolName === "edit") {
              const editPrompt = getEditPrompt(editor, {
                isSelecting,
                messages: chatMessages,
              });

              return {
                ...step,
                activeTools: [],
                messages: [
                  ...sharedSystemMessages,
                  {
                    content: editPrompt,
                    role: "user",
                  },
                ],
                maxOutputTokens: cappedMaxTokens,
                temperature,
              };
            }

            if (toolName === "generate") {
              const generatePrompt = getGeneratePrompt(editor, {
                messages: chatMessages,
              });

              return {
                ...step,
                activeTools: [],
                messages: [
                  ...sharedSystemMessages,
                  {
                    content: generatePrompt,
                    role: "user",
                  },
                ],
                maxOutputTokens: cappedMaxTokens,
                temperature,
              };
            }

            return step;
          },
        });

        writer.merge(textStream.toUIMessageStream({ sendFinish: false }));
      },
    });

    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    console.error("[AI command] Failed to process request:", error);

    return NextResponse.json(
      { error: "Failed to process AI request" },
      { status: 500 },
    );
  }
}

const getCommentTool = (
  editor: SlateEditor,
  {
    messagesRaw,
    model,
    supportsJsonSchema,
    maxTokens,
    temperature,
    writer,
  }: {
    messagesRaw: ChatMessage[];
    model: LanguageModel;
    supportsJsonSchema: boolean;
    maxTokens: number;
    temperature: number;
    writer: UIMessageStreamWriter<ChatMessage>;
  },
) => {
  return tool({
    description: "Comment on the content",
    inputSchema: z.object({}),
    execute: async () => {
      const commentItemSchema = z
        .object({
          blockId: z
            .string()
            .describe(
              "The id of the starting block. If the comment spans multiple blocks, use the id of the first block.",
            ),
          comment: z
            .string()
            .describe("A brief comment or explanation for this fragment."),
          content: z
            .string()
            .describe(
              String.raw`The original document fragment to be commented on.It can be the entire block, a small part within a block, or span multiple blocks. If spanning multiple blocks, separate them with two \n\n.`,
            ),
        })
        .describe("A single comment");

      const commentArraySchema = z
        .array(commentItemSchema)
        .describe("List of comments the model suggests for the selection.");

      if (supportsJsonSchema) {
        const { elementStream } = streamObject({
          model,
          output: "array",
          prompt: getCommentPrompt(editor, {
            messages: messagesRaw,
          }),
          schema: commentArraySchema,
        });

        for await (const chunk of elementStream) {
          const items = Array.isArray(chunk) ? chunk : [chunk];

          for (const comment of items) {
            const commentDataId = nanoid();

            writer.write({
              id: commentDataId,
              data: {
                comment,
                status: "streaming",
              },
              type: "data-comment",
            });
          }
        }

        writer.write({
          id: nanoid(),
          data: {
            comment: null,
            status: "finished",
          },
          type: "data-comment",
        });

        return;
      }

      const fallbackPrompt = `${getCommentPrompt(editor, {
        messages: messagesRaw,
      })}\n\nRespond ONLY with a JSON array. Each item must be an object with the keys \"blockId\" (string), \"comment\" (string), and \"content\" (string). Use double quotes for every key and value, avoid trailing commas, and do not include explanations or code fences or any text outside of the JSON array.`;

      const { textStream } = streamText({
        maxOutputTokens: Math.min(Math.max(128, maxTokens), 800),
        model,
        prompt: fallbackPrompt,
        temperature,
      });

      let buffer = "";

      for await (const chunk of textStream) {
        buffer += chunk;
      }

      const normalized = stripCommentResponse(buffer);

      const fallbackBlockEntry = editor.selection
        ? editor.api.block({ at: editor.selection, highest: true })
        : editor.api.block({ highest: true });

      const fallbackBlockId =
        (fallbackBlockEntry?.[0] as { id?: string } | undefined)?.id ??
        undefined;

      const parsedComments = parseCommentResponse(normalized, fallbackBlockId);
      const parsedResult = commentArraySchema.safeParse(parsedComments);

      if (!parsedResult.success) {
        console.error(
          "[AI command] Failed to parse DeepSeek comment response:",
          parsedResult.error,
          { normalized, parsed: parsedComments },
        );
      }

      const comments = parsedResult.success ? parsedResult.data : [];

      for (const comment of comments) {
        const commentDataId = nanoid();

        writer.write({
          id: commentDataId,
          data: {
            comment,
            status: "streaming",
          },
          type: "data-comment",
        });
      }

      writer.write({
        id: nanoid(),
        data: {
          comment: null,
          status: "finished",
        },
        type: "data-comment",
      });
    },
  });
};



