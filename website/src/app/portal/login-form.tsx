"use client";

import { useActionState } from "react";
import { portalLoginAction } from "./actions";
import { initialPortalLoginState } from "./state";

// Field text stays at 16px so phones don't zoom on focus; the field is ≥44px
// tall. Same field styling as ContactForm, with a monospace face for the key.
// No `outline-none` here: the global :focus-visible ring stays visible.
const FIELD =
  "mt-2 w-full rounded-lg border border-[var(--line-2)] bg-[var(--paper)] px-3.5 py-3 mono text-base normal-case tracking-normal text-[var(--ink)] placeholder:text-[var(--muted)] focus:border-[var(--pine)]";
const LABEL = "mono text-sm uppercase tracking-[0.08em] text-[var(--muted)]";

export default function PortalLoginForm() {
  const [state, formAction, pending] = useActionState(
    portalLoginAction,
    initialPortalLoginState,
  );

  return (
    <form action={formAction} className="well flex flex-col gap-4 p-6">
      <label className={LABEL}>
        SOVA API key
        <input
          type="password"
          name="key"
          required
          autoComplete="off"
          placeholder="sk-sova-..."
          className={FIELD}
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary mt-1 min-h-[44px] disabled:opacity-60"
      >
        {pending ? "Checking…" : "Open the console"}
        {!pending && (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        )}
      </button>

      {/* Reserved height so the status line never shifts the layout. */}
      <p
        role="status"
        aria-live="polite"
        className="mono min-h-[1.25rem] text-sm leading-relaxed text-[var(--signal)]"
      >
        {state.ok ? "Verified. One moment." : state.error}
      </p>
    </form>
  );
}
