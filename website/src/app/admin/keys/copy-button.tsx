"use client";

import { useEffect, useRef, useState } from "react";

// Clipboard write with a fallback for non-secure contexts (plain HTTP
// previews): navigator.clipboard is unavailable there, execCommand still
// works. Returns whether anything landed on the clipboard.
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

const GHOST =
  "mono inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-[var(--line-2)] px-3 text-sm text-[var(--muted)] transition-colors hover:border-[var(--line-3)] hover:text-[var(--ink)]";
const GHOST_COMPACT =
  "mono inline-flex min-h-[2rem] items-center gap-1 rounded-md border border-[var(--line)] px-2 text-xs text-[var(--muted)] transition-colors hover:border-[var(--line-3)] hover:text-[var(--ink)]";
const PRIMARY =
  "btn btn-primary min-h-[44px] disabled:opacity-60";

export default function CopyButton({
  value,
  variant = "ghost",
  ariaLabel,
}: {
  value: string;
  variant?: "ghost" | "ghost-compact" | "primary";
  ariaLabel?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  const onClick = () => {
    void copyText(value).then((ok) => {
      if (!ok) return;
      setCopied(true);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1600);
    });
  };

  const className = variant === "primary" ? PRIMARY : variant === "ghost-compact" ? GHOST_COMPACT : GHOST;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={className}
    >
      {copied ? "Copied" : "Copy"}
      {copied && (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
          <path d="M5 12l4 4L19 7" />
        </svg>
      )}
    </button>
  );
}
