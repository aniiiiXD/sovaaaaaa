"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Scroll reveal as a progressive enhancement. Content is server-rendered
 * fully visible; only after JS mounts, and only if the element sits below
 * the fold, do we hide it and animate it in on scroll. So text is always
 * available without JS, deep links / anchor navigation never land on
 * invisible content, and reduced-motion users are covered by the global
 * `@media (prefers-reduced-motion)` override in globals.css.
 */
export default function Reveal({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li" | "span";
}) {
  const ref = useRef<HTMLElement>(null);
  const [armed, setArmed] = useState(false); // below the fold at mount
  const [shown, setShown] = useState(false); // scrolled into view

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Already in (or above) the viewport on mount — e.g. above-the-fold
    // content, or an anchor / deep link that scrolled here before hydration.
    // Leave it visible; never hide what the user is looking at.
    if (el.getBoundingClientRect().top < window.innerHeight) return;

    setArmed(true);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const Comp = Tag as "div";
  return (
    <Comp
      ref={ref as React.Ref<HTMLDivElement>}
      className={`${armed ? `reveal${shown ? " in" : ""}` : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Comp>
  );
}
