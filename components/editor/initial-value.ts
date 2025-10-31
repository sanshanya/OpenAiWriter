"use client";

import { normalizeNodeId } from "platejs";

import {
  ELEMENTS,
  MARKS,
  type MyValue,
} from "@/types/plate-elements";

const baseInitialValue: MyValue = [
  { type: ELEMENTS.h1, children: [{ text: "Basic Editor" }] },
  { type: ELEMENTS.h2, children: [{ text: "Heading 2" }] },
  { type: ELEMENTS.h3, children: [{ text: "Heading 3" }] },
  {
    type: ELEMENTS.blockquote,
    children: [
      { text: "This is a blockquote element", [MARKS.italic]: true },
    ],
  },
  {
    type: ELEMENTS.paragraph,
    children: [
      { text: "Basic marks: " },
      { text: "bold", [MARKS.bold]: true },
      { text: ", " },
      { text: "italic", [MARKS.italic]: true },
      { text: ", " },
      { text: "underline", [MARKS.underline]: true },
      { text: ", " },
      { text: "strikethrough", [MARKS.strikethrough]: true },
      { text: "." },
    ],
  },
];

export const INITIAL_DOCUMENT_TITLE = "未命名文档";

export const INITIAL_DOCUMENT_CONTENT: MyValue =
  normalizeNodeId(baseInitialValue) as MyValue;
