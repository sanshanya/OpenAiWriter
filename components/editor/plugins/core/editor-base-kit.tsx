import { BaseAlignKit } from "./align-base-kit";
import { BaseBasicBlocksKit } from "./basic-blocks-base-kit";
import { BaseBasicMarksKit } from "./basic-marks-base-kit";
import { BaseCalloutKit } from "../markdown/callout-base-kit";
import { BaseCodeBlockKit } from "../markdown/code-block-base-kit";
import { BaseColumnKit } from "../system/column-base-kit";
import { BaseCommentKit } from "../system/comment-base-kit";
import { BaseDateKit } from "../markdown/date-base-kit";
import { BaseFontKit } from "./font-base-kit";
import { BaseLineHeightKit } from "./line-height-base-kit";
import { BaseLinkKit } from "../markdown/link-base-kit";
import { BaseListKit } from "../markdown/list-base-kit";
import { MarkdownKit } from "../markdown/markdown-kit";
import { BaseMathKit } from "../markdown/math-base-kit";
import { BaseMediaKit } from "../markdown/media-base-kit";
import { BaseMentionKit } from "../system/mention-base-kit";
import { BaseSuggestionKit } from "../system/suggestion-base-kit";
import { BaseTableKit } from "../markdown/table-base-kit";
import { BaseTocKit } from "../markdown/toc-base-kit";
import { BaseToggleKit } from "../markdown/toggle-base-kit";

export const BaseEditorKit = [
  ...BaseBasicBlocksKit,
  ...BaseCodeBlockKit,
  ...BaseTableKit,
  ...BaseToggleKit,
  ...BaseTocKit,
  ...BaseMediaKit,
  ...BaseCalloutKit,
  ...BaseColumnKit,
  ...BaseMathKit,
  ...BaseDateKit,
  ...BaseLinkKit,
  ...BaseMentionKit,
  ...BaseBasicMarksKit,
  ...BaseFontKit,
  ...BaseListKit,
  ...BaseAlignKit,
  ...BaseLineHeightKit,
  ...BaseCommentKit,
  ...BaseSuggestionKit,
  ...MarkdownKit,
];
