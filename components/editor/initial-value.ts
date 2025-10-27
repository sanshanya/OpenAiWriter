"use client";

import { normalizeNodeId, type Value } from "platejs";

const baseInitialValue: Value = [
  { type: "h1", children: [{ text: "Basic Editor" }] },
  { type: "h2", children: [{ text: "Heading 2" }] },
  { type: "h3", children: [{ text: "Heading 3" }] },
  {
    type: "blockquote",
    children: [{ text: "This is a blockquote element", italic: true }],
  },
  {
    type: "p",
    children: [
      { text: "Basic marks: " },
      { text: "bold", bold: true },
      { text: ", " },
      { text: "italic", italic: true },
      { text: ", " },
      { text: "underline", underline: true },
      { text: ", " },
      { text: "strikethrough", strikethrough: true },
      { text: "." },
    ],
  },
];

export const INITIAL_DOCUMENT_TITLE = "未命名文档";

export const INITIAL_DOCUMENT_CONTENT: Value =
  normalizeNodeId(baseInitialValue);
