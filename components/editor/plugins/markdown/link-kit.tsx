"use client";

import { LinkPlugin } from "@platejs/link/react";

import { LinkElement } from "@/components/ui/link-node";
import { LinkFloatingToolbar } from "@/components/ui/link-toolbar";
import { sanitizeHref } from "@/lib/editor/sanitize";

const sanitizeToUndefined = (value: string) => sanitizeHref(value) ?? undefined;

export const LinkKit = [
  LinkPlugin.configure({
    options: {
      transformInput: sanitizeToUndefined,
      isUrl: (text) => sanitizeHref(text) !== null,
      getUrlHref: sanitizeToUndefined,
    },
    render: {
      node: LinkElement,
      afterEditable: () => <LinkFloatingToolbar />,
    },
  }),
];
