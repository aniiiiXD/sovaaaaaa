"use client";

import { useEffect, useRef, useState } from "react";

// Copies a code sample to the clipboard. Same quiet pattern as the portal's
// copy-key-button: a no-op state change where the clipboard is unavailable
// (insecure contexts).
export default function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy ${label}`}
      className="mono flex-none rounded-full border border-[var(--line-2)] px-2.5 py-1 text-xs text-[var(--muted)] transition-colors hover:border-[var(--line-3)] hover:text-[var(--ink)]"
    >
      {copied ? "copied" : "copy"}
    </button>
  );
}
