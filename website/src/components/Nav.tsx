"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BOOKING_URL } from "@/lib/site";

const LINKS = [
  { label: "What we do", href: "/#services" },
  { label: "How we work", href: "/#approach" },
  { label: "Live demo", href: "/demo" },
  { label: "Engagements", href: "/#engagements" },
];

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Disclosure behavior: Escape closes and returns focus to the toggle.
  // Deliberately no focus trap — this is a non-modal disclosure.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      {/* Fade-glass layer: invisible at the top of the page so the hero
          photo runs clean under the nav, then fades in as glass once the
          page scrolls. Opacity transition (not backdrop-filter) keeps the
          fade GPU-cheap and smooth in every engine. */}
      <div
        aria-hidden
        className={`absolute inset-0 border-b backdrop-blur-xl transition-opacity duration-500 ${
          scrolled
            ? "border-[var(--line)] bg-[color-mix(in_oklab,var(--paper)_78%,transparent)] opacity-100"
            : "border-transparent bg-transparent opacity-0"
        }`}
      />

      <nav
        aria-label="Main"
        className="container-hero relative flex h-16 items-center justify-between 2xl:h-[4.75rem]"
      >
        <Link href="/#top" className="relative flex items-baseline gap-2">
          <span className="font-display text-[1.2rem] font-semibold tracking-[-0.03em] text-[var(--ink)] 2xl:text-[1.4rem]">
            Clove
          </span>
          <span className="mono hidden text-[0.6rem] tracking-[0.22em] text-[var(--faint)] sm:inline 2xl:text-xs">
            SOVEREIGN INFERENCE
          </span>
        </Link>

        {/* Full nav only from lg up — at tablet widths it overcrowds, so the
            disclosure menu below serves md–lg instead. Links and the CTA are
            one right-hand cluster so the button reads as part of the nav,
            never as a detached pill. */}
        <div className="relative hidden items-center gap-7 lg:flex xl:gap-8 2xl:gap-10">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="ulink text-sm 2xl:text-base">
              {l.label}
            </Link>
          ))}
          <a
            href={BOOKING_URL}
            target="_blank"
            rel="noopener"
            className="btn btn-primary btn-nav"
          >
            Book a call
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </a>
        </div>

        <button
          ref={toggleRef}
          type="button"
          aria-label="Menu"
          aria-expanded={open}
          aria-controls="mobile-menu"
          className="btn btn-ghost relative h-11 w-11 justify-center p-0 lg:hidden"
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" />
            ) : (
              <>
                <path d="M3 6h18" />
                <path d="M3 12h18" />
                <path d="M3 18h18" />
              </>
            )}
          </svg>
        </button>
      </nav>

      {open && (
        <div
          id="mobile-menu"
          className="border-t border-[var(--line)] bg-[var(--paper)] px-6 py-4 lg:hidden"
        >
          <div className="flex flex-col gap-1">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-3 text-base text-[var(--muted)] transition-colors hover:bg-white/[0.06] hover:text-[var(--ink)]"
              >
                {l.label}
              </Link>
            ))}
            <a
              href={BOOKING_URL}
              target="_blank"
              rel="noopener"
              onClick={() => setOpen(false)}
              className="btn btn-primary mt-2 min-h-[44px]"
            >
              Book a call
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
