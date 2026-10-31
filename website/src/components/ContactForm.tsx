"use client";

import { useActionState } from "react";
import { sendInquiry } from "@/app/actions";
import { initialInquiryState } from "@/lib/inquiry";

// Field text stays at 16px so phones don't zoom on focus; fields are ≥44px
// tall. No `outline-none` here — the global :focus-visible ring stays visible.
// Labels and placeholder text use --muted (14px) instead of tiny --faint.
const FIELD =
  "mt-2 w-full rounded-lg border border-[var(--line-2)] bg-[var(--paper)] px-3.5 py-3 font-sans text-base normal-case tracking-normal text-[var(--ink)] placeholder:text-[var(--muted)] focus:border-[var(--pine)]";
const LABEL = "mono text-sm uppercase tracking-[0.08em] text-[var(--muted)]";

export default function ContactForm() {
  const [state, formAction, pending] = useActionState(
    sendInquiry,
    initialInquiryState,
  );

  if (state.status === "ok") {
    return (
      <div role="status" className="well flex flex-col justify-center gap-3 p-6">
        <p className="eyebrow">
          <span className="signal-dot" aria-hidden /> Sent
        </p>
        <p className="text-base leading-relaxed text-[var(--muted)]">
          {state.message}
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="well flex flex-col gap-4 p-6">
      <label className={LABEL}>
        Your name
        <input
          type="text"
          name="name"
          required
          autoComplete="name"
          placeholder="Alex Rivera"
          className={FIELD}
        />
      </label>
      <label className={LABEL}>
        Work email
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="you@company.com"
          className={FIELD}
        />
      </label>
      <label className={LABEL}>
        What are you trying to do?
        <textarea
          name="note"
          rows={3}
          placeholder="One or two lines is plenty."
          className={`${FIELD} resize-none`}
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary mt-1 min-h-[44px] disabled:opacity-60"
      >
        {pending ? "Sending…" : "Request a call"}
        {!pending && (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        )}
      </button>

      {/* Reserved height so the status line never shifts the layout.
          Server action untouched — same sendInquiry, same state shape. */}
      <p
        role="status"
        aria-live="polite"
        className="mono min-h-[1.25rem] text-sm leading-relaxed text-[var(--signal)]"
      >
        {state.status === "error" ? state.message : ""}
      </p>
    </form>
  );
}
