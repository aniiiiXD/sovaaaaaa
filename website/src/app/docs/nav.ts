// Single source of truth for the docs sidebar, breadcrumbs, and the
// prev/next pager. The order here is the order readers see.

export type DocGroup = "Getting started" | "API reference" | "Resources";

export type DocLink = {
  href: string;
  title: string;
  group: DocGroup;
};

export const DOC_GROUPS: readonly DocGroup[] = [
  "Getting started",
  "API reference",
  "Resources",
];

export const DOC_NAV: readonly DocLink[] = [
  { href: "/docs", title: "Introduction", group: "Getting started" },
  { href: "/docs/quickstart", title: "Quickstart", group: "Getting started" },
  { href: "/docs/authentication", title: "Authentication", group: "API reference" },
  { href: "/docs/api-reference/chat-completions", title: "Chat Completions", group: "API reference" },
  { href: "/docs/api-reference/models", title: "Models", group: "API reference" },
  { href: "/docs/streaming", title: "Streaming", group: "API reference" },
  { href: "/docs/errors", title: "Errors", group: "Resources" },
  { href: "/docs/limits", title: "Limits", group: "Resources" },
  { href: "/docs/usage", title: "Usage & Portal", group: "Resources" },
];

export function docForPath(pathname: string): DocLink | undefined {
  return DOC_NAV.find((link) => link.href === pathname);
}

export function docNeighbors(pathname: string): {
  prev: DocLink | null;
  next: DocLink | null;
} {
  const index = DOC_NAV.findIndex((link) => link.href === pathname);
  if (index === -1) return { prev: null, next: null };
  return {
    prev: index > 0 ? DOC_NAV[index - 1] : null,
    next: index < DOC_NAV.length - 1 ? DOC_NAV[index + 1] : null,
  };
}
