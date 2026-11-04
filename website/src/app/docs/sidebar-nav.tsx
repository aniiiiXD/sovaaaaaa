"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DOC_GROUPS, DOC_NAV } from "./nav";

// The docs navigation, in two shapes: the sticky desktop sidebar and a
// horizontal chip row for small screens. Both highlight the active page.

export default function SidebarNav({ variant }: { variant: "sidebar" | "chips" }) {
  const pathname = usePathname();

  if (variant === "chips") {
    return (
      <nav
        aria-label="Documentation"
        className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:-mx-8 sm:px-8"
      >
        {DOC_NAV.map((link) => {
          const active = link.href === pathname;
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`mono flex-none whitespace-nowrap rounded-full border px-3 py-1.5 text-[0.78rem] transition-colors ${
                active
                  ? "border-[var(--line-3)] bg-white/[0.07] text-[var(--ink)]"
                  : "border-[var(--line)] text-[var(--muted)] hover:border-[var(--line-2)] hover:text-[var(--ink)]"
              }`}
            >
              {link.title}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav aria-label="Documentation" className="px-6 py-9">
      <Link href="/docs" className="flex items-baseline gap-2">
        <span className="font-display text-lg text-[var(--ink)]">Sova</span>
        <span className="mono text-[0.6rem] tracking-[0.22em] text-[var(--faint)]">DOCS</span>
      </Link>

      {DOC_GROUPS.map((group) => (
        <div key={group} className="mt-8">
          <p className="mono text-[0.62rem] uppercase tracking-[0.18em] text-[var(--faint)]">
            {group}
          </p>
          <ul className="mt-2.5 space-y-0.5">
            {DOC_NAV.filter((link) => link.group === group).map((link) => {
              const active = link.href === pathname;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={`relative block rounded-lg px-3 py-2 text-sm transition-colors ${
                      active
                        ? "bg-white/[0.07] text-[var(--ink)]"
                        : "text-[var(--muted)] hover:bg-white/[0.04] hover:text-[var(--ink)]"
                    }`}
                  >
                    {active ? (
                      <span
                        aria-hidden
                        className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-[var(--signal)]"
                      />
                    ) : null}
                    {link.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
