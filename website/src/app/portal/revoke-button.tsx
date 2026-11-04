"use client";

import { useState } from "react";
import { revokeKeyAction } from "./actions";

/**
 * Two-step revoke: the first click asks, the second confirms. Revocation
 * takes effect immediately; requests using the key start failing.
 */
export default function RevokeButton({ keyId }: { keyId: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={`Revoke key ${keyId}`}
        className="mono rounded-full border border-[var(--line-2)] px-3 py-1.5 text-xs text-[var(--signal)] transition-colors hover:border-[var(--signal)]"
      >
        Revoke
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-3">
      <form action={revokeKeyAction}>
        <input type="hidden" name="keyId" value={keyId} />
        <button
          type="submit"
          className="mono rounded-full border border-[var(--signal)] bg-[color-mix(in_oklab,var(--signal)_12%,transparent)] px-3 py-1.5 text-xs text-[var(--signal)] transition-colors hover:bg-[color-mix(in_oklab,var(--signal)_20%,transparent)]"
        >
          Revoke key
        </button>
      </form>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="mono text-xs text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
      >
        Cancel
      </button>
    </span>
  );
}
