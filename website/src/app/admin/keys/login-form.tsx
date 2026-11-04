"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";
import { initialLoginState } from "./state";

// Same field treatment as ContactForm: 16px inputs so phones don't zoom,
// no outline-none so the global focus ring stays visible.
const FIELD =
  "mt-2 w-full rounded-lg border border-[var(--line-2)] bg-[var(--paper)] px-3.5 py-3 font-sans text-base normal-case tracking-normal text-[var(--ink)] placeholder:text-[var(--muted)] focus:border-[var(--pine)]";
const LABEL = "mono text-sm uppercase tracking-[0.08em] text-[var(--muted)]";

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialLoginState);

  return (
    <form action={formAction} className="well flex flex-col gap-4 p-6">
      <p className="eyebrow">
        <span className="signal-dot--calm inline-block h-2 w-2 rounded-full" aria-hidden />
        Admin sign-in
      </p>
      <label className={LABEL}>
        Password
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className={FIELD}
        />
      </label>
      <button type="submit" disabled={pending} className="btn btn-primary min-h-[44px] disabled:opacity-60">
        {pending ? "Checking…" : "Unlock"}
      </button>
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
