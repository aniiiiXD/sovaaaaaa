import type { ReactNode } from "react";

// Shared building blocks for docs pages: the page header, section headings,
// inline code, body paragraphs, and the bulleted fact list carried over from
// the original single-page docs.

export default function PageHead({
  eyebrow,
  title,
  lead,
}: {
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
}) {
  return (
    <header>
      <p className="eyebrow">
        <span className="signal-dot--calm inline-block h-2 w-2 rounded-full" aria-hidden />{" "}
        {eyebrow}
      </p>
      <h1 className="display mt-5 text-[clamp(2.2rem,4.6vw,3.1rem)]">{title}</h1>
      {lead ? <p className="lead mt-5">{lead}</p> : null}
    </header>
  );
}

export function Section({
  id,
  title,
  children,
}: {
  id?: string;
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="mt-14 scroll-mt-24">
      <h2 className="display text-[1.7rem]">{title}</h2>
      {children}
    </section>
  );
}

export function P({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 text-[0.95rem] leading-relaxed text-[var(--muted)]">{children}</p>
  );
}

export function C({ children }: { children: ReactNode }) {
  return <code className="mono text-[0.86em] text-[var(--ink)]">{children}</code>;
}

export function Facts({ items }: { items: readonly string[] }) {
  return (
    <ul className="mt-8 space-y-3">
      {items.map((fact, i) => (
        <li
          key={fact}
          className="mono flex items-start gap-2.5 text-sm leading-relaxed text-[var(--muted)]"
        >
          <span
            className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full"
            style={{ background: i === 0 ? "var(--signal)" : "var(--pine)" }}
            aria-hidden
          />
          {fact}
        </li>
      ))}
    </ul>
  );
}
