"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { portalSignOutAction } from "./actions";
import { FEEDBACK_MAILTO } from "./state";

const NAV = [
  { href: "/portal", label: "Overview", exact: true },
  { href: "/portal/usage", label: "Usage", exact: false },
  { href: "/portal/keys", label: "API keys", exact: false },
];

const linkBase =
  "mono flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm transition-colors";

function linkClass(active: boolean): string {
  return `${linkBase} ${
    active
      ? "bg-[var(--paper-2)] text-[var(--ink)]"
      : "text-[var(--muted)] hover:bg-[var(--paper-2)] hover:text-[var(--ink)]"
  }`;
}

// Marks links that leave the console.
function ArrowIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M7 17 17 7M9 7h8v8" />
    </svg>
  );
}

/**
 * Console navigation: a fixed dark sidebar on desktop, a sticky top bar with
 * a scrollable nav row on phones. The sign-out button sits at the bottom.
 */
export default function Sidebar() {
  const pathname = usePathname();

  function isActive(item: { href: string; exact: boolean }): boolean {
    return item.exact ? pathname === item.href : pathname.startsWith(item.href);
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-[var(--line)] bg-[var(--paper-3)] px-4 py-7 md:flex">
        <div className="px-3">
          <Link
            href="/"
            className="display text-[1.65rem] leading-none tracking-[0.06em] text-[var(--ink)]"
          >
            SOVA
          </Link>
          <p className="mono mt-2 text-[0.62rem] uppercase tracking-[0.24em] text-[var(--faint)]">
            Console
          </p>
        </div>

        <nav aria-label="Console" className="mt-9 flex flex-col gap-1">
          {NAV.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={linkClass(active)}
              >
                {active && <span className="h-1.5 w-1.5 rounded-full bg-[var(--signal)]" aria-hidden />}
                {item.label}
              </Link>
            );
          })}
          <Link href="/docs" className={linkClass(false)}>
            Docs
            <ArrowIcon />
          </Link>
          <a href={FEEDBACK_MAILTO} className={linkClass(false)}>
            Give feedback
            <ArrowIcon />
          </a>
        </nav>

        <form action={portalSignOutAction} className="mt-auto pt-6">
          <button
            type="submit"
            className="mono w-full rounded-lg px-3 py-2.5 text-left text-sm text-[var(--muted)] transition-colors hover:text-[var(--signal)]"
          >
            Sign out
          </button>
        </form>
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 border-b border-[var(--line)] bg-[color-mix(in_oklab,var(--paper)_84%,transparent)] backdrop-blur-md md:hidden">
        <div className="flex items-center justify-between px-5 pt-4">
          <Link
            href="/"
            className="display text-2xl leading-none tracking-[0.06em] text-[var(--ink)]"
          >
            SOVA
          </Link>
          <form action={portalSignOutAction}>
            <button
              type="submit"
              className="mono text-sm text-[var(--muted)] transition-colors hover:text-[var(--signal)]"
            >
              Sign out
            </button>
          </form>
        </div>
        <nav aria-label="Console" className="mt-3 flex items-center gap-1 overflow-x-auto px-3 pb-3">
          {NAV.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={linkClass(active)}
              >
                {active && <span className="h-1.5 w-1.5 rounded-full bg-[var(--signal)]" aria-hidden />}
                {item.label}
              </Link>
            );
          })}
          <Link href="/docs" className={linkClass(false)}>
            Docs
            <ArrowIcon />
          </Link>
          <a href={FEEDBACK_MAILTO} className={linkClass(false)}>
            Give feedback
          </a>
        </nav>
      </div>
    </>
  );
}
