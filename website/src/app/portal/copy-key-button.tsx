"use client";

import { useEffect, useRef, useState } from "react";

// Copies the key id to the clipboard. The key id is not secret (it is the
// first 8 hex chars of the key's fingerprint) and is what Sova asks for in
// support conversations. Falls back to a quiet no-op where the clipboard is
// unavailable (insecure contexts).
export default function CopyKeyButton({ value }: { value: string }) {
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
      aria-label={`Copy key id ${value}`}
      className="mono rounded-full border border-[var(--line-2)] px-2.5 py-1 text-xs text-[var(--muted)] transition-colors hover:border-[var(--line-3)] hover:text-[var(--ink)]"
    >
      {copied ? "copied" : "copy"}
    </button>
  );
}
