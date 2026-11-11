"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BOOKING_URL, PRODUCT_ORIGIN } from "@/lib/site";
import s from "./Chrome.module.css";

const LINKS = [
  ["APIs", "/#apis"],
  ["Custom models", "/#services"],
  ["Demo", "/#live-demo"],
  ["Docs", `${PRODUCT_ORIGIN}/docs`],
] as const;

export default function DojoNav() {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <header className={s.header}>
      <nav className={s.nav} aria-label="Main navigation">
        <Link href="/#top" className={s.brand} onClick={() => setOpen(false)} aria-label="Clove home">
          <svg className={s.crest} viewBox="0 0 44 44" fill="none" aria-hidden="true">
            <path d="M33.5 8.5A17 17 0 1 0 39 22" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M13 15.5 22 21l9-5.5-2 12L22 32l-7-4.5-2-12Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            <path d="m18 22 2 2m6-2-2 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="37.5" cy="11" r="2.3" fill="#8E5B4F" />
          </svg>
          <span className={s.brandName}>Clove</span>
          <span className={s.brandCaption}>Sovereign<br />intelligence</span>
        </Link>

        <div className={s.desktopLinks}>
          {LINKS.map(([label, href]) => <Link key={href} href={href} className={s.navLink}>{label}</Link>)}
          <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer" className={s.booking}>
            Request access <span aria-hidden="true">↗</span>
          </a>
        </div>

        <button ref={trigger} type="button" className={s.menuButton} aria-expanded={open} aria-controls="dojo-mobile-menu" aria-label={open ? "Close navigation" : "Open navigation"} onClick={() => setOpen(value => !value)}>
          <span>{open ? "Close" : "Menu"}</span>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
            {open ? <path d="m5 5 10 10M15 5 5 15" /> : <path d="M3 7h14M3 13h14" />}
          </svg>
        </button>
      </nav>

      <div id="dojo-mobile-menu" className={s.mobileMenu} hidden={!open}>
        <div className={s.mobileLinks}>
          {LINKS.map(([label, href]) => <Link key={href} href={href} onClick={() => setOpen(false)}>{label}<span aria-hidden="true">↗</span></Link>)}
          <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)} className={s.mobileBooking}>Request access<span aria-hidden="true">↗</span></a>
        </div>
      </div>
    </header>
  );
}
