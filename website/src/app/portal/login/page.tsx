import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BOOKING_URL } from "@/lib/site";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCurrentUser } from "../auth";
import PortalLoginForm from "../login-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SOVA · Sign in",
  description: "Sign in to the SOVA customer console.",
  robots: { index: false, follow: false },
};

const FACTS = [
  "One account opens the console. Book a call to get set up.",
  "Self-serve from there. Generate and revoke API keys yourself.",
  "Usage spans every key on the account, with 30 days of history.",
];

// No DATABASE_URL: the in-memory store answers, and the numbers reset on
// every restart or cold start. Say so instead of implying durability.
function EphemeralBanner() {
  return (
    <div className="border-b border-[var(--line)] bg-[var(--paper-2)]">
      <div className="container-x flex items-center gap-3 py-3">
        <span className="h-1.5 w-1.5 flex-none rounded-full bg-[var(--signal)]" aria-hidden />
        <p className="mono text-sm text-[var(--muted)]">
          Usage tracking is running in ephemeral mode.
        </p>
      </div>
    </div>
  );
}

// Shown in place of the form when SUPABASE_URL or SUPABASE_ANON_KEY is
// unset: accounts exist as a feature, this deployment just has them off.
function NotConfigured() {
  return (
    <div className="well flex flex-col p-6">
      <p className="eyebrow">
        <span className="signal-dot--calm" aria-hidden /> Accounts
      </p>
      <p className="display mt-4 text-3xl text-[var(--ink)]">
        Accounts are not configured yet.
      </p>
      <p className="mt-3 max-w-md text-[0.95rem] leading-relaxed text-[var(--muted)]">
        Email and password sign-in is not switched on for this deployment
        yet. Book a call and we will set you up with an account and a key.
      </p>
      <a href={BOOKING_URL} target="_blank" rel="noopener" className="btn btn-ghost mt-7 self-start">
        Book a call
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </a>
    </div>
  );
}

// The console's front door: hero on the left, email + password card on the
// right. Already signed in? Straight to the console.
export default async function PortalLoginPage() {
  if (isSupabaseConfigured()) {
    const user = await getCurrentUser();
    if (user) redirect("/portal");
  }

  const ephemeral = !process.env.DATABASE_URL;

  return (
    <div className="min-h-svh">
      {ephemeral && <EphemeralBanner />}
      <section className="relative overflow-hidden">
        <div className="grid-bg absolute inset-0 opacity-70" aria-hidden />
        <div className="container-x relative grid gap-12 py-12 sm:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-start lg:gap-16">
          <div>
            <p className="eyebrow">
              <span className="signal-dot" aria-hidden /> Customer console
            </p>
            <h1 className="display mt-5 max-w-[16ch] text-[clamp(2.4rem,5.2vw,3.8rem)] text-[var(--ink)]">
              Your usage, measured.
            </h1>
            <p className="lead mt-6 max-w-lg">
              Sign in to the console: tokens in and out, requests and success
              rate, per-model latency, and daily traffic across all of your
              keys.
            </p>
            <ul className="mt-9 max-w-lg space-y-3">
              {FACTS.map((fact, i) => (
                <li
                  key={fact}
                  className="mono flex items-start gap-2.5 text-sm leading-relaxed text-[var(--muted)]"
                >
                  <span
                    className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full"
                    style={{ background: i === 0 ? "var(--signal)" : "var(--pine)" }}
                    aria-hidden
                  />
                  {fact}
                </li>
              ))}
            </ul>
            <p className="mono mt-10 text-sm text-[var(--faint)]">
              <Link
                href="/"
                className="underline-offset-4 transition-colors hover:text-[var(--ink)] hover:underline"
              >
                Back to sova.dev
              </Link>
            </p>
          </div>
          <div className="max-w-xl">
            {isSupabaseConfigured() ? <PortalLoginForm /> : <NotConfigured />}
          </div>
        </div>
      </section>
    </div>
  );
}
