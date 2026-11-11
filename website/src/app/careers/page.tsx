import type { Metadata } from "next";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { BOOKING_URL, CONTACT_MAILTO } from "@/lib/site";

export const metadata: Metadata = {
  title: "Careers · Clove",
  description:
    "We hire slowly and only exceptional engineers. Everyone at Clove scopes, builds, and ships to production.",
};

const LOOKING_FOR: [string, string][] = [
  ["Range over titles", "You can move from a data pipeline to a prompt to a frontend without flinching."],
  ["Production instinct", "You care about what happens after the demo: evals, reliability, and cost."],
  ["Direct and kind", "You say what you think, write clearly, and make the people around you better."],
];

export default function CareersPage() {
  return (
    <main id="top">
      <Nav />

      {/* hero */}
      <section className="relative overflow-hidden pt-32 pb-16 lg:pt-36">
        <div className="grid-bg absolute inset-0" aria-hidden />
        <div className="container-x relative max-w-3xl">
          <p className="eyebrow">
            <span className="signal-dot" aria-hidden />
            Careers
          </p>
          <h1 className="display mt-6 text-[clamp(2.4rem,5vw,3.8rem)]">
            Build AI that ships. With people who{" "}
            <span className="text-[var(--signal)]">ship it.</span>
          </h1>
          <p className="lead mt-7">
            We&apos;re a small, senior team and we hire slowly. Everyone here scopes,
            builds, and ships, so we look for engineers who can own a problem end to
            end and take it all the way to production.
          </p>
          <p className="lead mt-5">
            If you like turning messy, real-world problems into systems that run and
            keep running, you&apos;ll fit right in.
          </p>
        </div>
      </section>

      {/* what we look for */}
      <section className="section border-t border-[var(--line)]">
        <div className="container-x">
          <p className="eyebrow mb-8">
            <span className="signal-dot--calm inline-block h-2 w-2 rounded-full" aria-hidden /> What we look for
          </p>
          <div className="grid gap-px overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--line)] sm:grid-cols-3">
            {LOOKING_FOR.map(([k, v]) => (
              <div key={k} className="bg-[var(--paper-2)] p-6">
                <div className="mb-4 h-px w-8 bg-[var(--signal)]" />
                <p className="font-display text-lg font-semibold text-[var(--ink)]">{k}</p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{v}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* open roles / apply */}
      <section className="section border-t border-[var(--line)]">
        <div className="container-x">
          <div className="rounded-[1.5rem] border border-[var(--line)] bg-[var(--paper-2)] px-6 py-14 text-center sm:px-8">
            <p className="eyebrow justify-center">
              <span className="signal-dot" aria-hidden />
              Open roles
            </p>
            <h2 className="display mt-5 text-[clamp(1.9rem,4vw,2.8rem)]">
              No formal openings right now.
            </h2>
            <p className="lead mx-auto mt-4 max-w-xl">
              But we always make time for exceptional engineers. Tell us what
              you&apos;ve built and what you want to build next.
            </p>
            {/* Full-width on phones so the CTAs stack cleanly; side by side from sm up. */}
            <div className="mx-auto mt-8 flex w-full max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:flex-wrap sm:justify-center">
              <a href={`${CONTACT_MAILTO}?subject=Careers`} className="btn btn-primary min-h-[44px] w-full sm:w-auto">
                Email us
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </a>
              <a href={BOOKING_URL} target="_blank" rel="noopener" className="btn btn-ghost min-h-[44px] w-full sm:w-auto">
                Book a call
              </a>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
