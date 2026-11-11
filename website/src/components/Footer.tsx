/**
 * Footer — shared across the home page and standalone pages (About, Careers).
 * In-page links use absolute hashes ("/#services") so they work from any route:
 * from the home page they scroll; from a sub-page they navigate home, then scroll.
 * Internal routes use next/link; external and mailto links stay plain anchors.
 */

import Link from "next/link";
import { BOOKING_URL, CONTACT_EMAIL, CONTACT_MAILTO } from "@/lib/site";

const COLS: [string, [string, string][]][] = [
  [
    "Services",
    [
      ["Inference", "/#inference"],
      ["Specialist models", "/#specialist-models"],
      ["Evals & routing", "/#evals-routing"],
      ["Capabilities", "/#services"],
      ["Engagements", "/#engagements"],
    ],
  ],
  [
    "Firm",
    [
      ["How we work", "/#approach"],
      ["Why Clove", "/#calls"],
      ["About", "/about"],
      ["Careers", "/careers"],
    ],
  ],
  [
    "Contact",
    [
      ["Book a call", BOOKING_URL],
      [CONTACT_EMAIL, CONTACT_MAILTO],
    ],
  ],
];

// Rows are ≥44px on phones for touch; compact again once a pointer is likely.
const LINK_CLASS =
  "inline-flex min-h-[44px] items-center text-sm text-[var(--muted)] underline-offset-4 transition-colors hover:text-[var(--ink)] hover:underline sm:min-h-[2.25rem]";

export default function Footer() {
  return (
    <footer className="border-t border-[var(--line)] py-14">
      <div className="container-x grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-lg font-semibold text-[var(--ink)]">Clove</span>
            <span className="mono text-[0.6rem] tracking-[0.22em] text-[var(--faint)]">SOVEREIGN INFERENCE</span>
          </div>
          <p className="mt-4 max-w-xs text-sm text-[var(--muted)]">
            Sovereign inference for the world. One endpoint, specialist models
            built on your work, and the engineer who built them on your account.
          </p>
        </div>
        {COLS.map(([title, items]) => (
          <div key={title}>
            <p className="eyebrow mb-1">{title}</p>
            <ul className="space-y-0.5">
              {items.map(([label, href]) => {
                const external = href.startsWith("http");
                const mailto = href.startsWith("mailto:");
                return (
                  <li key={label}>
                    {external || mailto ? (
                      <a
                        href={href}
                        {...(external ? { target: "_blank", rel: "noopener" } : {})}
                        className={LINK_CLASS}
                      >
                        {label}
                      </a>
                    ) : (
                      <Link href={href} className={LINK_CLASS}>
                        {label}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <div className="container-x mt-12 flex flex-col items-start justify-between gap-3 border-t border-[var(--line)] pt-6 sm:flex-row sm:items-center">
        <p className="mono text-sm text-[var(--muted)]">© 2026 Clove · sovereign inference for the world</p>
        <p className="mono text-sm text-[var(--muted)]">your data stays yours · no training on client data</p>
      </div>
    </footer>
  );
}
