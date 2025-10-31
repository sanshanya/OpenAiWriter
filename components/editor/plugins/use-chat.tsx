"use client";

import * as React from "react";

import { type UseChatHelpers, useChat as useBaseChat } from "@ai-sdk/react";
import { AIChatPlugin, aiCommentToRange } from "@platejs/ai/react";
import { getCommentKey, getTransientCommentKey } from "@platejs/comment";
import { deserializeMd } from "@platejs/markdown";
import { BlockSelectionPlugin } from "@platejs/selection/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { KEYS, NodeApi, TextApi, nanoid, type TNode } from "platejs";
import { useEditorRef, usePluginOption } from "platejs/react";

import { aiChatPlugin } from "./ai/ai-kit";
import { discussionPlugin } from "./system/discussion-kit";
import { ELEMENTS } from "@/types/plate-elements";

export type ToolName = "comment" | "edit" | "generate";

export type TComment = {
  comment: {
    blockId: string;
    comment: string;
    content: string;
  } | null;
  status: "finished" | "streaming";
};

export type MessageDataPart = {
  toolName: ToolName;
  comment?: TComment;
};

export type Chat = UseChatHelpers<ChatMessage>;

export type ChatMessage = UIMessage<Record<string, never>, MessageDataPart>;

export const useChat = () => {
  const editor = useEditorRef();
  const options = usePluginOption(aiChatPlugin, "chatOptions");

  const baseChat = useBaseChat<ChatMessage>({
    id: "editor",
    transport: new DefaultChatTransport({
      api: options.api || "/api/ai/command",
      fetch: async (input, init) => {
        const bodyOptions =
          editor.getOptions(aiChatPlugin).chatOptions?.body ?? {};

        let initPayload: Record<string, unknown> = {};

        if (typeof init?.body === "string" && init.body.length > 0) {
          try {
            initPayload = JSON.parse(init.body);
          } catch {
            // Ignore malformed overrides and continue with defaults.
          }
        }

        return fetch(input, {
          ...init,
          body: JSON.stringify({
            ...initPayload,
            ...bodyOptions,
          }),
        });
      },
    }),
    onData(data) {
      if (data.type === "data-toolName") {
        editor.setOption(AIChatPlugin, "toolName", data.data);
      }

      if (data.type === "data-comment" && data.data) {
        if (data.data.status === "finished") {
          editor.getApi(BlockSelectionPlugin).blockSelection.deselect();
          return;
        }

        const aiComment = data.data.comment!;
        const range = aiCommentToRange(editor, aiComment);

        if (!range) {
          console.warn("[useChat] No range found for AI comment.");
          return;
        }

        const existingDiscussions =
          editor.getOption(discussionPlugin, "discussions") || [];

        const discussionId = nanoid();

        const newComment = {
          id: nanoid(),
          contentRich: [
            {
              children: [{ text: aiComment.comment }],
              type: ELEMENTS.paragraph,
            },
          ],
          createdAt: new Date(),
          discussionId,
          isEdited: false,
          userId: editor.getOption(discussionPlugin, "currentUserId"),
        };

        const newDiscussion = {
          id: discussionId,
          comments: [newComment],
          createdAt: new Date(),
          documentContent: deserializeMd(editor, aiComment.content)
            .map((node: TNode) => NodeApi.string(node))
            .join("\n"),
          isResolved: false,
          userId: editor.getOption(discussionPlugin, "currentUserId"),
        };

        editor.setOption(discussionPlugin, "discussions", [
          ...existingDiscussions,
          newDiscussion,
        ]);

        editor.tf.withMerging(() => {
          editor.tf.setNodes(
            {
              [getCommentKey(newDiscussion.id)]: true,
              [getTransientCommentKey()]: true,
              [KEYS.comment]: true,
            },
            {
              at: range,
              match: TextApi.isText,
              split: true,
            },
          );
        });
      }
    },
    ...options,
  });

  React.useEffect(() => {
    // Plate 的 AI 插件目前仍以宽泛类型存取 Chat helpers（参考官方模板），
    // 直接传递会出现泛型不完全收敛的类型冲突，这里保持一次性断言。
    editor.setOption(AIChatPlugin, "chat", baseChat as unknown as Chat);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseChat.status, baseChat.messages, baseChat.error]);

  return baseChat;
};
