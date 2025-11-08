"use client";

import * as React from "react";

import type { TInlineSuggestionData, TLinkElement } from "platejs";
import type { PlateElementProps } from "platejs/react";

import { getLinkAttributes } from "@platejs/link";
import { SuggestionPlugin } from "@platejs/suggestion/react";
import { PlateElement } from "platejs/react";

import { sanitizeHref } from "@/lib/editor/sanitize";
import { cn } from "@/lib/utils";

export function LinkElement(props: PlateElementProps<TLinkElement>) {
  const suggestionData = props.editor
    .getApi(SuggestionPlugin)
    .suggestion.suggestionData(props.element) as
    | TInlineSuggestionData
    | undefined;

  const suggestionClassName = cn(
    suggestionData?.type === "remove" && "bg-red-100 text-red-700",
    suggestionData?.type === "insert" && "bg-emerald-100 text-emerald-700",
  );

  const linkAttributes = getLinkAttributes(props.editor, props.element);
  const sanitizedHref = sanitizeHref(
    linkAttributes.href ?? (props.element as TLinkElement).url,
  );

  if (!sanitizedHref) {
    return (
      <PlateElement
        {...props}
        as="span"
        className={suggestionClassName}
        attributes={props.attributes}
      >
        {props.children}
      </PlateElement>
    );
  }

  return (
    <PlateElement
      {...props}
      as="a"
      className={cn(
        "text-primary decoration-primary font-medium underline underline-offset-4",
        suggestionClassName,
      )}
      attributes={{
        ...props.attributes,
        ...linkAttributes,
        href: sanitizedHref,
        rel: "noopener noreferrer",
        target:
          (linkAttributes?.target as string | undefined) !== undefined
            ? (linkAttributes.target as string)
            : "_blank",
        onMouseOver: (e) => {
          e.stopPropagation();
        },
      }}
    >
      {props.children}
    </PlateElement>
  );
}
