/**
 * Small shared console chrome: page header, stat cards, the time-range
 * selector, and the empty state. Server components; no interactivity.
 */

import Link from "next/link";
import type { ReactNode } from "react";
import { RANGE_OPTIONS } from "./state";

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header>
      <p className="eyebrow">
        <span className="signal-dot" aria-hidden /> Customer console
      </p>
      <h1 className="display mt-4 text-[clamp(2rem,4vw,2.9rem)] text-[var(--ink)]">{title}</h1>
      {children ? <div className="mt-3">{children}</div> : null}
    </header>
  );
}

export function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-[var(--paper-2)] p-6">
      <p className="mono text-[0.68rem] uppercase tracking-[0.12em] text-[var(--faint)]">{label}</p>
      <p className="display mt-3 text-[clamp(1.7rem,2.8vw,2.4rem)] text-[var(--ink)]">{value}</p>
      {/* Reserved height so cards align even when a sub-line is missing. */}
      <p className="mono mt-2 min-h-[1.1rem] text-xs text-[var(--muted)]">{sub ?? ""}</p>
    </div>
  );
}

// 7 / 14 / 30 day selector. Plain links: the range lives in the URL, so any
// console view can be shared or refreshed exactly as it was.
export function RangeLinks({
  basePath,
  days,
  model,
}: {
  basePath: string;
  days: number;
  model: string | null;
}) {
  return (
    <div
      role="group"
      aria-label="Time range"
      className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--paper-3)] p-1"
    >
      {RANGE_OPTIONS.map((option) => {
        const params = new URLSearchParams({ days: String(option) });
        if (model) params.set("model", model);
        const active = option === days;
        return (
          <Link
            key={option}
            href={`${basePath}?${params.toString()}`}
            aria-current={active ? "true" : undefined}
            className={`mono rounded-full px-3.5 py-1.5 text-xs transition-colors ${
              active
                ? "bg-[var(--ink)] text-[var(--paper)]"
                : "text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            {option}d
          </Link>
        );
      })}
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="well p-8 sm:p-10">
      <p className="display text-3xl text-[var(--ink)]">{title}</p>
      <p className="mt-3 max-w-md text-[0.95rem] leading-relaxed text-[var(--muted)]">{body}</p>
      <Link
        href="/docs"
        className="mono mt-6 inline-flex items-center gap-2 text-sm text-[var(--ink)] underline-offset-4 transition-colors hover:text-[var(--signal)] hover:underline"
      >
        Read the docs
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </Link>
    </div>
  );
}
