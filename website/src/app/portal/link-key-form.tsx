"use client";

import { useActionState } from "react";
import { linkKeyAction } from "./actions";
import { initialLinkKeyState } from "./state";

const FIELD =
  "mt-2 w-full rounded-lg border border-[var(--line-2)] bg-[var(--paper)] px-3.5 py-3 mono text-base normal-case tracking-normal text-[var(--ink)] placeholder:text-[var(--muted)] focus:border-[var(--pine)]";

/**
 * Claims an operator-issued key (one Sova handed out manually) into the
 * signed-in account, so its usage shows up alongside self-serve keys. Same
 * shown-once respect for secrets: the input is a password field and the
 * plaintext is never rendered back.
 */
export default function LinkKeyForm() {
  const [state, formAction, pending] = useActionState(linkKeyAction, initialLinkKeyState);

  return (
    <form action={formAction} className="well flex flex-col p-6">
      <div>
        <p className="font-display text-lg text-[var(--ink)]">Link an existing key</p>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">
          Already holding a key we issued by hand? Paste it once to move it
          into this account.
        </p>
      </div>

      <label className="mono mt-5 text-sm uppercase tracking-[0.08em] text-[var(--muted)]">
        Key
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
        className="btn btn-ghost mt-5 min-h-[44px] self-start disabled:opacity-60"
      >
        {pending ? "Linking…" : "Link key"}
      </button>

      {/* Reserved height so the status line never shifts the layout. */}
      <p
        role="status"
        aria-live="polite"
        className={`mono mt-3 min-h-[1.25rem] text-sm leading-relaxed ${
          state.status === "ok" ? "text-[var(--muted)]" : "text-[var(--signal)]"
        }`}
      >
        {state.message}
      </p>
    </form>
  );
}
