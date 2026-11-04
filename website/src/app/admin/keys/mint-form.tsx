"use client";

import { useActionState, useState } from "react";
import { mintKeyAction } from "./actions";
import { initialMintState } from "./state";
import CopyButton from "./copy-button";

const FIELD =
  "mt-2 w-full rounded-lg border border-[var(--line-2)] bg-[var(--paper)] px-3.5 py-3 font-sans text-base normal-case tracking-normal text-[var(--ink)] placeholder:text-[var(--muted)] focus:border-[var(--pine)]";
const LABEL = "mono text-sm uppercase tracking-[0.08em] text-[var(--muted)]";

export default function MintForm() {
  const [state, formAction, pending] = useActionState(mintKeyAction, initialMintState);

  // The plaintext is shown once: from mint until dismissed or navigation.
  // Identity compare, not a boolean, so minting again after a dismiss
  // reveals the new key while the old dismissal stays dismissed.
  const [dismissed, setDismissed] = useState<typeof state | null>(null);
  const revealed = state.status === "ok" && state !== dismissed ? state : null;

  return (
    <div className="flex flex-col gap-5">
      <form action={formAction} className="well flex max-w-xl flex-col gap-4 p-6">
        <p className="eyebrow">
          <span className="signal-dot--calm inline-block h-2 w-2 rounded-full" aria-hidden />
          Mint a key
        </p>
        <label className={LABEL}>
          Label
          <input
            type="text"
            name="label"
            maxLength={80}
            placeholder="pilot-bankchat"
            className={FIELD}
          />
        </label>
        <p className="mono text-xs leading-relaxed text-[var(--faint)]">
          Optional. Falls back to &quot;unnamed&quot;. Shows in the table only; it is not part of the key.
        </p>
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary min-h-[44px] disabled:opacity-60"
        >
          {pending ? "Minting…" : "Mint key"}
        </button>
        <p
          role="status"
          aria-live="polite"
          className="mono min-h-[1.25rem] text-sm leading-relaxed text-[var(--signal)]"
        >
          {state.status === "error" ? state.message : ""}
        </p>
      </form>

      {revealed && (
        <div
          role="alert"
          className="max-w-xl rounded-2xl border p-6"
          style={{
            borderColor: "color-mix(in oklab, var(--signal) 55%, transparent)",
            background: "color-mix(in oklab, var(--signal) 7%, var(--paper-2))",
          }}
        >
          <p className="eyebrow" style={{ color: "var(--signal)" }}>
            <span className="signal-dot" aria-hidden />
            Plaintext shown once
          </p>
          <p className="mono mt-4 break-all text-base leading-relaxed text-[var(--ink)]">
            {revealed.key}
          </p>
          <p className="mono mt-2 text-xs text-[var(--muted)]">
            keyId {revealed.keyId}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <CopyButton value={revealed.key} variant="primary" ariaLabel="Copy the plaintext API key" />
            <button
              type="button"
              onClick={() => setDismissed(state)}
              className="btn btn-ghost min-h-[44px]"
            >
              Done, hide it
            </button>
          </div>
          <p className="mono mt-4 text-xs leading-relaxed" style={{ color: "var(--signal)" }}>
            Copy it now. You will not see this again: only a SHA-256 fingerprint is stored, and the
            plaintext cannot be recovered. Revoke and mint a replacement if you lose it.
          </p>
        </div>
      )}
    </div>
  );
}
