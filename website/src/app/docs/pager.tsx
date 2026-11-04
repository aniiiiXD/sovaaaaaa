"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { docNeighbors } from "./nav";

// The GitBook signature: previous / next links at the foot of every page,
// ordered by nav.ts.
export default function Pager() {
  const pathname = usePathname();
  const { prev, next } = docNeighbors(pathname);
  if (!prev && !next) return null;

  return (
    <nav
      aria-label="Docs pagination"
      className="mt-16 grid gap-3 border-t border-[var(--line)] pt-6 sm:grid-cols-2"
    >
      {prev ? (
        <Link
          href={prev.href}
          className="rounded-xl border border-[var(--line)] p-4 transition-colors hover:border-[var(--line-3)]"
        >
          <span className="mono flex items-center gap-1.5 text-[0.66rem] uppercase tracking-[0.14em] text-[var(--faint)]">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M19 12H5M11 18l-6-6 6-6" />
            </svg>
            Previous
          </span>
          <span className="mt-1.5 block text-sm text-[var(--ink)]">{prev.title}</span>
        </Link>
      ) : (
        <span aria-hidden />
      )}
      {next ? (
        <Link
          href={next.href}
          className="rounded-xl border border-[var(--line)] p-4 text-right transition-colors hover:border-[var(--line-3)] sm:col-start-2"
        >
          <span className="mono flex items-center justify-end gap-1.5 text-[0.66rem] uppercase tracking-[0.14em] text-[var(--faint)]">
            Next
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </span>
          <span className="mt-1.5 block text-sm text-[var(--ink)]">{next.title}</span>
        </Link>
      ) : (
        <span aria-hidden />
      )}
    </nav>
  );
}
