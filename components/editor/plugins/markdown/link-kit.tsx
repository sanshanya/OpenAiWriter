"use client";

import { LinkPlugin } from "@platejs/link/react";

import { LinkElement } from "@/components/ui/editor/link-node";
import { LinkFloatingToolbar } from "@/components/ui/editor/link-toolbar";
import { sanitizeHref } from "@/lib/editor/sanitize";

const toHref = (value: string) => sanitizeHref(value) ?? undefined;

export const LinkKit = [
  LinkPlugin.configure({
    options: {
      transformInput: toHref,
      getUrlHref: toHref,
      allowedSchemes: ["http", "https", "mailto", "tel"],
      dangerouslySkipSanitization: false,
    },
    render: {
      node: LinkElement,
      afterEditable: () => <LinkFloatingToolbar />,
    },
  }),
];
