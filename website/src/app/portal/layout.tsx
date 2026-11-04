import type { Metadata } from "next";
import { BOOKING_URL } from "@/lib/site";
import { getPortalAuth } from "./auth";
import Sidebar from "./sidebar";
import PortalLoginForm from "./login-form";
import { portalSignOutAction } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SOVA · Customer console",
  description:
    "The SOVA customer console: live tokens, requests, latency, and self-serve API keys.",
  robots: { index: false, follow: false },
};

const FACTS = [
  "One key opens the console. Book a call and we mint your first key.",
  "Self-serve from there. Generate and revoke keys for this endpoint yourself.",
  "Verified server side. Our database stores only a SHA-256 fingerprint of your key.",
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

function LoggedOut() {
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
              Paste your SOVA API key to open the console: tokens in and out,
              requests and success rate, per-model latency, and daily traffic.
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
            <a href={BOOKING_URL} target="_blank" rel="noopener" className="btn btn-ghost mt-10">
              Book a call to get a key
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </a>
          </div>
          <div className="max-w-xl">
            <PortalLoginForm />
          </div>
        </div>
      </section>
    </div>
  );
}

// The cookie names a key the store no longer knows: revoked, replaced, or
// from a database that has since been reset. Never render stats for it.
function InactiveKey() {
  return (
    <div className="min-h-svh">
      <section>
        <div className="container-x max-w-2xl py-12 sm:py-20">
          <p className="eyebrow">
            <span className="signal-dot--calm inline-block h-2 w-2 rounded-full" aria-hidden />{" "}
            Customer console
          </p>
          <h1 className="display mt-5 text-[clamp(2.2rem,4.6vw,3.2rem)] text-[var(--ink)]">
            This key is no longer active.
          </h1>
          <p className="lead mt-6">
            The key saved in this browser was revoked or replaced. Your usage
            history stays with Sova. Sign out, then sign in with a current key.
          </p>
          <form action={portalSignOutAction} className="mt-9">
            <button type="submit" className="btn btn-primary">
              Sign out
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}

// Route-group gate: signed-out visitors get the hero and login form, a
// revoked-cookie holder gets the inactive-key notice, and a verified key
// gets the console shell. The gate is shared by every page below it.
export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { key, row } = await getPortalAuth();

  if (!row) {
    return key ? <InactiveKey /> : <LoggedOut />;
  }

  return (
    <div className="min-h-svh bg-[var(--paper)]">
      <Sidebar />
      <div className="md:pl-60">
        <main className="mx-auto w-full max-w-6xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
          {children}
        </main>
      </div>
    </div>
  );
}
