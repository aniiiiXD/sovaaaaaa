"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { docForPath } from "./nav";

// "Docs / API Reference / Chat Completions", derived from nav.ts.
export default function Breadcrumb() {
  const pathname = usePathname();
  const doc = docForPath(pathname);
  if (!doc) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className="mono flex flex-wrap items-center gap-2 text-[0.72rem] tracking-[0.06em] text-[var(--faint)]"
    >
      <Link href="/docs" className="transition-colors hover:text-[var(--ink)]">
        Docs
      </Link>
      <span aria-hidden>/</span>
      <span>{doc.group}</span>
      <span aria-hidden>/</span>
      <span className="text-[var(--muted)]">{doc.title}</span>
    </nav>
  );
}
