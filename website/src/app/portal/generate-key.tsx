"use client";

import { useState, useTransition } from "react";
import { generateKeyAction } from "./actions";
import CopyKeyButton from "./copy-key-button";

const FIELD =
  "mt-2 w-full rounded-lg border border-[var(--line-2)] bg-[var(--paper)] px-3.5 py-3 mono text-base normal-case tracking-normal text-[var(--ink)] placeholder:text-[var(--muted)] focus:border-[var(--pine)]";

type Revealed = { key: string; keyId: string };

/**
 * The self-serve key flow: closed → alias input → one-time secret reveal.
 * The plaintext key lives in this component's state only until the customer
 * dismisses it; the store keeps just the fingerprint.
 */
export default function GenerateKey() {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [revealed, setRevealed] = useState<Revealed | null>(null);
  const [error, setError] = useState("");

  function openPanel() {
    setRevealed(null);
    setError("");
    setOpen(true);
  }

  function generate(formData: FormData) {
    start(async () => {
      const result = await generateKeyAction(formData);
      if (result.status === "ok") {
        setRevealed({ key: result.key, keyId: result.keyId });
        setError("");
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="well flex flex-col p-6">
      {revealed ? (
        <div role="status">
          <p className="eyebrow">
            <span className="signal-dot" aria-hidden /> Key generated
          </p>
          <p className="mono mt-4 break-all rounded-lg border border-[color-mix(in_oklab,var(--signal)_45%,transparent)] bg-[color-mix(in_oklab,var(--signal)_8%,var(--paper-3))] p-4 text-sm leading-relaxed text-[var(--ink)]">
            {revealed.key}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <CopyKeyButton value={revealed.key} />
            <p className="mono text-sm text-[var(--signal)]">
              Copy it now. You will not see this again.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setRevealed(null);
              setOpen(false);
            }}
            className="btn btn-ghost mt-6 self-start"
          >
            Done
          </button>
        </div>
      ) : open ? (
        <form action={generate} className="flex flex-col">
          <label className="mono text-sm uppercase tracking-[0.08em] text-[var(--muted)]">
            Alias
            <input
              type="text"
              name="alias"
              required
              maxLength={80}
              autoComplete="off"
              placeholder="prod-loader"
              className={FIELD}
            />
          </label>
          <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
            Name it so you can tell keys apart later. The secret is shown once.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <button
              type="submit"
              disabled={pending}
              className="btn btn-primary min-h-[44px] disabled:opacity-60"
            >
              {pending ? "Generating…" : "Generate key"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mono text-sm text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
            >
              Cancel
            </button>
          </div>
          {/* Reserved height so the status line never shifts the layout. */}
          <p
            role="status"
            aria-live="polite"
            className="mono mt-3 min-h-[1.25rem] text-sm leading-relaxed text-[var(--signal)]"
          >
            {error}
          </p>
        </form>
      ) : (
        <div className="flex flex-col justify-center gap-4">
          <div>
            <p className="font-display text-lg text-[var(--ink)]">Generate API key</p>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">
              Alias it, generate it, copy the secret. New keys work immediately.
            </p>
          </div>
          <button type="button" onClick={openPanel} className="btn btn-primary self-start">
            Generate API key
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
