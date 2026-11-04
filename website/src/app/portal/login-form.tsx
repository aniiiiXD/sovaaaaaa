"use client";

import { useActionState, useState } from "react";
import { BOOKING_URL } from "@/lib/site";
import { portalSignInAction, portalSignUpAction } from "./actions";
import { initialPortalAuthState } from "./state";

// Field text stays at 16px so phones don't zoom on focus; the field is ≥44px
// tall. Same field styling as ContactForm, with monospace faces throughout.
// No `outline-none` here: the global :focus-visible ring stays visible.
const FIELD =
  "mt-2 w-full rounded-lg border border-[var(--line-2)] bg-[var(--paper)] px-3.5 py-3 mono text-base normal-case tracking-normal text-[var(--ink)] placeholder:text-[var(--muted)] focus:border-[var(--pine)]";
const LABEL = "mono text-sm uppercase tracking-[0.08em] text-[var(--muted)]";

type Mode = "signin" | "signup";

/**
 * Email + password entry for the console. One form, two modes; the key prop
 * on AuthForm remounts it when the mode flips, clearing stale errors. All
 * auth runs through server actions, so no keys or tokens touch this
 * component.
 */
export default function PortalLoginForm() {
  const [mode, setMode] = useState<Mode>("signin");

  return (
    <div className="flex flex-col gap-4">
      <AuthForm key={mode} mode={mode} />
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mono text-sm text-[var(--muted)] underline-offset-4 transition-colors hover:text-[var(--ink)] hover:underline"
        >
          {mode === "signin" ? "New to Sova? Create an account" : "Have an account? Sign in"}
        </button>
        <a
          href={BOOKING_URL}
          target="_blank"
          rel="noopener"
          className="mono text-sm text-[var(--faint)] underline-offset-4 transition-colors hover:text-[var(--muted)] hover:underline"
        >
          No account yet? Book a call
        </a>
      </div>
    </div>
  );
}

function AuthForm({ mode }: { mode: Mode }) {
  const [state, formAction, pending] = useActionState(
    mode === "signin" ? portalSignInAction : portalSignUpAction,
    initialPortalAuthState,
  );
  const signup = mode === "signup";

  return (
    <form action={formAction} className="well flex flex-col gap-4 p-6">
      <div>
        <p className="font-display text-xl text-[var(--ink)]">
          {signup ? "Create your account" : "Open the console"}
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">
          {signup
            ? "Email and a password. Your keys and usage hang off the account."
            : "Sign in with the email and password on your Sova account."}
        </p>
      </div>

      <label className={LABEL}>
        Email
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
        Password
        <input
          type="password"
          name="password"
          required
          minLength={signup ? 6 : undefined}
          autoComplete={signup ? "new-password" : "current-password"}
          placeholder={signup ? "At least 6 characters" : "Your password"}
          className={FIELD}
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary mt-1 min-h-[44px] disabled:opacity-60"
      >
        {pending
          ? signup
            ? "Creating…"
            : "Checking…"
          : signup
            ? "Create account"
            : "Sign in"}
        {!pending && (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        )}
      </button>

      {/* Reserved height so the status line never shifts the layout. Errors
          read in vermilion; the check-your-inbox notice reads calm. */}
      <p
        role="status"
        aria-live="polite"
        className={`mono min-h-[1.25rem] text-sm leading-relaxed ${
          state.notice ? "text-[var(--muted)]" : "text-[var(--signal)]"
        }`}
      >
        {state.ok ? "One moment." : (state.notice || state.error)}
      </p>
    </form>
  );
}
